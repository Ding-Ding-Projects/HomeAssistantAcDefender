const MAX_MANIFEST_BYTES = 256 * 1024;

/**
 * Normalize the operator-provided Squirrel.Windows feed directory.
 *
 * The updater only consumes a direct HTTPS directory. Credentials, query
 * strings, fragments, and GitHub Pages hosts are rejected before Electron's
 * updater sees the value. This does not replace Squirrel signature
 * verification; it prevents a common class of accidental or ambiguous feed
 * configuration.
 */
function normalizeUpdateFeedUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Update feed URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Update feeds must use HTTPS so Squirrel signatures and metadata cannot be replaced in transit.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Update feed URLs cannot contain credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("Update feed URLs cannot contain a query string or fragment.");
  }
  if (parsed.hostname.toLowerCase().endsWith(".github.io") || parsed.hostname.toLowerCase() === "github.io") {
    throw new Error("GitHub Pages is an HTML site, not a signed Squirrel.Windows feed directory.");
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/`;
  return parsed.toString();
}

function parseSquirrelReleaseManifest(text) {
  const source = String(text ?? "");
  if (Buffer.byteLength(source, "utf8") > MAX_MANIFEST_BYTES) {
    throw new Error("The Squirrel RELEASES manifest is larger than the 256 KiB safety limit.");
  }
  const entries = [];
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const fields = line.split(/\s+/);
    if (fields.length < 3 || fields.length > 4) {
      throw new Error(`The Squirrel RELEASES manifest has an invalid line ${index + 1}.`);
    }
    const [sha1, filename, size, sourceUrl] = fields;
    if (!/^[0-9a-f]{40}$/i.test(sha1)) {
      throw new Error(`The Squirrel RELEASES manifest has an invalid SHA-1 on line ${index + 1}.`);
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.nupkg$/i.test(filename)) {
      throw new Error(`The Squirrel RELEASES manifest has an invalid package name on line ${index + 1}.`);
    }
    if (!/^[1-9][0-9]*$/.test(size) || Number(size) > Number.MAX_SAFE_INTEGER) {
      throw new Error(`The Squirrel RELEASES manifest has an invalid package size on line ${index + 1}.`);
    }
    if (sourceUrl && /[\u0000-\u0020\u007f]/.test(sourceUrl)) {
      throw new Error(`The Squirrel RELEASES manifest has an invalid source URL on line ${index + 1}.`);
    }
    entries.push({ sha1: sha1.toLowerCase(), filename, size: Number(size), sourceUrl: sourceUrl || null });
  }
  if (!entries.length) throw new Error("The Squirrel RELEASES manifest contains no packages.");
  return entries;
}

async function probeSquirrelFeed(feedUrl, fetchImpl = globalThis.fetch) {
  const normalized = normalizeUpdateFeedUrl(feedUrl);
  if (!normalized) throw new Error("Configure an HTTPS Squirrel.Windows feed before checking for updates.");
  if (typeof fetchImpl !== "function") throw new Error("This runtime cannot probe an update feed.");
  const manifestUrl = new URL("RELEASES", normalized).toString();
  let response;
  try {
    response = await fetchImpl(manifestUrl, { headers: { Accept: "text/plain" }, redirect: "error" });
  } catch (error) {
    throw new Error(`Could not reach the Squirrel RELEASES manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response || !response.ok) {
    throw new Error(`The Squirrel RELEASES manifest returned HTTP ${response?.status ?? "unknown"}.`);
  }
  const entries = parseSquirrelReleaseManifest(await response.text());
  return { feedUrl: normalized, manifestUrl, entries };
}

module.exports = { MAX_MANIFEST_BYTES, normalizeUpdateFeedUrl, parseSquirrelReleaseManifest, probeSquirrelFeed };
