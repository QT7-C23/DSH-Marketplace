import React, { useEffect, useRef, useState } from 'react';
import { type Resource } from '../../community/contracts.mjs';
import { Button, Dialog, Field } from './components';
import { useLanguage } from './i18n';

type Row = { id: string; name: string; revision: number; version: string; state: string; tools: string[] };
type Choice = { id: string; label: string; supported: boolean; reason?: string; fields: Array<{ key: string; label: string; required: boolean; secret: boolean; default?: string; choices?: string[] }> };
type Plan = { id: string; revision: number; choices: Choice[] };
const states = ['configured', 'connecting', 'registered', 'disabled', 'failed', 'modified', 'missing', 'removed'];
async function call(language: string, command?: object, signal?: AbortSignal) {
  const response = await fetch('/api/community/mcp' + (command ? '' : '/read'), { method: command ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-community-request': '1', 'x-market-language': language }, ...(command ? { body: JSON.stringify(command) } : {}), signal });
  const value = await response.json();
  if (!response.ok) throw Error(typeof value?.error === 'string' ? value.error : 'MCP operation failed');
  return value;
}
function inventory(value: unknown): Row[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.version !== 'string' || !Number.isInteger(row.revision) || !states.includes(row.state) || !Array.isArray(row.tools) || row.tools.some((name: unknown) => typeof name !== 'string'))) throw Error('Invalid MCP response');
  return value;
}
export function McpActions({ item, visible = true }: { item?: Resource; visible?: boolean }) {
  const { language, t, text } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null), [choice, setChoice] = useState(''), [values, setValues] = useState<Record<string, string>>({});
  const [action, setAction] = useState<{ action: string; row: Row } | null>(null);
  const guard = useRef(false);
  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController(); let reading = false;
    const read = async () => { if (reading) return; reading = true; try { const value = inventory(await call(language, undefined, abort.signal)); if (!abort.signal.aborted) setRows(value); } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : t('mcpFailed')); } finally { reading = false; } };
    void read(); const timer = setInterval(() => void read(), 5000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [visible, language, refresh]);
  const selected = plan?.choices.find(value => value.id === choice);
  const installed = item && rows.find(row => row.id === item.id);
  const shown = item ? installed ? [installed] : [] : rows;
  function select(id: string, prepared = plan) {
    setChoice(id); setValues(Object.fromEntries((prepared?.choices.find(value => value.id === id)?.fields || []).filter(field => !field.secret && field.default !== undefined).map(field => [field.key, field.default!])));
  }
  async function prepare() {
    if (!item || guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try {
      const value = await call(language, { action: 'prepare', id: item.id, revision: item.revision });
      if (value.id !== item.id || value.revision !== item.revision || !Array.isArray(value.choices) || value.choices.some((entry: Choice) => typeof entry.id !== 'string' || typeof entry.label !== 'string' || typeof entry.supported !== 'boolean' || !Array.isArray(entry.fields))) throw Error('Invalid MCP preview');
      setPlan(value); select(value.choices.find((entry: Choice) => entry.supported)?.id || '', value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('mcpFailed')); }
    finally { guard.current = false; setBusy(false); }
  }
  async function execute() {
    if (guard.current || (!plan && !action)) return;
    guard.current = true; setBusy(true); setError('');
    try {
      const command = action ? { action: action.action, id: action.row.id, revision: action.row.revision } : { action: 'connect', id: plan!.id, revision: plan!.revision, choice, values };
      inventory([await call(language, command)]); setValues({}); setPlan(null); setAction(null); setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('mcpFailed')); }
    finally { guard.current = false; setBusy(false); }
  }
  return <section hidden={!visible} className="mcp-manager" aria-label={t('mcpInstalled')}>
    {!item && <h2>{t('mcpInstalled')}</h2>}
    {error && !plan && !action && <p role="alert">{text(error)}</p>}
    {shown.map(row => <article className="market-row" key={row.id}><div><strong>{row.name}</strong><p>{row.version} · {t(`mcpState-${row.state}`)}</p>
      {!!row.tools.length && <details><summary>{t('mcpTools', { count: row.tools.length })}</summary><ul>{row.tools.map(name => <li key={name}><code>{name}</code></li>)}</ul></details>}
      <div className="actions">{['enable', 'disable', 'remove'].filter(key => key === 'remove' || key === (row.state === 'disabled' ? 'enable' : 'disable')).map(key => <Button key={key} disabled={busy} onClick={() => { setError(''); setAction({ action: key, row }); }}>{t('mcp-' + key)}</Button>)}</div>
    </div></article>)}
    {item && !installed && <Button variant="primary full" disabled={busy} onClick={() => void prepare()}>{t('mcpConfigure')}</Button>}
    {!item && !rows.length && <p>{t('mcpEmpty')}</p>}
    {(plan || action) && <Dialog title={t(action ? 'mcp-' + action.action : 'mcpReview')} close={() => { if (!busy) { setPlan(null); setAction(null); setValues({}); } }}>
      <p>{t(action ? 'mcpManageNotice' : 'mcpConnectNotice')}</p>
      {plan && <><label>{t('mcpChoice')}<select value={choice} disabled={busy} onChange={event => select(event.target.value)}>{plan.choices.map(value => <option key={value.id} value={value.id} disabled={!value.supported}>{value.label}</option>)}</select></label>
        {plan.choices.filter(value => !value.supported).map(value => <p key={value.id}>{value.label}: {text(value.reason || '')}</p>)}
        {selected?.fields.map(field => field.choices ? <label key={field.key}>{field.label}{field.required && ' *'}<select value={values[field.key] || ''} disabled={busy} onChange={event => setValues(values => ({ ...values, [field.key]: event.target.value }))}><option value="">—</option>{field.choices.map(value => <option key={value}>{value}</option>)}</select></label> : <Field key={field.key} label={field.label + (field.required ? ' *' : '')} type={field.secret ? 'password' : 'text'} autoComplete="off" value={values[field.key] || ''} disabled={busy} maxLength={8192} onChange={event => setValues(values => ({ ...values, [field.key]: event.target.value }))} />)}
      </>}
      {error && <p role="alert">{text(error)}</p>}<Button variant="primary" disabled={busy || Boolean(plan && (!selected?.supported || selected.fields.some(field => field.required && !values[field.key])))} onClick={() => void execute()}>{t(busy ? 'processing' : 'mcpConfirm')}</Button>
    </Dialog>}
  </section>;
}
