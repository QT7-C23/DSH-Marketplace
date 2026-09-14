import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RESOURCE_TYPES, type Resource } from '../../../community/contracts.mjs';
import { type MarketController, type View, samples, curated } from './controller';
import { Surface, Button, Empty, Dialog, ResourceIcon } from './components';
import { Editor } from './editor';
import { ResourceStats, Rating, saveFile } from './metrics';
import { Featured } from './featured';
import { MarketLogo } from './logo';
import { repositoryOf, sortResources } from '../../../community/metrics.mjs';
import { CATEGORIES, categoryOf } from '../../../catalog/categories.mjs';
import { Sources } from './sources';
import { LanguageContext, useLanguage, typeKey } from './i18n';
import { ResourceDocumentation } from './documentation';
import { HostPresence, ResourceReadiness, useAvailability } from './availability';
import { ResourceFacts, UsageGuide } from './resource-info';
import { Extensions } from './extensions';

export type MarketProps = { model: MarketController; usePrompt: (item: Resource) => void };
const featuredPrompt = curated.find(item => item.id === 'github-code-reviewer');
export function Market(props: MarketProps) {
  const state = useSyncExternalStore(props.model.subscribe, props.model.getSnapshot);
  return <LanguageContext.Provider value={state.local.language}><MarketPage {...props} /></LanguageContext.Provider>;
}
function MarketPage({ model, usePrompt }: MarketProps) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const { t, language, text } = useLanguage();
  const availability = useAvailability();
  const [remove, setRemove] = useState<Resource | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [installSpec, setInstallSpec] = useState('');
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => { mainRef.current?.closest('.community-market')?.scrollTo({ top: 0 }); }, [state.view, state.detail?.id]);
  useEffect(() => setDetailTab('overview'), [state.detail?.id]);
  useEffect(() => {
    void model.refresh(); void model.refreshStars(); void model.readSources();
    const poll = setInterval(() => void model.readSources(), 5000);
    return () => clearInterval(poll);
  }, [model]);
  useEffect(() => {
    if (!state.dirty) return;
    const stop = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, [state.dirty]);
  const { data, detail: item } = state;
  const localItem = item && state.local.saved.find(value => value.id === item.id);
  const activeBundle = item?.bundle && data?.catalog.some(value => value.id === item.id && value.revision === item.revision);
  const parent = item?.parentId ? data?.catalog.find(value => value.id === item.parentId) : null;
  const library = ['saved', 'updates', 'installed'].includes(state.view);
  const replacements: Record<string, string> = { 'plan-plugin': 'source-dsh-plan-mode', 'plan-command': 'source-slash-plan', 'internal-comms': 'source-skill-internal-comms' };
  const visibleSamples = samples.filter(sample => !data?.catalog.some(value => value.id === replacements[sample.id]));
  const listed = state.view === 'saved' ? state.local.saved : [...(data?.catalog || curated), ...visibleSamples];
  const personalStats = Object.fromEntries(listed.map(resource => [resource.id, { downloads: data?.stats[resource.id]?.downloads ?? 0, saves: Number(state.local.saved.some(saved => saved.id === resource.id)), ratingAverage: state.local.ratings[resource.id] ?? null }]));
  const filtered = sortResources(listed.filter(value => (state.filter === '全部' || state.filter === value.type) && (state.category === 'all' || categoryOf(value) === state.category) && `${value.title} ${value.summary} ${value.author}`.toLowerCase().includes(state.query.toLowerCase())), state.sort, personalStats, state.stars);
  const emptyThemes = state.view === 'discover' && state.filter === '主题' && !state.query && state.category === 'all' && Boolean(data) && !state.loading && !state.error && !listed.some(value => value.type === '主题');
  const updates = state.local.saved.flatMap(saved => { const latest = data?.catalog.find(value => value.id === saved.id && value.revision > saved.revision); return latest ? [{ saved, latest }] : []; });
  const navigate = (view: View) => view === 'publish' ? model.edit() : model.navigate(view);
  const stats = (resource: Resource) => <ResourceStats item={resource} value={data?.stats[resource.id]} stars={state.stars} loading={state.starsLoading} saved={state.local.saved.some(saved => saved.id === resource.id)} rating={state.local.ratings[resource.id]} />;
  const card = (value: Resource) => <button key={value.id} className="resource-card" onClick={() => model.open(value)} aria-label={t('view', { title: value.title })}>
    <div className="card-head"><ResourceIcon type={value.type} /><div><h2>{value.title}</h2><span className="card-byline">{value.author}</span></div><span className="card-version" title={t('version')}>{value.version}</span></div>
    <p className="card-summary">{value.summary}</p>
    <div className="card-tags"><span>{t(typeKey(value.type))}</span><span>{t(categoryOf(value))}</span>{value.status === 'sample' && <span>{t('sample')}</span>}</div>
    <div className="card-availability"><ResourceReadiness item={value} availability={availability} /><span className="card-license">{value.license || t('notProvided')}</span></div>
    <span className="card-source" title={text(value.source)}>{repositoryOf(value.url) || text(value.source)}</span>
    {stats(value)}
  </button>;
  async function download(resource: Resource, descriptionOnly = false) { const file = await model.download(resource, descriptionOnly); if (file) saveFile(file); }
  return <Surface className="community-market">
    <header className="market-header"><div className="section-head"><strong className="market-title"><MarketLogo size={22} />{t('market')}</strong><div className="actions">
      <Button variant="ghost" onClick={() => navigate('publish')}>{t('share')}</Button>
      <Button aria-label={t('refreshLabel')} variant="ghost" disabled={state.loading || state.pending || Boolean(state.sourcePending)} onClick={() => { void model.refresh(); void model.refreshStars(); void model.readSources(); availability.refresh(); }}>{t('refresh')}</Button>
    </div></div>
      <nav className="market-nav" aria-label={t('market')}>
        {([['discover', 'discover'], ['saved', 'library'], ['sources', 'settings']] as [View, string][]).map(([view, label]) => {
          const selected = view === 'saved' ? library : view === 'discover' ? ['discover', 'detail'].includes(state.view) : state.view === view;
          return <Button key={view} variant={selected ? 'selected' : ''} aria-current={selected ? 'page' : undefined} onClick={() => navigate(view)}>{t(label)}</Button>;
        })}
      </nav>
    </header>
    <div className="market-status" role="status">{state.loading ? t('loading') : text(state.notice)}</div>
    {state.error && <div className="market-status market-error" role="alert">{text(state.error)} <Button onClick={() => void model.refresh()}>{t('retry')}</Button></div>}
    <main lang={language} ref={mainRef}>
      {library && <nav className="filter-row library-nav" aria-label={t('library')}>
        <Button variant={state.view === 'saved' ? 'selected' : 'ghost'} onClick={() => navigate('saved')}>{t('localSaved')}</Button>
        <Button variant={state.view === 'installed' ? 'selected' : 'ghost'} onClick={() => navigate('installed')}>{t('extInstalled')}</Button>
        <Button variant={state.view === 'updates' ? 'selected' : 'ghost'} onClick={() => navigate('updates')}>{t('updates')} {updates.length > 0 && updates.length}</Button>
        <Button variant="ghost" onClick={() => model.localDraft()}>{t('draftContinue')}</Button>
      </nav>}
      <Extensions visible={state.view === 'installed'} initialSpec={installSpec} />
      {['discover', 'saved'].includes(state.view) && <>
        <div className="page-heading"><h1>{t(state.view === 'discover' ? 'discoverTitle' : 'localSaved')}</h1><p>{t(library ? 'libraryNote' : 'discoverSubtitle')}</p></div>
        <div className="section-head catalog-search"><label className="search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input aria-label={t('search')} value={state.query} placeholder={t('searchHint')} onChange={event => model.search(event.target.value)} /></label>
          <select aria-label={t('sort')} value={state.sort} onChange={event => model.sort(event.target.value)}>{['recent', 'downloads', 'stars', 'saves', 'rating', 'name'].map(key => <option key={key} value={key}>{t(key)}</option>)}</select>
        </div>
        {state.view === 'discover' && !state.query && state.filter === '全部' && state.category === 'all' && featuredPrompt && <Featured open={() => model.open(featuredPrompt)} />}
        <div className="filter-row type-filters">{['全部', ...RESOURCE_TYPES].map(type => <Button key={type} variant={state.filter === type ? 'selected' : 'ghost'} aria-label={t(type === '全部' ? 'all' : typeKey(type))} aria-pressed={state.filter === type} onClick={() => model.filter(type)}>{t(type === '全部' ? 'all' : typeKey(type))}<span className="filter-count" aria-hidden="true">{type === '全部' ? listed.length : listed.filter(value => value.type === type).length}</span></Button>)}
          <span className="results-note">{t('results', { count: filtered.length })}</span>
        </div>
        {state.filter !== '全部' && <p className="type-description">{t(typeKey(state.filter) + 'Desc')}</p>}
        <div className="category-filter"><label htmlFor="market-category">{t('category')}</label><select id="market-category" value={state.category} onChange={event => model.category(event.target.value)}><option value="all">{t('all')}</option>{CATEGORIES.map(key => <option key={key} value={key}>{t(key)}</option>)}</select></div>
        {filtered.length ? <div className="resource-grid">{filtered.map(card)}</div> : <Empty title={t(emptyThemes ? 'emptyThemes' : state.query || state.filter !== '全部' || state.category !== 'all' ? 'empty' : 'emptySaved')}>{t(emptyThemes ? 'emptyThemesHelp' : 'emptyHelp')}</Empty>}
        <p className="catalog-note">{t('metricsNote')}</p>
      </>}
      {state.view === 'detail' && item && <section className="market-detail">
        <Button variant="ghost" onClick={() => model.navigate('discover')}>{t('back')}</Button>
        <div className="detail-heading"><ResourceIcon type={item.type} /><div><div className="card-tags"><span>{t(typeKey(item.type))}</span><span>{t(categoryOf(item))}</span></div><h1>{item.title}</h1><p>{item.author} · {item.version}</p><p className="detail-summary">{item.summary}</p>{stats(item)}</div></div>
        <div className="detail-layout"><div className="detail-main"><nav className="detail-tabs" aria-label={t('description')}>{['overview', 'authorDocs'].map(tab => <Button key={tab} variant={tab === detailTab ? 'selected' : 'ghost'} aria-pressed={tab === detailTab} onClick={() => setDetailTab(tab)}>{t(tab)}</Button>)}</nav>
          {detailTab === 'authorDocs' ? <ResourceDocumentation key={`${item.id}:${item.revision}`} item={item} /> : <><UsageGuide item={item} />{item.type === 'Prompt' ? <><h2>{t('promptContent')}</h2><pre className="content-preview">{item.body}</pre></> : <details><summary>{t('description')}</summary><pre className="content-preview">{item.body}</pre></details>}{item.url && <p><a href={item.url} target="_blank" rel="noopener noreferrer">{t('original')}</a></p>}</>}
          <Rating key={item.id} item={item} state={state} model={model} />
        </div><aside className="action-panel"><div className="section-head"><h2>{t('get')}</h2><ResourceReadiness item={item} availability={availability} /></div>
          <p className="fine-print">{t(item.type === 'Prompt' ? 'promptNote' : 'installNote')}</p>
          {activeBundle && item.bundle?.kind === 'npm-package' && <Button variant="primary full" onClick={() => { if (item.bundle?.kind === 'npm-package') { setInstallSpec(`${item.bundle.name}@${item.bundle.version}`); navigate('installed'); } }}>{t('extPreview')}</Button>}
          {item.type === 'Prompt' && <Button variant="primary full" onClick={() => { try { usePrompt(item); } catch (error) { model.error(error); } }}>{t('use')}</Button>}
          <Button variant={activeBundle ? 'primary full' : 'full'} disabled={state.pending} onClick={() => void download(item)}>{t(state.pending ? 'processing' : item.type === 'Prompt' ? 'downloadPrompt' : activeBundle ? item.type === 'Skill' ? 'downloadSkill' : 'downloadPlugin' : item.serverDefinition ? 'downloadMCP' : 'downloadInfo')}</Button>
          {activeBundle && <Button variant="ghost full" disabled={state.pending} onClick={() => void download(item, true)}>{t('descriptionOnly')}</Button>}
          {item.bundle?.kind === 'github-skill' && <p className="fine-print">{t('packageNote', { count: item.bundle.files.length })}</p>}
          {parent && <Button variant="full" onClick={() => model.open(parent)}>{t('parent', { title: parent.title })}</Button>}
          {localItem ? <><p className="fine-print">{t('savedVersion', { version: localItem.version })}</p><Button variant="full" onClick={() => setRemove(localItem)}>{t('remove')}</Button></> : <Button variant="full" onClick={() => model.saveLocal(item)}>{t('save')}</Button>}
          {localItem && <Button variant="ghost full" onClick={() => navigate('updates')}>{t('updates')}</Button>}
          {['插件', 'Slash'].includes(item.type) && item.status !== 'sample' && <HostPresence item={item} availability={availability} />}
          <ResourceFacts item={item} />
          {item.registryUrl && <p><a href={item.registryUrl} target="_blank" rel="noopener noreferrer">{t('registry')}</a></p>}
          {repositoryOf(item.url) && <p className="fine-print">{t('starTooltip', { repo: repositoryOf(item.url)! })}</p>}
        </aside></div>
      </section>}
      {state.view === 'publish' && <Editor model={model} state={state} />}
      {state.view === 'sources' && <Sources state={state} model={model} />}
      {state.view === 'updates' && <>
        <div className="page-heading"><h1>{t('updates')}</h1><p>{t('updatesNote')}</p></div>
        <div className="market-list">{updates.map(({ saved, latest }) => <article key={latest.id} className="market-row"><div><h2>{latest.title}</h2><p>{saved.version} → {latest.version}</p></div>
          <div className="actions"><Button onClick={() => model.open(latest)}>{t('view', { title: latest.title })}</Button><Button onClick={() => model.saveLocal(latest, true)}>{t('updateSaved')}</Button></div></article>)}</div>
        {!updates.length && <Empty title={t('noUpdates')} />}
      </>}
    </main>
    <footer className="page-footer"><a href="https://github.com/QT7-C23/DSH-Marketplace" target="_blank" rel="noopener noreferrer">DSH Marketplace ↗</a><span>0.1.0</span></footer>
    {remove && <Dialog title={t('removeTitle')} close={() => setRemove(null)}><p>{t('removeText', { title: remove.title, version: remove.version })}</p>
      <Button variant="primary" onClick={() => { if (model.removeLocal(remove.id)) { model.navigate('saved'); setRemove(null); } }}>{t('confirmRemove')}</Button>
    </Dialog>}
  </Surface>;
}
