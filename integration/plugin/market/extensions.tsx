import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Empty, Field } from './components';
import { useLanguage } from './i18n';
import { ExtensionClient, type ExtensionInventory, type ExtensionPlan, type ExtensionResult } from './extensions.mjs';

export function Extensions({ visible, initialSpec }: { visible: boolean; initialSpec: string }) {
  const { language, t, text } = useLanguage();
  const client = useMemo(() => new ExtensionClient(), []);
  const [inventory, setInventory] = useState<ExtensionInventory | null>(null);
  const [spec, setSpec] = useState(initialSpec);
  const [plan, setPlan] = useState<ExtensionPlan | null>(null);
  const [result, setResult] = useState<ExtensionResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [revision, setRevision] = useState(0);
  const guard = useRef(false);
  useEffect(() => { if (initialSpec) setSpec(initialSpec); }, [initialSpec]);
  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    setReading(true);
    client.read(language, abort.signal).then(value => { if (!abort.signal.aborted) setInventory(value); }).catch(cause => { if (!abort.signal.aborted) { setInventory(null); setError(cause.message); } }).finally(() => { if (!abort.signal.aborted) setReading(false); });
    return () => abort.abort();
  }, [client, visible, language, revision]);
  async function prepare(command: { action: string; spec?: string; name?: string }) {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError(''); setResult(null); setPlan(null);
    try { setPlan(await client.prepare(command, language)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('extFailed')); }
    finally { guard.current = false; setBusy(false); }
  }
  async function execute() {
    if (!plan || guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try { setResult(await client.execute(plan, language)); setRevision(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('extFailed')); }
    finally { guard.current = false; setBusy(false); }
  }
  const issueText = (issue: string) => t(['dual-entry', 'host-version', 'node-version', 'host-facet-version'].includes(issue) ? `extIssue-${issue}` : 'extIssue-contract');
  return <section hidden={!visible} className="extension-manager" aria-label={t('extInstalled')}>
    <div className="page-heading"><h1>{t('extInstalled')}</h1><p>{t('extIntro')}</p></div>
    <div className="section-head"><p>{inventory ? t('extEnvironment', { profile: inventory.profile, version: inventory.hostVersion }) : t('extEnvironmentUnknown')}</p><Button disabled={busy || reading} onClick={() => { setError(''); setRevision(value => value + 1); }}>{t(reading ? 'loading' : 'refresh')}</Button></div>
    {error && !plan && <p role="alert" className="market-error">{text(error)}</p>}
    {result && !plan && <p role="status">{t(`extResult-${result.status}`)} <code>{result.operationId}</code></p>}
    <form className="extension-install" onSubmit={event => { event.preventDefault(); void prepare({ action: 'prepare-install', spec: spec.trim() }); }}>
      <Field label={t('extPackage')} placeholder="package-name@1.0.0" value={spec} onChange={event => setSpec(event.target.value)} disabled={busy} />
      <Button type="submit" disabled={!spec.trim() || busy || !inventory}>{t(busy ? 'processing' : 'extPreview')}</Button>
    </form>
    <p className="fine-print">{t('extPackageHelp')}</p>
    {inventory?.adapter === 'missing' && <div className="extension-note"><p>{t('extAdapterMissing')}</p><Button disabled={busy} onClick={() => void prepare({ action: 'prepare-install', spec: '@dsh-std/adapter-dsh@0.1.1-rc.3' })}>{t('extPrepareAdapter')}</Button></div>}
    {inventory && !inventory.complete && <p role="alert">{t('extPartial')}</p>}
    {inventory && !inventory.items.length && <Empty title={t('extEmpty')} />}
    <div className="market-list">{inventory?.items.map(item => <article key={item.name} className="market-row extension-row">
      <div><h2>{item.name}</h2><p>{item.version} · {t(`extRoute-${item.route}`)} · <span>{t(`extState-${item.state}`)}</span></p></div>
      <div className="actions"><Button disabled={busy || !item.installed} onClick={() => setSpec(`${item.name}@${item.version}`)}>{t('extChooseVersion')}</Button><Button disabled={busy || !item.removable || item.state === 'restart-required'} onClick={() => void prepare({ action: 'prepare-remove', name: item.name })}>{t('extRemove')}</Button></div>
    </article>)}</div>
    <p className="fine-print">{t('extStateNote')}</p>
    {visible && plan && <Dialog title={t(plan.action === 'install' ? 'extReviewInstall' : 'extReviewRemove')} close={() => { if (!busy) { setPlan(null); setError(''); } }}>
      <dl className="extension-review"><dt>{t('extPackage')}</dt><dd><code>{plan.name}@{plan.version}</code></dd><dt>{t('extTarget')}</dt><dd>{plan.profile} · DSH {plan.hostVersion}</dd><dt>{t('extRoute')}</dt><dd>{t(`extRoute-${plan.compatibility.route || 'dual'}`)}</dd><dt>{t('extCompatibility')}</dt><dd>{t(`extCheck-${plan.compatibility.state}`)}</dd><dt>{t('license')}</dt><dd>{plan.license || t('notProvided')}</dd></dl>
      {plan.source && <p><a href={plan.source} target="_blank" rel="noopener noreferrer">{t('extArtifact')}</a></p>}
      {!!plan.compatibility.issues.length && <ul>{plan.compatibility.issues.map(issue => <li key={issue}>{issueText(issue)}</li>)}</ul>}
      <p>{t('extPermissions')}</p>{plan.permissions.length ? <ul>{plan.permissions.map((permission, index) => <li key={index}>{permission.name} · {permission.scope}</li>)}</ul> : <p className="fine-print">{t('extNoPermissions')}</p>}
      <p>{t(plan.action === 'install' ? 'extExecutionNotice' : 'extRemoveNotice')}</p>
      {error && <p role="alert" className="market-error">{text(error)} {t('extRetryNotice')}</p>}
      {result ? <div role="status"><p>{t(`extResult-${result.status}`)}</p><p>{t('extOperation')} <code>{result.operationId}</code></p></div> : <Button variant="primary" disabled={!plan.allowed || busy} onClick={() => void execute()}>{t(busy ? 'processing' : plan.action === 'install' ? 'extConfirmInstall' : 'extConfirmRemove')}</Button>}
    </Dialog>}
  </section>;
}
