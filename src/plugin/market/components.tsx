import React, { useEffect, useRef } from 'react';
import extraStyle from './market.css';
import { useLanguage } from './i18n';

// Thin HTML controls consume the host semantic theme, without a separate palette.
const styles = `@scope (.community-ui){${extraStyle}}`;
export function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`community-ui ${className}`}><style>{styles}</style>{children}</div>;
}
export function Button({ children, variant = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button type="button" {...props} className={`button ${variant} ${props.className || ''}`}>{children}</button>;
}
export function Field({ label, multiline = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; multiline?: boolean }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} aria-label={label} /> : <input {...props} aria-label={label} />}</label>;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className="empty"><h2>{title}</h2><p>{children}</p></div>; }
export function Dialog({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); prior?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); close(); }}><div className="section-head"><h2>{title}</h2><Button aria-label={t('closeDialog')} onClick={close}>{t('close')}</Button></div>{children}</dialog>;
}
export function ResourceIcon({ type }: { type: string }) {
  const classes: Record<string, string> = { Prompt: 'prompt', Skill: 'skill', MCP: 'mcp', Slash: 'slash', 插件: 'plugin', 主题: 'theme' };
  const paths: Record<string, string> = { 主题: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 .8-2.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3ZM7 10h.01M10 6.5h.01M15 7h.01M18 10.5h.01', Prompt: 'M5 4h14M12 4v16M8 20h8M5 4v3m14-3v3', Skill: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z', MCP: 'm10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 10a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1', Slash: 'm15 3-6 18M5 12h1m12 0h1', 插件: 'm12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9' };
  return <span className={`resource-icon ${classes[type]}`}><svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type]} /></svg></span>;
}
