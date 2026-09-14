import React, { useEffect, useRef, useState } from 'react';
import { type Resource } from '../../../community/contracts.mjs';
import { languageNames } from '../../../languages/index.mjs';
import { Button } from './components';
import { useLanguage } from './i18n';
import { type DocumentFile, translationModels, translationResult, type TranslationModels, type TranslationResult } from './documentation.mjs';
import { markdownBody } from '../../../sources/document-language.mjs';

/** Translation is opt-in; browsing, opening controls and switching views never call a model. */
export function DocumentTranslation({ item, file, render }: { item: Resource; file: DocumentFile; render: (body: string) => React.ReactNode }) {
  const { t, language, text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<TranslationModels | null>(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [custom, setCustom] = useState(false);
  const [target, setTarget] = useState(language);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [view, setView] = useState('original');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const selectedProvider = models?.providers.find(entry => entry.id === provider);
  const tooLong = markdownBody(file.body).length > 24000;

  async function loadModels() {
    if (active.current) return;
    const abort = new AbortController(); active.current = abort;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/community/translation/models', { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]), headers: { 'x-market-language': language } });
      if (!response.ok) throw Error(t('modelsFailed'));
      const value = translationModels(await response.json());
      if (active.current !== abort) return;
      setModels(value);
      const initial = value.providers.find(entry => entry.id === value.defaultSelection?.provider) || value.providers[0];
      const initialModel = initial?.id === value.defaultSelection?.provider ? value.defaultSelection.model : initial?.models[0]?.id || '';
      setProvider(initial?.id || ''); setModel(initialModel); setCustom(!initial?.models.some(entry => entry.id === initialModel));
    } catch { if (active.current === abort) setError(t('modelsFailed')); }
    finally { if (active.current === abort) { active.current = null; setLoading(false); } }
  }
  async function translate() {
    if (active.current) return;
    const abort = new AbortController(); active.current = abort;
    setPending(true); setError('');
    const request = { requestId: crypto.randomUUID(), confirmed: true, id: item.id, revision: item.revision, file: file.name, target, provider, model: model.trim() };
    try {
      const response = await fetch('/api/community/translation', { method: 'POST', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(95000)]), headers: { 'content-type': 'application/json', 'x-community-request': '1', 'x-market-language': language }, body: JSON.stringify(request) });
      const value = await response.json();
      if (!response.ok) throw Error(typeof value.error === 'string' ? value.error : t('translationFailed'));
      const translated = translationResult(value, request);
      if (active.current === abort) { setResult(translated); setView('translated'); }
    } catch (failure) {
      if (active.current === abort) setError(abort.signal.aborted ? t('translationCancelled') : failure instanceof Error ? text(failure.message) : t('translationFailed'));
    } finally { if (active.current === abort) { active.current = null; setPending(false); } }
  }
  return <>
    {item.status !== 'sample' && <div className="document-translation">
      <Button variant="ghost" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !models) void loadModels(); }}>{t('translateDocument')}</Button>
      {open && <div className="translation-options">
        <p id="translation-cost" className="fine-print">{t('translationCost')}</p>
        <p className="fine-print">{t('translationLength', { count: markdownBody(file.body).length })}</p>
        {loading && <p role="status">{t('loadingModels')}</p>}
        {models && !models.providers.length && <p>{t('noModels')}</p>}
        {models && models.providers.length > 0 && <>
          <div className="translation-fields">
            <label className="field"><span>{t('translationProvider')}</span><select aria-label={t('translationProvider')} disabled={pending} value={provider} onChange={event => { const next = models.providers.find(entry => entry.id === event.target.value)!; setProvider(next.id); setModel(next.models[0]?.id || ''); setCustom(!next.models.length); }}>
              {models.providers.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select></label>
            <label className="field"><span>{t('translationModel')}</span><select aria-label={t('translationModel')} disabled={pending} value={custom ? '__custom__' : model} onChange={event => { setCustom(event.target.value === '__custom__'); setModel(event.target.value === '__custom__' ? '' : event.target.value); }}>
              {selectedProvider?.models.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}<option value="__custom__">{t('customModel')}</option>
            </select></label>
            <label className="field"><span>{t('translationTarget')}</span><select aria-label={t('translationTarget')} disabled={pending} value={target} onChange={event => setTarget(event.target.value)}>{Object.entries(languageNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          </div>
          {custom && <label className="field"><span>{t('modelId')}</span><input aria-label={t('modelId')} value={model} maxLength={200} disabled={pending} onChange={event => setModel(event.target.value)} /></label>}
          {selectedProvider?.unavailable && <p className="fine-print">{t('modelsFailed')}</p>}
          {tooLong && <p>{t('translationTooLong')}</p>}
          <div className="form-actions"><Button aria-describedby="translation-cost" disabled={pending || !provider || !model.trim() || tooLong} onClick={() => void translate()}>{t(pending ? 'translating' : 'startTranslation')}</Button>
            {pending && <Button onClick={() => active.current?.abort()}>{t('cancelTranslation')}</Button>}
          </div>
        </>}
        {!pending && !loading && <Button variant="ghost" onClick={() => void loadModels()}>{t('refreshModels')}</Button>}
        {error && <p role="alert">{error}</p>}
      </div>}
      {result && <>
        <div className="filter-row"><Button variant={view === 'original' ? 'selected' : 'ghost'} onClick={() => setView('original')}>{t('originalDocument')}</Button><Button variant={view === 'translated' ? 'selected' : 'ghost'} onClick={() => setView('translated')}>{t('translatedDocument')}</Button></div>
        <p className="fine-print">{t('translationAttribution', { model: `${result.provider} / ${result.model}`, language: languageNames[result.target as keyof typeof languageNames] })}</p>
        <p className="fine-print">{result.usage ? t('translationUsage', { input: result.usage.inputTokens, output: result.usage.outputTokens }) : t('translationUsageUnknown')}</p>
      </>}
    </div>}
    {render(view === 'translated' && result ? result.body : file.body)}
  </>;
}
