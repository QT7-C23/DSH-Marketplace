import React, { useState } from 'react';
import { submissionFile } from '../../../catalog/contracts.mjs';
import { type Draft } from './controller';
import { Button, Dialog } from './components';
import { saveFile } from './metrics';
import { useLanguage, typeKey } from './i18n';

export function GitHubSubmission({ value, close }: { value: Draft; close: () => void }) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const { t, text } = useLanguage();
  return <Dialog title={t('submissionTitle')} close={close}>
    <h3>{value.title}</h3><p>{t(typeKey(value.type))} · {value.author} · {value.license}</p><p>{value.summary}</p><pre className="content-preview">{value.body}</pre>
    <p role="alert">{text(error)}</p><p role="status">{notice && t(notice)}</p>
    <Button variant="primary" onClick={() => {
      try { saveFile(submissionFile(value, { ...value, id: value.resourceId })); setError(''); setNotice('noticeExport'); }
      catch (failure) { setError(failure instanceof Error ? failure.message : '投稿信息格式不正确'); }
    }}>{t('exportSubmission')}</Button>
    <p className="fine-print">{t('submissionHint')}</p>
    <a href="https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=03-resource-submission.yml" target="_blank" rel="noopener noreferrer">{t('submitGitHub')}</a>
  </Dialog>;
}
