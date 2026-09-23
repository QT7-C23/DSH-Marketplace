import React, { useRef, useState } from 'react';
import { type Resource } from '../../community/contracts.mjs';
import { Button, Dialog, Field } from './components';
import { useLanguage } from './i18n';

export function CommandAction({ item, run }: { item: Resource; run: (item: Resource, argument: string) => Promise<string> }) {
  const { t, text } = useLanguage();
  const [opened, setOpened] = useState(false), [argument, setArgument] = useState('');
  const [result, setResult] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const guard = useRef(false);
  async function execute() {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try { setResult(await run(item, argument)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('commandFailed')); }
    finally { guard.current = false; setBusy(false); }
  }
  return <><Button variant="primary full" onClick={() => { setOpened(true); setError(''); setResult(''); }}>{t('commandOpen')}</Button>
    {opened && <Dialog title={t('commandReview')} close={() => { if (!busy) setOpened(false); }}>
      <p>{t('commandNotice')}</p><code>{item.command || item.title}</code>
      <Field label={t('commandArgument')} value={argument} disabled={busy} onChange={event => setArgument(event.target.value)} maxLength={4000} />
      {error && <p role="alert">{text(error)}</p>}{result ? <p role="status">{text(result)}</p> : <Button variant="primary" disabled={busy} onClick={() => void execute()}>{t(busy ? 'processing' : 'commandExecute')}</Button>}
    </Dialog>}</>;
}
