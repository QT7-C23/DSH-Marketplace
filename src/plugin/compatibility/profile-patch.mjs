import { parseDocument } from 'yaml';

function markers(text, key) {
  if (!/^(?:extension|mcp)-[a-z0-9-]{1,64}$/.test(key)) throw Error('Invalid managed patch');
  const begin = [], end = [];
  for (const match of text.matchAll(/[^\r\n]*(?:\r\n|\n|$)/g)) {
    const line = match[0].replace(/\r?\n$/, '');
    if (line === `# dsh-market:${key}:begin`) begin.push({ start: match.index, body: match.index + match[0].length });
    if (line === `# dsh-market:${key}:end`) end.push({ start: match.index, after: match.index + match[0].length });
  }
  if (!begin.length && !end.length) return null;
  if (begin.length !== 1 || end.length !== 1 || end[0].start < begin[0].body) throw Error('Ambiguous managed patch');
  return { start: begin[0].start, body: begin[0].body, end: end[0].start, after: end[0].after };
}

/** Private configuration read; callers must never publish returned connection values. */
export function readManagedPatch(bytes, key) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes || Buffer.alloc(0));
  const range = markers(text, key);
  if (!range) return [];
  const doc = parseDocument(text.slice(range.body, range.end));
  if (doc.errors.length || !Array.isArray(doc.toJS())) throw Error('Invalid managed block');
  return doc.toJS();
}

/** Preserve the user's text; replace only one explicitly delimited market-owned block. */
export function managedPatch(bytes, key, records) {
  if (!/^(?:extension|mcp)-[a-z0-9-]{1,64}$/.test(key) || !Array.isArray(records) || records.length > 32) throw Error('Invalid managed patch');
  const original = new TextDecoder('utf-8', { fatal: true }).decode(bytes || Buffer.from('[]\n'));
  const doc = parseDocument(original, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] });
  if (doc.errors.length || !Array.isArray(doc.toJS())) throw Error('Invalid profile patch');
  const start = `# dsh-market:${key}:begin\n`, end = `# dsh-market:${key}:end\n`;
  const range = markers(original, key);
  let prefix = range ? original.slice(0, range.start) : original;
  const suffix = range ? original.slice(range.after) : '';
  const block = records.length ? start + records.map(record => '- ' + JSON.stringify(record)).join('\n') + '\n' + end : '';
  if (block && doc.toJS().length === 0) prefix = prefix.replace(/^\s*\[\]\s*$/m, '');
  const text = prefix + (block && prefix && !prefix.endsWith('\n') ? '\n' : '') + block + suffix;
  const candidate = text || '[]\n';
  const next = parseDocument(candidate, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] });
  if (next.errors.length || (next.toJS() !== null && !Array.isArray(next.toJS()))) throw Error('Invalid resulting profile patch');
  return Buffer.from(next.toJS() === null ? candidate + '[]\n' : candidate);
}
