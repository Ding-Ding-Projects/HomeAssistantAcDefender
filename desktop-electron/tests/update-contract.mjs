import assert from "node:assert/strict";
import {
  normalizeUpdateFeedUrl,
  parseSquirrelReleaseManifest,
  probeSquirrelFeed
} from "../electron/update-contract.cjs";

assert.equal(normalizeUpdateFeedUrl(""), "");
assert.equal(normalizeUpdateFeedUrl("https://updates.example.test/ac-defender"), "https://updates.example.test/ac-defender/");
assert.throws(() => normalizeUpdateFeedUrl("http://updates.example.test/ac-defender"), /HTTPS/);
assert.throws(() => normalizeUpdateFeedUrl("https://user:password@updates.example.test/feed"), /credentials/);
assert.throws(() => normalizeUpdateFeedUrl("https://updates.example.test/feed?channel=stable"), /query/);
assert.throws(() => normalizeUpdateFeedUrl("https://ding-ding-projects.github.io/HomeAssistantAcDefender/"), /GitHub Pages/);

const manifest = `${"a".repeat(40)} ACDefenderController-0.1.0-full.nupkg 12345\n`;
assert.deepEqual(parseSquirrelReleaseManifest(manifest), [{
  sha1: "a".repeat(40),
  filename: "ACDefenderController-0.1.0-full.nupkg",
  size: 12345,
  sourceUrl: null
}]);
assert.throws(() => parseSquirrelReleaseManifest("not a RELEASES line"), /invalid SHA-1/);
assert.throws(() => parseSquirrelReleaseManifest(`${"b".repeat(40)} bad.zip 1`), /invalid package name/);

const probed = await probeSquirrelFeed("https://updates.example.test/feed", async (url, options) => {
  assert.equal(url, "https://updates.example.test/feed/RELEASES");
  assert.equal(options.redirect, "error");
  return { ok: true, status: 200, text: async () => manifest };
});
assert.equal(probed.entries.length, 1);
assert.equal(probed.manifestUrl, "https://updates.example.test/feed/RELEASES");

await assert.rejects(
  probeSquirrelFeed("https://updates.example.test/feed", async () => ({ ok: false, status: 503, text: async () => "" })),
  /HTTP 503/
);

console.log("update-contract: HTTPS feed normalization, manifest validation, and preflight probe passed");
