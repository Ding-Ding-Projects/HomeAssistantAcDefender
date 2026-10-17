import { chromium } from 'playwright-core';
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { copyFile, mkdtemp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const execute = promisify(execFile);
const [artifactArgument, evidenceArgument] = process.argv.slice(2);
if (!artifactArgument || !evidenceArgument) {
  console.error('Usage: node scripts/native-portable-proof.mjs <portable.exe> <evidence-directory>');
  process.exit(2);
}
const evidence = resolve(evidenceArgument);
await mkdir(evidence, { recursive: true });
const receipt = { schemaVersion: 1, route: 'native-windows-exact-portable-loopback-cdp', verified: false, checks: [] };
let profile;
let launchDirectory;
let child;
let browser;
let failure;
const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
try {
  if (process.platform !== 'win32') throw new Error('Native Windows is required; this host cannot verify the portable executable.');
  const artifact = await realpath(resolve(artifactArgument));
  assert.match(basename(artifact), /^AC-Defender-Docs-\d+\.\d+\.\d+-portable\.exe$/);
  assert((await stat(artifact)).isFile(), 'Artifact must be an existing single portable executable');
  receipt.artifact = basename(artifact);
  receipt.artifactSha256 = createHash('sha256').update(await readFile(artifact)).digest('hex');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const expectedVersion = process.env.AC_DEFENDER_VERSION || pkg.version;
  const expectedSource = process.env.AC_DEFENDER_REVISION;
  profile = await mkdtemp(join(tmpdir(), 'ac-defender-docs-native-'));
  launchDirectory = await mkdtemp(join(tmpdir(), 'ac-defender-docs-portable-'));
  const isolatedArtifact = join(launchDirectory, basename(artifact));
  await copyFile(artifact, isolatedArtifact);
  assert.equal(createHash('sha256').update(await readFile(isolatedArtifact)).digest('hex'), receipt.artifactSha256);
  receipt.checks.push('Exact portable bytes copied into an otherwise empty owned launch directory');
  const reservation = createServer();
  await new Promise((done, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', done); });
  const port = reservation.address().port;
  await new Promise(done => reservation.close(done));
  child = spawn(isolatedArtifact, [
    `--user-data-dir=${profile}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    '--enable-automation'
  ], { cwd: launchDirectory, windowsHide: true, stdio: 'ignore' });
  let launchError;
  child.once('error', error => { launchError = error; });
  const deadline = Date.now() + 45_000;
  let endpoint;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const description = await response.json();
        const candidate = new URL(description.webSocketDebuggerUrl);
        assert.equal(candidate.hostname, '127.0.0.1');
        assert.equal(candidate.port, String(port));
        endpoint = candidate.href;
        break;
      }
    } catch { /* The owned portable runtime may still be extracting. */ }
    await delay(250);
  }
  assert(endpoint, 'The owned portable executable did not expose its loopback CDP endpoint within 45 seconds');
  browser = await chromium.connectOverCDP(endpoint, { timeout: 10_000 });
  const session = await browser.newBrowserCDPSession();
  const commandLine = await session.send('Browser.getBrowserCommandLine');
  assert(commandLine.arguments.some(argument => argument === `--user-data-dir=${profile}`), 'CDP browser must belong to the exact owned temporary profile');
  receipt.checks.push('CDP process command line matches the owned temporary profile');
  const context = browser.contexts()[0];
  assert(context, 'Portable runtime must expose its actual browser context');
  let page;
  const pageDeadline = Date.now() + 15_000;
  while (Date.now() < pageDeadline) {
    page = context.pages().find(candidate => candidate.url() === 'docs://reader/index.html');
    if (page) break;
    await delay(100);
  }
  assert(page, 'Actual packaged reader route did not open');
  await page.locator('#results md-text-button').first().waitFor({ timeout: 15_000 });
  const catalog = await page.evaluate(async () => {
    const response = await fetch('catalog.json');
    if (!response.ok) throw new Error('Packaged catalog unavailable');
    return response.json();
  });
  assert.equal(catalog.metadata.version, expectedVersion);
  assert.match(catalog.metadata.source, /^[a-f0-9]{40}$/);
  if (expectedSource) assert.equal(catalog.metadata.source, expectedSource);
  assert(!Number.isNaN(Date.parse(catalog.metadata.builtAt)), 'Recorded build time must be valid');
  if (process.env.AC_DEFENDER_BUILD_TIME) assert.equal(catalog.metadata.builtAt, process.env.AC_DEFENDER_BUILD_TIME);
  assert(Number.isInteger(catalog.metadata.articleCount) && catalog.metadata.articleCount > 0);
  assert.equal(catalog.articles.length, catalog.metadata.articleCount);
  assert.equal(await page.locator('#results md-text-button').count(), catalog.metadata.articleCount);
  const provenance = await page.locator('#provenance').innerText();
  assert(provenance.includes(expectedVersion) && provenance.includes(catalog.metadata.source), 'Initial screen must display artifact provenance');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  receipt.metadata = catalog.metadata;
  receipt.checks.push('Initial docs://reader/index.html displays expected version and source', 'All packaged articles appear in the local reader', 'Renderer has no Node require');
  await page.screenshot({ path: join(evidence, 'initial-window.png'), fullPage: true });
  const destination = catalog.articles.find(article => article.path === 'site/wiki/documentation-companion.html');
  assert(destination, 'The companion documentation article must be bundled');
  await page.locator('#library').click();
  await page.locator('#results md-text-button').filter({ hasText: destination.title }).first().click();
  await page.waitForFunction(path => document.querySelector('#article')?.contentWindow?.location.pathname === '/' + path, destination.path, { timeout: 10_000 });
  const article = page.frames().find(frame => frame.url() === 'docs://reader/' + destination.path);
  assert(article, 'User article navigation must open the exact bundled article');
  assert.equal(await article.locator('script').count(), 0);
  receipt.checks.push('Actual reader navigation opened the bundled documentation-companion article without scripts');
  receipt.articleUrl = article.url();
  receipt.captureSha256 = createHash('sha256').update(await readFile(join(evidence, 'initial-window.png'))).digest('hex');
} catch (error) {
  failure = error;
  receipt.failure = String(error?.message || error).replaceAll(profile || '\u0000', '<owned-profile>').slice(0, 1000);
} finally {
  if (browser) {
    try { const session = await browser.newBrowserCDPSession(); await session.send('Browser.close'); } catch { /* Closing may disconnect the transport immediately. */ }
    await browser.close().catch(() => {});
  }
  if (child?.pid && child.exitCode === null) {
    await Promise.race([new Promise(done => child.once('exit', done)), delay(5000)]);
    if (child.exitCode === null) {
      try { await execute(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { timeout: 10_000, windowsHide: true }); }
      catch (error) { failure ||= error; receipt.cleanupFailure = 'Could not close the owned portable process tree'; }
    }
  }
  if (profile) {
    try { await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); }
    catch (error) { failure ||= error; receipt.cleanupFailure = 'Could not remove the owned temporary profile'; }
  }
  if (launchDirectory) {
    try { await rm(launchDirectory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); }
    catch (error) { failure ||= error; receipt.cleanupFailure = 'Could not remove the owned isolated launch directory'; }
  }
  receipt.verified = !failure;
  await writeFile(join(evidence, 'result.json'), JSON.stringify(receipt, null, 2));
}
if (failure) {
  console.error('Native portable verification failed or is unavailable; see result.json.');
  process.exitCode = 1;
} else {
  console.log('Native Windows portable reader, provenance, articles and owned cleanup verified.');
}
