import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAppend, validateAppend } from './plugin/append.mjs';

const input = { draft: '已有正文\n引用 @report.md', draftRev: 3, phase: 'plain', occurrences: [{ length: 10 }], attachmentIds: ['attachment-1'] };
const session = { running: false, removed: false, openState: 'open', pendingSubmissions: [] };

test('append uses chip coordinates, keeps attachments and never replaces the existing draft', () => {
  const ticket = prepareAppend('session-a', input, session, '新模板内容');
  assert.deepEqual(ticket.request.span, { start: input.draft.length - 9, end: input.draft.length - 9, draftRev: 3 });
  assert.equal(ticket.request.text, '\n\n新模板内容');
  assert.deepEqual(input.attachmentIds, ['attachment-1']);
  assert.equal(validateAppend(ticket, 'session-a', input, session), ticket.request);
});

test('changed session, revision, busy state, missing target and empty content refuse insertion', () => {
  const ticket = prepareAppend('session-a', input, session, '新模板内容');
  assert.throws(() => validateAppend(ticket, 'session-b', input, session), /会话/);
  assert.throws(() => validateAppend(ticket, 'session-a', { ...input, draftRev: 4 }, session), /草稿/);
  assert.throws(() => prepareAppend('session-a', input, { ...session, running: true }, '内容'), /忙碌/);
  assert.throws(() => prepareAppend('session-a', { ...input, phase: 'claimed' }, session, '内容'), /忙碌/);
  assert.throws(() => prepareAppend(undefined, undefined, undefined, '内容'), /会话/);
  assert.throws(() => prepareAppend('session-a', input, session, '  '), /内容/);
});
