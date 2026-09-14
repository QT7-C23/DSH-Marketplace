import React, { useEffect, useRef, useState } from 'react';
import { Button, Field } from './components';
import { useLanguage } from './i18n';

type Status = { configured: boolean; state: string; limit?: number; remaining?: number; resetAt?: string; checkedAt?: string };
const states = ['anonymous', 'unchecked', 'connected', 'limited', 'unreadable', 'invalid', 'unavailable'];
function parseStatus(value: unknown): Status {
  const data = value as Status;
  if (!data || typeof data.configured !== 'boolean' || !states.includes(data.state)) throw Error();
  if (data.limit !== undefined && (!Number.isSafeInteger(data.limit) || !Number.isSafeInteger(data.remaining) || data.remaining! < 0 || data.remaining! > data.limit || !Number.isFinite(Date.parse(data.resetAt || '')))) throw Error();
  return { configured: data.configured, state: data.state, limit: data.limit, remaining: data.remaining, resetAt: data.resetAt, checkedAt: data.checkedAt };
}

export function GitHubSettings() {
  const { t, language, text } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void fetch('/api/community/github/read', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error();
      const value = parseStatus(await response.json());
      if (!controller.signal.aborted) setStatus(value);
    }).catch(() => { if (!controller.signal.aborted) setError('GitHub 连接失败，请稍后重试'); });
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  async function run(action: 'save' | 'check' | 'remove') {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    const command = action === 'save' ? { action, token: token.trim() } : { action };
    if (action === 'save') setToken('');
    try {
      const response = await fetch('/api/community/github', { method: 'POST', headers: { 'content-type': 'application/json', 'x-community-request': '1', 'x-market-language': language }, body: JSON.stringify(command) });
      const data = await response.json();
      if (!response.ok) {
        if (mounted.current) setError(typeof data.error === 'string' ? data.error : 'GitHub 连接失败，请稍后重试');
        const latest = await fetch('/api/community/github/read', { cache: 'no-store' });
        if (latest.ok) { const next = parseStatus(await latest.json()); if (mounted.current) setStatus(next); }
        return;
      }
      const next = parseStatus(data);
      if (mounted.current) setStatus(next);
    } catch { if (mounted.current) setError('GitHub 连接失败，请稍后重试'); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="settings-section github-settings" aria-label={t('githubTitle')}>
    <h2>{t('githubTitle')}</h2><p className="fine-print">{t('githubNote')}</p>
    <p role="status">{status ? t(`githubState_${status.state}`) : t('loading')}</p>
    {status?.limit !== undefined && <p className="fine-print">{t('githubQuota', { remaining: status.remaining!, limit: status.limit, time: new Date(status.resetAt!).toLocaleString(language) })}</p>}
    <form onSubmit={event => { event.preventDefault(); void run('save'); }} autoComplete="off">
      <Field label={t('githubToken')} type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="new-password" spellCheck={false} maxLength={256} disabled={busy} />
      <div className="actions"><Button type="submit" disabled={busy || !token.trim()}>{t('githubSave')}</Button>
        <Button disabled={busy} onClick={() => void run('check')}>{t('githubCheck')}</Button>
        <Button disabled={busy || !status?.configured} onClick={() => void run('remove')}>{t('githubRemove')}</Button></div>
    </form>
    {busy && <p role="status">{t('githubBusy')}</p>}
    {error && <p role="alert">{text(error)}</p>}
  </section>;
}
