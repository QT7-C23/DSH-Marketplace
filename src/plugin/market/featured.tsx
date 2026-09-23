import React from 'react';
import { Button } from './components';
import { useLanguage } from './i18n';

export function Featured({ open }: { open: () => void }) {
  const { t } = useLanguage();
  return <section className="featured-market" aria-label={t('featured')}>
    <div className="featured-copy">
      <p className="featured-label">{t('featuredKicker')}</p>
      <h2>{t('featuredTitle')}</h2>
      <p className="featured-description">{t('featuredDesc')}</p>
      <Button variant="primary" onClick={open}>{t('featuredAction')} <span aria-hidden="true">↗</span></Button>
      <span className="featured-note">{t('featuredNote')}</span>
    </div>
    <blockquote className="featured-excerpt" lang="en">“I want you to act as a Code reviewer who is experienced developer in the given code language.”<cite>rajudandigam / Code Reviewer</cite></blockquote>
  </section>;
}
