import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validatePrompt, submissionUrl } from './contracts.mjs';
import { registryEntries } from '../src/sources/community.mjs';

const folder = new URL('./prompts/', import.meta.url);
const entries = [];
for (const file of (await readdir(folder)).filter(name => name.endsWith('.json')).sort()) {
  const value = validatePrompt(JSON.parse(await readFile(new URL(file, folder), 'utf8')));
  assert.equal(file, value.id + '.json', 'Filename must match the resource id');
  if (value.provenance) assert.equal(createHash('sha256').update(value.body).digest('hex'), value.provenance.sha256, `${file}: upstream text changed; record an explicit adaptation instead`);
  entries.push(value);
}
submissionUrl(JSON.parse(await readFile(new URL('./settings.json', import.meta.url), 'utf8')));
const output = JSON.stringify(entries, null, 2) + '\n';
const destination = new URL('./index.json', import.meta.url);
if (process.argv.includes('--check')) assert.equal(await readFile(destination, 'utf8'), output, 'Run node catalog/build.mjs after changing prompt files');
else await writeFile(destination, output);
console.log(`GitHub prompt catalog: ${entries.length} files validated.`);
const additional = JSON.parse(await readFile(new URL('./resource-entries.json', import.meta.url), 'utf8'));
assert(Array.isArray(additional), 'Additional resource entries must be an array');
const removals = JSON.parse(await readFile(new URL('./removals.json', import.meta.url), 'utf8')).entries;
const registry = { schema: 1, entries: [...entries, ...additional], removals };
registryEntries(registry);
const registryOutput = JSON.stringify(registry, null, 2) + '\n';
const registryPath = new URL('./registry.json', import.meta.url);
if (process.argv.includes('--check')) assert.equal(await readFile(registryPath, 'utf8'), registryOutput, 'Run node catalog/build.mjs after changing resource entries or removals');
else await writeFile(registryPath, registryOutput);
