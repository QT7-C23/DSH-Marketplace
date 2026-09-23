import React, { useEffect, useRef, useState } from 'react';
import { type Resource } from '../../../community/contracts.mjs';
import { Button, Dialog } from './components';
import { useLanguage } from './i18n';

type SkillRow = { id: string; revision: number; name: string; version: string; state: string };
const states = ['installed', 'loaded', 'modified', 'shadowed', 'unavailable', 'disabled', 'removed', 'recovery-required'];
async function call(language: string, command?: object, signal?: AbortSignal): Promise<SkillRow[]> {
  const response = await fetch('/api/community/skills' + (command ? '' : '/read'), { method: command ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-community-request': '1', 'x-market-language': language }, ...(command ? { body: JSON.stringify(command) } : {}), signal });
  const value = await response.json();
  if (!response.ok) throw Error(typeof value?.error === 'string' ? value.error : 'Skill operation failed');
  const rows = command ? [value] : value;
  if (!Array.isArray(rows) || rows.some(row => !row || !['id', 'name', 'version'].every(key => typeof row[key] === 'string') || !Number.isInteger(row.revision) || !states.includes(row.state))) throw Error('Invalid Skill response');
  return rows;
}

export function SkillActions({ item, catalog = [], visible = true, canInstall = true }: { item?: Resource; catalog?: Resource[]; visible?: boolean; canInstall?: boolean }) {
  const { language, t, text } = useLanguage();
  const [rows, setRows] = useState<SkillRow[]>([]), [error, setError] = useState('');
  const [operation, setOperation] = useState<{ action: string; row: SkillRow } | null>(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const guard = useRef(false);
  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    call(language, undefined, abort.signal).then(setRows).catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [visible, language, revision]);
  const installed = item && rows.find(row => row.id === item.id);
  const opened = !!operation;
  async function execute() {
    if (!operation || guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try { await call(language, { action: operation.action, id: operation.row.id, revision: operation.row.revision }); setRevision(value => value + 1); setOperation(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('skillFailed')); }
    finally { guard.current = false; setBusy(false); }
  }
  return <section hidden={!visible} className="skill-manager" aria-label={t('skillInstalled')}>
    {!item && <h2>{t('skillInstalled')}</h2>}
    {error && !opened && <p role="alert">{text(error)}</p>}
    {(item ? installed ? [installed] : [] : rows).map(row => {
      const latest = [item, ...catalog].find(resource => resource?.id === row.id && resource.revision > row.revision);
      const mutable = !['modified', 'recovery-required', 'removed'].includes(row.state);
      return <article key={row.id} className="market-row"><div><strong>{row.name}</strong><p>{row.version} · {t(`skillState-${row.state}`)}</p>{row.state === 'loaded' && <p>{t('skillUse', { name: row.name })}</p>}</div>
        <div className="actions">{mutable && <>
          <Button disabled={busy} onClick={() => setOperation({ action: row.state === 'disabled' ? 'enable' : 'disable', row })}>{t(row.state === 'disabled' ? 'skillEnable' : 'skillDisable')}</Button>
          {latest && <Button disabled={busy} onClick={() => setOperation({ action: 'update', row: { ...row, revision: latest.revision, version: latest.version } })}>{t('skillUpdate')} {latest.version}</Button>}
          <Button disabled={busy} onClick={() => setOperation({ action: 'remove', row })}>{t('skillRemove')}</Button>
        </>}{row.state !== 'modified' && <Button disabled={busy} onClick={() => setOperation({ action: 'restore', row })}>{t('skillRestore')}</Button>}</div>
      </article>;
    })}
    {!item && !rows.length && <p>{t('skillEmpty')}</p>}
    {item && !installed && <Button variant="primary full" disabled={busy || !canInstall} onClick={() => { setOperation({ action: 'install', row: { id: item.id, revision: item.revision, version: item.version, name: item.title, state: '' } }); setError(''); }}>{t('skillInstall')}</Button>}
    <Button variant="ghost" disabled={busy} onClick={() => { setError(''); setRevision(value => value + 1); }}>{t('skillCheck')}</Button>
    {operation && <Dialog title={t('skillReview')} close={() => { if (!busy) setOperation(null); }}>
      <p>{operation.row.name} · {operation.row.version} · {t(`skillAction-${operation.action}`)}</p><p>{t(operation.action === 'install' ? 'skillInstallNotice' : operation.action === 'restore' ? 'skillRestoreNotice' : 'skillManageNotice')}</p>
      {operation.action === 'install' && item && <p>{t('packageNote', { count: item.bundle?.kind === 'github-skill' ? item.bundle.files.length : 0 })}</p>}
      {error && <p role="alert">{text(error)}</p>}<Button variant="primary" disabled={busy} onClick={() => void execute()}>{t(busy ? 'processing' : 'skillConfirm')}</Button>
    </Dialog>}
  </section>;
}
