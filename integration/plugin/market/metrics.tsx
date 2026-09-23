import React, { useEffect, useState } from 'react';
import { type Resource, type Stats, type ExportFile } from '../../../community/contracts.mjs';
import { type State, type MarketController } from './controller';
import { Button } from './components';
import { useLanguage } from './i18n';
import { repositoryOf, type RepositoryStar } from '../../../community/metrics.mjs';
import { npmPackageOf, npmSnapshot, type NpmCount } from '../../../community/npm-metrics.mjs';

function NpmMetric({ item }: { item: Resource }) {
  const { t, language } = useLanguage();
  const name = npmPackageOf(item);
  const [value, setValue] = useState<NpmCount | null>(null);
  useEffect(() => {
    setValue(null);
    if (!name || item.status === 'sample') return;
    const abort = new AbortController();
    fetch('/api/community/npm-downloads?ids=' + encodeURIComponent(item.id), { signal: abort.signal, credentials: 'same-origin' })
      .then(async response => { if (!response.ok) throw Error(); return npmSnapshot(await response.json()); })
      .then(data => { if (!abort.signal.aborted) setValue(data[name] || null); }).catch(() => {});
    return () => abort.abort();
  }, [name, item.id, item.status]);
  if (!name) return null;
  const count = value?.count == null ? '—' : new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(value.count);
  return <span className="npm-downloads" title={t('npmDownloadTooltip', { name, start: value?.start || '—', end: value?.end || '—' })}><MetricIcon type="download" />{t('npmDownloadCount', { count })}{value?.state === 'stale' ? ' · ' + t('cached') : ''}</span>;
}

function MetricIcon({ type }: { type: 'download' | 'save' | 'star' | 'rating' }) {
  return <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type === 'download' ? <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /> : type === 'save' ? <path d="M6 4h12v17l-6-4-6 4Z" /> : type === 'rating' ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> : <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />}</svg>;
}

export function ResourceStats({ item, value, stars, loading, saved, rating }: { item: Resource; value?: Stats; stars: Record<string, RepositoryStar>; loading: boolean; saved: boolean; rating?: number }) {
  const { t, language } = useLanguage();
  const repo = repositoryOf(item.url);
  const star = repo ? stars[repo] : undefined;
  const number = (value: number) => new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return <span className="resource-stats" aria-label={t('stats')}>
    <NpmMetric item={item} />
    <span title={t('downloadTooltip')}><MetricIcon type="download" />{t('downloadCount', { count: value ? number(value.downloads) : '—' })}</span>
    <span className="repo-stars" title={repo ? t('starTooltip', { repo }) : t('notApplicable')}><MetricIcon type="star" />{t('stars')} {star?.count != null ? number(star.count) + (star.state === 'stale' ? ' · ' + t('cached') : '') : !repo ? '—' : t(loading ? 'loading' : 'unavailable')}</span>
    <span><MetricIcon type="save" />{t(saved ? 'favorite' : 'notSaved')}</span>
    <span><MetricIcon type="rating" />{rating ? t('rated', { score: rating }) : t('noRating')}</span>
  </span>;
}

export function Rating({ item, state, model }: { item: Resource; state: State; model: MarketController }) {
  const mine = state.local.ratings[item.id];
  const [score, setScore] = useState(mine ? String(mine) : '');
  const { t } = useLanguage();
  return <section className="resource-rating">
    <h2>{t('rating')}</h2><p className="fine-print">{t('ratingNote')}</p>
    <form onSubmit={event => { event.preventDefault(); model.rateLocal(item.id, Number(score)); }}>
      <label className="field"><span>{t('rating')}</span><select aria-label={t('rating')} value={score} onChange={event => setScore(event.target.value)} required><option value="">{t('chooseRating')}</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
      <div className="form-actions"><Button type="submit">{t('submitRating')}</Button>{mine && <Button onClick={() => { if (model.rateLocal(item.id, null)) setScore(''); }}>{t('removeRating')}</Button>}</div>
    </form>
  </section>;
}

/** Browser download is an explicit user action; no resource instructions are executed. */
export function saveFile(file: ExportFile) {
  const content = file.encoding === 'base64' ? Uint8Array.from(atob(file.content), value => value.charCodeAt(0)) : file.content;
  const url = URL.createObjectURL(new Blob([content], { type: file.mime }));
  const link = document.createElement('a');
  link.href = url; link.download = file.filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
