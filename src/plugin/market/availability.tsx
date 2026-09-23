import React, { useCallback, useEffect, useState } from 'react';
import { availabilitySnapshot, type AvailabilitySnapshot, type PluginPresence } from './availability.mjs';
import { type Resource } from '../../community/contracts.mjs';
import { Button } from './components';
import { useLanguage } from './i18n';

export function useAvailability() {
  const [data, setData] = useState<AvailabilitySnapshot | null>(null);
  const [error, setError] = useState(false);
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(() => setGeneration(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function read() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch('/api/community/availability', { credentials: 'same-origin', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw Error();
        const value = availabilitySnapshot(await response.json());
        if (!controller.signal.aborted) { setData(value); setError(false); }
      } catch { if (!controller.signal.aborted) { setData(null); setError(true); } }
      finally { busy = false; }
    }
    void read();
    const interval = setInterval(() => { if (!document.hidden) void read(); }, 15000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [generation]);
  return { data, error, refresh };
}
export type Availability = ReturnType<typeof useAvailability>;
export function presenceOf(item: Resource, availability: Availability): PluginPresence | undefined {
  const value = availability.data?.resources[item.id];
  return value?.revision === item.revision ? value : undefined;
}
export function ResourceReadiness({ item, availability }: { item: Resource; availability: Availability }) {
  const { t } = useLanguage();
  const presence = presenceOf(item, availability);
  const key = item.status === 'sample' ? 'sample' : item.type === 'Prompt' ? 'readyPrompt' : item.type === 'Skill' ? 'readySkill' : item.type === 'MCP' ? 'readyMCP' : presence?.detected ? 'hostDetected' : availability.error || !availability.data?.complete ? 'hostUnknown' : presence ? 'hostNotDetected' : item.type === '主题' ? 'readyTheme' : 'hostUnknown';
  return <span className="resource-readiness" data-detected={presence?.detected || undefined}>{t(key)}</span>;
}
export function HostPresence({ item, availability }: { item: Resource; availability: Availability }) {
  const { t } = useLanguage();
  const presence = presenceOf(item, availability);
  return <section className="host-presence" aria-label={t('hostStatus')}>
    <div className="section-head"><h3>{t('hostStatus')}</h3><Button variant="ghost" aria-label={t('refreshHost')} onClick={availability.refresh}>{t('refresh')}</Button></div>
    {availability.error ? <p role="alert">{t('hostReadError')}</p> : !availability.data ? <p role="status">{t('loading')}</p> : <>
      {!presence?.locations.length && <p><ResourceReadiness item={item} availability={availability} /></p>}
      {!!presence?.locations.length && <ul className="host-locations">{presence.locations.map((location, index) => <li key={index}><span>{location.scope === 'host' ? t('hostScope') : t('presetScope', { name: location.name })}{location.isDefault && <small>{t('defaultPreset')}</small>}</span><span className="phase-label" data-phase={location.state}>{t('phase' + location.state)}</span></li>)}</ul>}
      {!availability.data.complete && <p className="fine-print">{t('hostIncomplete')}</p>}
    </>}
    <p className="fine-print">{t('hostStatusNote')}</p>
  </section>;
}
