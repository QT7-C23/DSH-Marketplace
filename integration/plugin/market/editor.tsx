import React, { useState } from 'react';
import { RESOURCE_TYPES } from '../../../community/contracts.mjs';
import { LICENSES, submissionFile } from '../../../catalog/contracts.mjs';
import { type Draft, type MarketController, type State } from './controller';
import { Button, Field } from './components';
import { GitHubSubmission } from './submission';
import { useLanguage, typeKey } from './i18n';

export function Editor({ model, state }: { model: MarketController; state: State }) {
  const [preview, setPreview] = useState<Draft | null>(null);
  const { t } = useLanguage();
  const value = state.editor;
  const update = (key: keyof Draft, text: string) => model.change({ ...value, [key]: text });
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100 * 1024 || !/\.(txt|md|json)$/i.test(file.name)) throw Error('请导入 100 KB 以内的 TXT、Markdown 或 JSON 文件');
      const body = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const parsed = /\.json$/i.test(file.name) ? JSON.parse(body) : { body };
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('导入字段必须是文本');
      const next = { ...value };
      for (const key of ['type', 'title', 'summary', 'body', 'url', 'version', 'author', 'license', 'language'] as const) if (parsed[key] !== undefined) {
        if (typeof parsed[key] !== 'string' || (key === 'type' && !RESOURCE_TYPES.includes(parsed[key]))) throw Error('导入字段必须是文本');
        next[key] = parsed[key];
      }
      if (parsed.id !== undefined) { if (typeof parsed.id !== 'string') throw Error('导入字段必须是文本'); next.resourceId = parsed.id; }
      model.change(next);
    } catch (error) { model.error(error); }
  }
  return <>
    <div className="page-heading"><h1>{t('share')}</h1><p>{t('shareNote')}</p></div>
    <div className="market-editor"><form onSubmit={event => { event.preventDefault(); try { submissionFile(value, { ...value, id: value.resourceId }); setPreview({ ...value }); } catch (error) { model.error(error); } }}>
      <div className="form-pair"><label className="field"><span>{t('resourceType')}</span><select aria-label={t('resourceType')} value={value.type} onChange={event => update('type', event.target.value)}>{RESOURCE_TYPES.map(type => <option key={type} value={type}>{t(typeKey(type))}</option>)}</select></label>
      <Field label={t('idField')} value={value.resourceId || ''} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} required onChange={event => update('resourceId', event.target.value)} /></div>
      <Field label={t('resourceName')} value={value.title} maxLength={80} required onChange={event => update('title', event.target.value)} />
      <Field label={t('summary')} value={value.summary} maxLength={300} multiline required onChange={event => update('summary', event.target.value)} />
      <div className="form-pair"><Field label={t('authorField')} value={value.author || ''} maxLength={39} required onChange={event => update('author', event.target.value)} />
      <Field label={t('version')} value={value.version} maxLength={40} required onChange={event => update('version', event.target.value)} /></div>
      <div className="form-pair"><label className="field"><span>{t('licenseField')}</span><select aria-label={t('licenseField')} value={value.license || ''} required onChange={event => update('license', event.target.value)}><option value="">{t('chooseLicense')}</option>{LICENSES.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>{t('languageField')}</span><select aria-label={t('languageField')} value={value.language || 'zh'} onChange={event => update('language', event.target.value)}><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option><option value="other">{t('otherLanguage')}</option></select></label></div>
      <Field label={t('url')} value={value.url} maxLength={2000} required={value.type !== 'Prompt'} onChange={event => update('url', event.target.value)} />
      <p className="fine-print">{t('urlNote')}</p>
      <Field label={t('content')} value={value.body} multiline maxLength={50000} required={value.type === 'Prompt'} onChange={event => update('body', event.target.value)} />
      {value.type === 'Prompt' && <p className="fine-print">{t('variablesNote')}</p>}
      {value.type === '主题' && <p className="fine-print">{t('themeSubmissionNote')}</p>}
      <label className="field"><span>{t('importFile')}</span><input type="file" aria-label={t('importFile')} accept=".txt,.md,.json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <div className="form-actions"><Button onClick={() => model.saveLocalDraft()}>{t('saveDraft')}</Button><Button variant="primary" type="submit">{t('previewSubmission')}</Button></div>
      <p className="fine-print">{t(state.dirty ? 'draftDirty' : 'draftNote')}</p>
    </form><aside className="market-preview"><h2>{value.title || t('resourceName')}</h2><p>{value.summary}</p><p className="fine-print">{value.author} {value.license && '· ' + value.license}</p><pre className="content-preview">{value.body || t('content')}</pre><p className="fine-print">{t('authorNote')}</p></aside></div>
    {preview && <GitHubSubmission value={preview} close={() => setPreview(null)} />}
  </>;
}
