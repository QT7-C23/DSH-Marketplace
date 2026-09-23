import React from 'react';
import { type MarketController, type State, curated } from './controller';
import { Button } from './components';
import { languageNames } from '../../../languages/index.mjs';
import { useLanguage } from './i18n';
import { GitHubSettings } from './github-settings';
import { WithdrawalHistory } from './management-history';

export function Sources({ state, model }: { state: State; model: MarketController }) {
  const { t, language, text } = useLanguage();
  const time = (value: string) => value ? new Date(value).toLocaleString(language) : t('never');
  return <>
    <div className="page-heading"><h1>{t('settings')}</h1><p>{t('settingsNote')}</p></div>
    <section className="settings-section"><label className="setting-line"><span><strong>{t('language')}</strong><small>{t('languageNote')}</small></span>
      <select aria-label={t('language')} value={state.local.language} onChange={event => model.setLanguage(event.target.value)}>{Object.entries(languageNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    </label></section>
    <GitHubSettings />
    <WithdrawalHistory revision={state.sources.map(source => source.checkedAt).join('|')} />
    <h2 className="settings-heading">{t('sources')}</h2>
    <div className="market-list">
      {state.sources.map(source => <section className="source-row" aria-label={source.name} key={source.id}><div className="section-head">
        <h3>{t(`sourceName_${source.id}`)}</h3><span className="fine-print" role="status">{t(source.syncing ? 'syncing' : source.state)}</span>
      </div>
        <p>{t('sourceCount', { count: source.count })} · {t('lastSuccess', { time: time(source.lastSuccess) })}</p>
        <p className="fine-print">{t(`sourceDescription_${source.id}`)}</p><p className="fine-print">{source.automaticDiscovery ? t('autoNote') : t('fixedSource')}</p>
        {source.automaticDiscovery && <p className="fine-print">{t(source.automatic ? 'autoOn' : 'autoOff')}{source.automatic && !source.syncing && ' · ' + (Date.parse(source.nextCheckAt || '') > Date.now() ? t('nextCheck', { time: time(source.nextCheckAt || '') }) : t('soon'))}</p>}
        {source.error && <p role="alert">{text(source.error)}</p>}
        {source.discovery && <div className="discovery-report"><p>{t('scanResult', { scanned: source.discovery.scanned, count: source.count, excluded: source.discovery.excluded.length })}</p>
          {source.discovery.excluded.length > 0 && <details><summary>{t('exclusions')}</summary><ul>{source.discovery.excluded.map(row => <li key={row.name}><code>{row.name}</code> — {text(row.reason)}</li>)}</ul></details>}
        </div>}
        <div className="source-actions"><a href={source.url} target="_blank" rel="noopener noreferrer">{t('sourceLink')}</a><div className="actions">
          {source.automaticDiscovery && <Button disabled={Boolean(state.sourcePending)} onClick={() => void model.setSourceAutomatic(source.id, !source.automatic)}>{t(source.automatic ? 'pause' : 'resume')}</Button>}
          <Button aria-label={t('updateSource', { name: source.name })} disabled={Boolean(state.sourcePending) || source.syncing} onClick={() => void model.syncSource(source.id)}>{t(source.syncing || state.sourcePending === source.id ? 'syncing' : 'sync')}</Button>
        </div></div>
      </section>)}
      {!state.sources.length && <p>{t('loading')}</p>}
      <section className="source-row"><h3>{t('promptSource')}</h3><p>{t('sourceCount', { count: curated.length })} · {t('promptSourceNote')}</p><a href="https://github.com/QT7-C23/DSH-Marketplace" target="_blank" rel="noopener noreferrer">{t('repository')}</a></section>
    </div>
  </>;
}
