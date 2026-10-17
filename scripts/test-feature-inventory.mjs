import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Deliberately maintained independently of the CSV parser and row discovery.
const requiredFamilies = `personalization: language funny-emoji personal-vocabulary vocabulary-drop-apply school-mode narration scheduled-settings display-name adhd-modes dim-sum dim-sum-photo-source
appearance: material-design workflow-navigation motion appearance-editor color-picker logo-customization overlay-panels collapse-filters accessibility-sizing functional-ui
navigation: onboarding-wizard tabs regex-search command-palette context-menus menu-shortcuts rich-controls guided-forms info-icon-guidance settings-explanations blank-editors
safety: super-confirmation element-locks support-tickets unlock-ladder authenticator qr-pairing honest-monetization
records: local-history exports bulk-actions changelog offline-docs rendered-provider-text notifications
tools: file-converter minecraft-server-manager ollama-suite external-editor download-handoff forge-publishing progress-recovery
evidence: completeness-parity front-provenance product-evidence screen-recording design-reference-parity design-folder display-scale-matrix public-capture-gallery
documentation: landing-site mobile-site installer-download-button feature-articles vendored-fonts shared-link-embed homepage-link vocabulary-unlock-boundary packaged-documentation-app
status: status-hub discord-status-bridge panic-webhooks tidbyt-displays
build: build-entrypoints fresh-build-run-command dependency-fetcher bundled-dependencies squirrel-installer self-signing auto-updates app-icon
release: release-workflow release-timing release-line-counts release-dim-sum-photo dim-sum-code-names ci-bootstrap runner-selection encrypted-public-builder
repository: tabbed-readme human-time-estimate sanitized-instruction-copy agents-md-vocabulary-block vocabulary-hash-lock roadmap-checklist feature-docs postman-collections wiki-site-sync handoff-record closeout-prompt discussion-records project-board operational-skill
reference-system: readme-prompt-banner single-file-editions project-profile
game: roblox-model-catalogue roblox-visual-realism`;
const required = new Map(requiredFamilies.split('\n').flatMap(line => {
  const [family, ids] = line.split(': ');
  return ids.split(' ').map(id => [id, family]);
}));
const surfaces = ['webapp', 'publicdocs', 'controller', 'setupwizard', 'docscompanion', 'tauri'];
const fields = ['feature_id', 'family', 'applicability', ...surfaces, 'implementation_paths', 'documentation', 'localization', 'persistence', 'tests', 'artifact_interaction', 'captures', 'evidence', 'next_acceptance'];
const statuses = new Set(['implemented', 'source-only', 'unverified', 'missing', 'not-applicable']);
function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if (c === '\n' && !quoted) { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += c;
  }
  assert.equal(quoted, false, 'unterminated CSV quote');
  if (value || row.length) { row.push(value); rows.push(row); }
  const header = rows.shift(); assert.deepEqual(header, fields, 'exact schema required');
  return rows.filter(r => r.some(Boolean)).map(r => {
    assert.equal(r.length, fields.length, 'row width');
    return Object.fromEntries(fields.map((f, i) => [f, r[i]]));
  });
}
function validate(rows, requireComplete = false) {
  assert.equal(rows.length, required.size, 'required feature count');
  const seen = new Set();
  for (const row of rows) {
    assert(required.has(row.feature_id), `unexpected identity ${row.feature_id}`);
    assert(!seen.has(row.feature_id), `duplicate ${row.feature_id}`); seen.add(row.feature_id);
    assert.equal(row.family, required.get(row.feature_id), 'family binding');
    for (const field of fields) assert(row[field]?.trim(), `${row.feature_id}: missing ${field}`);
    for (const surface of surfaces) {
      assert(statuses.has(row[surface]), `${row.feature_id}: invalid ${surface} status`);
      if (requireComplete) assert(['implemented', 'not-applicable'].includes(row[surface]), `${row.feature_id}/${surface}: incomplete (${row[surface]})`);
    }
    if (surfaces.some(s => row[s] === 'implemented')) {
      for (const field of ['implementation_paths','documentation','localization','persistence','tests','artifact_interaction','captures','evidence']) {
        assert(!/missing|unverified|pending|not established/i.test(row[field]), `${row.feature_id}: unsupported completion in ${field}`);
      }
      assert(/revision|sha256/i.test(row.artifact_interaction), 'artifact provenance required');
      for (const field of ['tests','artifact_interaction','captures']) {
        const files = row[field].split(';').map(p => p.trim());
        for (const file of files) {
          assert(!path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'), 'repository-relative proof required');
          assert(fs.existsSync(path.join(root, file)), `missing proof file ${file}`);
        }
      }
    }
  }
  for (const id of required.keys()) assert(seen.has(id), `missing required identity ${id}`);
}
const rows = parseCSV(fs.readFileSync(path.join(root, 'docs/feature-compliance.csv'), 'utf8'));
validate(rows);
// Each mutation targets one exact cell or identity. No on-disk files are modified.
let negatives = 0;
for (let index = 0; index < rows.length; index++) {
  const removed = structuredClone(rows); removed.splice(index, 1);
  assert.throws(() => validate(removed)); negatives++;
  for (const field of fields) {
    const broken = structuredClone(rows); broken[index][field] = '';
    assert.throws(() => validate(broken), `${rows[index].feature_id}/${field} removal must fail`); negatives++;
  }
  const falseClaim = structuredClone(rows); falseClaim[index].webapp = 'implemented';
  assert.throws(() => validate(falseClaim), 'unsupported completion must fail'); negatives++;
}
validate(rows);
if (process.argv.includes('--require-complete')) validate(rows, true);
console.log(`Inventory structure verified: ${rows.length} identities, ${surfaces.length} explicit surfaces, ${negatives} negative cases. Product completion remains incomplete.`);
