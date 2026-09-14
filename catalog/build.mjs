import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validatePrompt, submissionUrl } from './contracts.mjs';

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
