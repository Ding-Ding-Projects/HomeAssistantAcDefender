import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(projectRoot, "..");

export function assertLifecycleContract(packageText, workflowText, dependencyScriptText, installerScriptText) {
  const packageJson = JSON.parse(packageText);
  assert.equal(Object.hasOwn(packageJson, "allowScripts"), false, "inert allowScripts policy must not return");
  assert.match(workflowText, /^\s*run:\s*npm ci --ignore-scripts\s*$/m);
  assert.doesNotMatch(workflowText, /^\s*run:\s*npm ci\s*$/m);
  assert.match(dependencyScriptText, /^\s*call npm ci --ignore-scripts\s*$/m);
  assert.doesNotMatch(dependencyScriptText, /^\s*call npm ci\s*$/m);
  assert.match(dependencyScriptText, /winget install --id %~1 --version %~2 --exact --source winget /);
  assert.doesNotMatch(dependencyScriptText, /winget install(?![^\r\n]*--source winget)/);
  assert.match(dependencyScriptText, /Get-Command curl\.exe/);
  assert.match(dependencyScriptText, /'--max-time' '600'/);
  assert.match(dependencyScriptText, /portable fallback failed for/);
  assert.match(dependencyScriptText, /%SystemRoot%\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
  assert.match(dependencyScriptText, /Security\.Cryptography\.HashAlgorithm/);
  assert.doesNotMatch(dependencyScriptText, /Get-FileHash/);
  assert.doesNotMatch(dependencyScriptText, /p\.version!==/);
  assert.match(workflowText, /node node_modules\/electron\/install\.js/);
  assert.match(workflowText, /node node_modules\/esbuild\/install\.js/);
  assert.match(workflowText, /Get-AuthenticodeSignature/);
  assert.match(workflowText, /\.signature\.p7s/);
  assert.match(installerScriptText, /Get-AuthenticodeSignature/);
  assert.match(installerScriptText, /\.signature\.p7s/);
  assert.doesNotMatch(installerScriptText, /for %%F in \("%SETUP%" "%NUPKG%"\)/);
  assert.doesNotMatch(workflowText, /select-7z-arch\.js/);
  assert.doesNotMatch(dependencyScriptText, /select-7z-arch\.js/);
  assert.match(packageJson.devDependencies.electron, /^43\.4\.1$/);
  assert.match(packageJson.build.squirrelWindows.iconUrl, /raw\/f407c15d73844ad9f81c5e7719c5c62a35dd893e\/desktop\/src-tauri\/icons\/icon\.ico$/);
  assert.doesNotMatch(packageJson.build.squirrelWindows.iconUrl, /\/master\//);
}

const packageText = fs.readFileSync(path.join(projectRoot, "package.json"), "utf8");
const workflowText = fs.readFileSync(path.join(repositoryRoot, ".github/workflows/release.yml"), "utf8");
const dependencyScriptText = fs.readFileSync(path.join(repositoryRoot, "download-dependencies.bat"), "utf8");
const installerScriptText = fs.readFileSync(path.join(repositoryRoot, "build-installer.bat"), "utf8");
assertLifecycleContract(packageText, workflowText, dependencyScriptText, installerScriptText);

const brokenPackage = packageText.replace('"overrides": {', '"allowScripts": {');
assert.throws(() => assertLifecycleContract(brokenPackage, workflowText, dependencyScriptText, installerScriptText), /allowScripts/);
const brokenWorkflow = workflowText.replace("npm ci --ignore-scripts", "npm ci");
assert.throws(() => assertLifecycleContract(packageText, brokenWorkflow, dependencyScriptText, installerScriptText), /ignore-scripts/);
const brokenDependencyScript = dependencyScriptText.replace(" --exact --source winget", "");
assert.throws(() => assertLifecycleContract(packageText, workflowText, brokenDependencyScript, installerScriptText), /source winget/);
const brokenInstallerAuthenticode = installerScriptText.replace("Get-AuthenticodeSignature", "Get-BrokenSignature");
assert.throws(
  () => assertLifecycleContract(packageText, workflowText, dependencyScriptText, brokenInstallerAuthenticode),
  /Get-AuthenticodeSignature/
);
const brokenInstallerNugetSignature = installerScriptText.replace(".signature.p7s", ".signature.p7x");
assert.throws(
  () => assertLifecycleContract(packageText, workflowText, dependencyScriptText, brokenInstallerNugetSignature),
  /signature/
);
const brokenIcon = packageText.replace("raw/f407c15d73844ad9f81c5e7719c5c62a35dd893e/", "raw/master/");
assert.throws(
  () => assertLifecycleContract(brokenIcon, workflowText, dependencyScriptText, installerScriptText),
  (error) => error?.code === "ERR_ASSERTION" && String(error.actual).includes("/raw/master/")
);

console.log("lifecycle-contract: only explicit pinned native install scripts are allowed");
