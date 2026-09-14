import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-api-session-controller/client';
import { type Resource } from '../../community/contracts.mjs';
import { createMarket, httpPort, type MarketController } from './market/controller';
import { browserLocalPort } from './market/local.mjs';
import { Market } from './market/market';
import { Prompt, type Ticket } from './prompt';
import { validateAppend } from './append.mjs';
import { MarketLogo } from './market/logo';
import { translate } from '../../languages/index.mjs';

export const inject = ['slots', 'sessions', 'conversation', 'layout'];
/** Plugin-owned state and public DSH contracts compose the full market flow. */
export function apply(ctx: Context) {
  let model: MarketController;
  model = createMarket(httpPort(() => model.getSnapshot().local.language), browserLocalPort());
  ctx.effect(() => () => model.dispose());
  function usePrompt(resource: Resource) {
    const sessionId = ctx.sessions.list.getSnapshot().current;
    const binding = sessionId && ctx.sessions.binding(sessionId);
    if (!sessionId || !binding || binding.session.getSnapshot().removed) throw new Error('请先在 DSH 创建或选择会话，再从商店使用模板');
    model.select(sessionId, resource);
    ctx.layout.selectPanel(null);
  }
  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'community-market', inject: () => ({ model, usePrompt }) }, Market)));
  ctx.effect(() => {
    let locale = '';
    let release: (() => void) | undefined;
    const update = () => {
      const next = model.getSnapshot().local.language;
      if (next === locale) return;
      locale = next; release?.();
      release = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'community-market', order: 70, label: translate(locale, 'market') }, () => <MarketLogo />));
    };
    update();
    const unsubscribe = model.subscribe(update);
    return () => { unsubscribe(); release?.(); };
  });
  ctx.effect(() => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'community-prompt', order: 70,
    inject: sessionId => ({
      model,
      back: () => ctx.layout.selectPanel('community-market' as MainPanelId),
      insert: (ticket: Ticket) => {
        const binding = ctx.sessions.binding(sessionId);
        if (!binding) throw new Error('会话已关闭，请重新选择');
        const input = ctx.conversation.input.for(binding.ctx).state.getSnapshot();
        const request = validateAppend(ticket, ctx.sessions.list.getSnapshot().current, input, binding.session.getSnapshot());
        if (binding.ctx.bail('slash/input-insert-text', request) !== true) throw new Error('宿主未接受插入，草稿可能已变化，请重新预览');
      },
    }),
  }, Prompt)));
}
