import React from 'react';

/** Four connected tiles: one entry for different kinds of extensions. */
export function MarketLogo({ size = 20 }: { size?: number }) {
  return <svg data-market-logo="extensions" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
    <path d="M17.5 2.5v8m-4-4h8" />
  </svg>;
}
