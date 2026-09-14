// @ts-check
/** Draft insertion adapter for DSH 0.1.5-rc.2. Chip spans use one code unit.
 * @typedef {import('@deepseek-ai/dsh-client-ui-conversation/client').InputState} Input
 * @typedef {import('@deepseek-ai/dsh-api-session-controller/client').SessionSnapshot} Session
 * @typedef {import('@deepseek-ai/dsh-client-ui-conversation/client').TokenSpan} Span
 * @typedef {{ sessionId: string, request: { text: string, span: Span } }} Ticket
 */

/**
 * @param {string | undefined} sessionId
 * @param {Input | undefined} input
 * @param {Session | undefined} session
 */
function available(sessionId, input, session) {
  if (!sessionId || !input || !session || session.removed || session.openState !== 'open') throw new Error('请先选择可用会话');
  if (session.running || session.pendingSubmissions.length || input.phase !== 'plain') throw new Error('会话忙碌或正在使用命令，请稍后重试');
  return { sessionId, input };
}

/** Capture a session and editor revision without mutating either.
 * @param {string | undefined} sessionId
 * @param {Input | undefined} input
 * @param {Session | undefined} session
 * @param {string} text
 * @returns {Ticket}
 */
export function prepareAppend(sessionId, input, session, text) {
  const target = available(sessionId, input, session);
  if (!text.trim()) throw new Error('请先填写内容');
  const end = target.input.draft.length - target.input.occurrences.reduce((total, occurrence) => total + occurrence.length - 1, 0);
  return { sessionId: target.sessionId, request: { text: (target.input.draft ? '\n\n' : '') + text, span: { start: end, end, draftRev: target.input.draftRev } } };
}

/** Reject stale previews before the host performs its own revision check.
 * @param {Ticket} ticket
 * @param {string | undefined} sessionId
 * @param {Input | undefined} input
 * @param {Session | undefined} session
 */
export function validateAppend(ticket, sessionId, input, session) {
  const target = available(sessionId, input, session);
  if (ticket.sessionId !== target.sessionId) throw new Error('会话已变化，请重新预览');
  if (ticket.request.span.draftRev !== target.input.draftRev) throw new Error('草稿已变化，请重新预览');
  return ticket.request;
}
