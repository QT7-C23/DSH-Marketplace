import React, { useState, useSyncExternalStore } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { fields, fillTemplate } from '../prototype/state.mjs';
import { type Resource } from '../community/contracts.mjs';
import { type MarketController, samples, message } from './market/controller';
import { Surface, Button, Field } from './market/components';
import { prepareAppend } from './append.mjs';
import { LanguageContext, useLanguage } from './market/i18n';

export type Ticket = ReturnType<typeof prepareAppend>;
export type PromptProps = PropsRuntime<'conversation.input.dock'> & { insert: (ticket: Ticket) => void; model: MarketController; back: () => void };
export function Prompt(props: PromptProps) {
  const selected = useSyncExternalStore(props.model.subscribe, () => props.model.selected(props.sessionId));
  const state = useSyncExternalStore(props.model.subscribe, props.model.getSnapshot);
  const item = selected || samples[0];
  return <LanguageContext.Provider value={state.local.language}><TemplateForm key={`${props.sessionId}:${item.id}:${item.version}`} {...props} item={item} selected={Boolean(selected)} /></LanguageContext.Provider>;
}
function TemplateForm(props: PromptProps & { item: Resource; selected: boolean }) {
  const { t, text } = useLanguage();
  const input = props.useInput(value => value);
  const session = props.useSession(value => value);
  const [opened, setOpened] = useState(props.selected);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields(props.item.body).map(key => [key, ''])));
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notice, setNotice] = useState('');
  function preview() {
    setTicket(null);
    try {
      setTicket(prepareAppend(props.sessionId, input, session, fillTemplate(props.item.body, values)));
      setNotice('预览绑定当前会话；草稿变化后需要重新预览。');
    } catch (error) { setNotice(message(error)); }
  }
  function insert() {
    try {
      if (!ticket) return;
      props.insert(ticket); setTicket(null);
      setNotice('已追加到真实 DSH 草稿，未发送任务。');
    } catch (error) { setNotice(message(error)); }
  }
  return <Surface><section aria-label="市场 Prompt" className="prompt-panel"><div className="section-head">{!props.selected && <Button onClick={props.back}>{t('promptBrowse')}</Button>}<Button variant={props.selected ? '' : 'ghost'} onClick={() => setOpened(!opened)}>{props.item.id === 'weekly-prompt' ? t('promptExample') : t('promptSelected', { title: props.item.title })}</Button>{props.selected && <Button variant="ghost" onClick={props.back}>{t('promptBack')}</Button>}</div>
    {opened && <div className="prompt-fields">{Object.keys(values).map(key => <Field key={key} label={key} multiline value={values[key]} onChange={event => { setValues({ ...values, [key]: event.target.value }); setTicket(null); }} />)}<Button onClick={preview}>{t('promptPreview')}</Button>{ticket && <pre data-testid="host-prompt-preview" className="content-preview">{ticket.request.text}</pre>}<div className="section-head"><span>{t('promptCurrent', { version: props.item.version })}</span><Button variant="primary" onClick={insert} disabled={!ticket}>{t('promptAppend')}</Button></div></div>}
    <p role="status">{text(notice)}</p>
  </section></Surface>;
}
