import React from 'react';
import { type Resource } from '../../community/contracts.mjs';
import { repositoryOf } from '../../community/metrics.mjs';
import { useLanguage, typeKey } from './i18n';

export function ResourceFacts({ item }: { item: Resource }) {
  const { t, text, language } = useLanguage();
  const checked = item.updatedAt && Number.isFinite(Date.parse(item.updatedAt)) ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(item.updatedAt)) : null;
  const removal = new URL('https://github.com/QT7-C23/DSH-Marketplace/issues/new');
  removal.searchParams.set('template', '04-resource-removal.yml'); removal.searchParams.set('resource-name', item.title);
  removal.searchParams.set('links', `${item.id}\n${item.url}`);
  return <section className="resource-facts" aria-label={t('resourceFacts')}><h3>{t('resourceFacts')}</h3><dl>
    <dt>{t('version')}</dt><dd>{item.version}</dd>
    <dt>{t('author')}</dt><dd>{item.author}</dd>
    <dt>{t('license')}</dt><dd>{item.license || t('notProvided')}</dd>
    <dt>{t('source')}</dt><dd>{text(item.source)}</dd>
    {repositoryOf(item.url) && <><dt>GitHub</dt><dd>{repositoryOf(item.url)}</dd></>}
    {checked && <><dt>{t('catalogChecked')}</dt><dd>{checked}</dd></>}
    {(item.packageRef || item.bundle?.kind === 'npm-package') && <><dt>{t('packageName')}</dt><dd><code>{item.packageRef?.name || (item.bundle?.kind === 'npm-package' ? item.bundle.name : '')}</code></dd></>}
    {item.bundle?.kind === 'github-skill' && <><dt>{t('packageFiles')}</dt><dd>{item.bundle.files.length}</dd></>}
  </dl><a href={removal.href} target="_blank" rel="noopener noreferrer">{t('requestWithdrawal')}</a></section>;
}
export function UsageGuide({ item }: { item: Resource }) {
  const { t, text } = useLanguage();
  const key = typeKey(item.type);
  return <section className="usage-guide"><h2>{t('howToUse')}</h2><ol>
    {[1, 2, 3].map(step => <li key={step}>{t(`${key}Step${step}`)}</li>)}
  </ol>{item.requirements && <div className="requirements-note"><h3>{t('requirements')}</h3><p>{text(item.requirements)}</p></div>}</section>;
}
