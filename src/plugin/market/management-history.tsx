import React, { useEffect, useState } from 'react';
import { Button } from './components';
import { useLanguage } from './i18n';
import { operationStatus } from '../../community/operation-status.mjs';
import { removalList } from '../../sources/removals.mjs';

function useStatus<T>(route: string, validate: (value: unknown) => T, change: string | number) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setError(false);
    fetch('/api/community/' + route, { signal: abort.signal, credentials: 'same-origin' })
      .then(async response => { if (!response.ok) throw Error(); return validate(await response.json()); })
      .then(value => { if (!abort.signal.aborted) setData(value); })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [route, validate, revision, change]);
  return { data, error, refresh: () => setRevision(value => value + 1) };
}
export function OperationHistory({ revision }: { revision: number }) {
  const { t, language } = useLanguage(), { data, error, refresh } = useStatus('operations', operationStatus, revision);
  return <section className="settings-section" aria-label={t('operationHistory')}>
    <div className="section-head"><h2>{t('operationHistory')}</h2><Button onClick={refresh}>{t('refresh')}</Button></div>
    {error && <p role="alert">{t('historyReadError')}</p>}
    {data?.blocked && <p role="alert">{t('operationBlocked')} {data.operationId && <code>{data.operationId}</code>}</p>}
    <p className="fine-print">{t('operationHistoryNote')}</p>
    {data && !data.recent.length && <p>{t('operationEmpty')}</p>}
    {!!data?.recent.length && <details><summary>{t('operationRecent')}</summary><ul>{data.recent.map(row => <li key={row.operationId}>
      <strong>{row.name}</strong> · {t('operationAction_' + row.action)} · {t('operationPhase_' + row.phase)}<br />
      <time dateTime={row.at}>{new Date(row.at).toLocaleString(language)}</time> · <code>{row.operationId}</code>
    </li>)}</ul></details>}
  </section>;
}
export function WithdrawalHistory({ revision }: { revision: string }) {
  const { t } = useLanguage(), { data, error, refresh } = useStatus('withdrawals', removalList, revision);
  const [limit, setLimit] = useState(20);
  return <section className="settings-section" aria-label={t('withdrawalHistory')}>
    <div className="section-head"><h2>{t('withdrawalHistory')}</h2><Button onClick={refresh}>{t('refresh')}</Button></div>
    <p>{t('withdrawalNote')}</p>{error && <p role="alert">{t('historyReadError')}</p>}
    {data && !data.length && <p>{t('withdrawalEmpty')}</p>}
    {!!data?.length && <details><summary>{t('withdrawalCount', { count: data.length })}</summary><ul>{data.slice(0, limit).map(row => <li key={row.id}>
      <code>{row.id}</code> · {row.reason} · <a href={row.issue} target="_blank" rel="noopener noreferrer">{t('withdrawalDecision')}</a>
    </li>)}</ul>{data.length > limit && <Button onClick={() => setLimit(value => value + 20)}>{t('loadMore')}</Button>}</details>}
  </section>;
}
