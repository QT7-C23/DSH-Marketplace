import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type Resource } from '../../community/contracts.mjs';
import { Button } from './components';
import { documentLink, documentResult, type DocumentResult } from './documentation.mjs';
import { useLanguage } from './i18n';
import { preferredDocuments, markdownBody } from '../../sources/document-language.mjs';
import { DocumentTranslation } from './translation';

export function ResourceDocumentation({ item }: { item: Resource }) {
  const { t, language } = useLanguage();
  const [result, setResult] = useState<DocumentResult | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  useEffect(() => setSelected(''), [language]);
  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    setResult(null); setError(false); setSelected('');
    if (item.type === 'Prompt' || item.status === 'sample') {
      setResult({ schema: 1, state: 'available', scope: 'resource', versionMatch: true, checkedAt: '', files: [{ name: item.type === 'Prompt' ? 'Prompt' : 'Example', body: item.body, url: item.url, commit: '' }] });
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/community/documentation?id=${encodeURIComponent(item.id)}&revision=${item.revision}`, { headers: { 'x-market-language': language }, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]) });
        if (!response.ok) throw Error();
        const value = documentResult(await response.json());
        if (!disposed) setResult(value);
      } catch { if (!disposed) setError(true); }
    })();
    return () => { disposed = true; abort.abort(); };
  }, [item.id, item.revision, attempt]);
  const files = preferredDocuments(result?.files || [], language);
  const file = files.find(entry => entry.name === selected) || files[0];
  return <section className="author-documentation">
    {!result && !error && <p role="status">{t('loading')}</p>}
    {error && <p role="alert">{t('docsFailed')} <Button onClick={() => setAttempt(attempt + 1)}>{t('retry')}</Button></p>}
    {result?.state === 'missing' && <p>{t('noDocs')}</p>}
    {result && !result.versionMatch && <p className="fine-print">{t('docsCurrent')}</p>}
    {result?.scope === 'parent' && <p className="fine-print">{t('docsParent')}</p>}
    {files.length > 1 && <div className="filter-row">{files.map(entry => <Button key={entry.name} variant={file.name === entry.name ? 'selected' : 'ghost'} onClick={() => setSelected(entry.name)}>{entry.name}</Button>)}</div>}
    {file && <><div className="section-head"><strong>{file.name}</strong>{file.url && <a href={file.url} target="_blank" rel="noopener noreferrer">{t('docsOrigin')}</a>}</div>
      {file.commit && <p className="fine-print">{t('docsCommit', { commit: file.commit.slice(0, 12) })}</p>}
      <DocumentTranslation key={`${item.id}:${item.revision}:${file.name}:${file.commit}:${language}`} item={item} file={file} render={body => <div className="readme-body"><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url => documentLink(url, file.url)} components={{
        a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        img: ({ alt }) => <span className="fine-print">{t('docImage', { alt: alt || '' })}</span>,
        h1: ({ children }) => <h2>{children}</h2>,
      }}>{markdownBody(body)}</Markdown></div>} />
      <details><summary>{t('docsRaw')}</summary><pre className="content-preview">{file.body}</pre></details>
    </>}
    <p className="fine-print">{t('originalNote')}</p>
    {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">{t('original')}</a>}
  </section>;
}
