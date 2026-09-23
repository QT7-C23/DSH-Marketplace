import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';

/** Only installed by the isolated verification profile; never uses a paid provider. */
export const inject = ['llm'];
export function apply(ctx) {
  const record = value => appendFile(path.join(process.env.DSH_HOME, 'translation-test-calls.jsonl'), JSON.stringify(value) + '\n');
  class TestTranslation extends LlmAdapter {
    providerInfo(id) { return { id, name: 'Test translation provider' }; }
    async listModels() { return ['test-translate', 'test-fail', 'test-slow'].map(id => ({ provider: 'market-test', id, name: id })); }
    async *stream(options) {
      const original = JSON.parse(options.messages[0].content[0].text).document;
      await record({ event: 'call', model: options.model, messages: options.messages.length, tools: Boolean(options.tools), session: Boolean(options.sessionId), sourceHash: createHash('sha256').update(original).digest('hex') });
      if (options.model === 'test-slow') {
        try { await delay(30000, null, { signal: options.signal }); }
        catch { await record({ event: 'aborted', model: options.model }); throw Error('cancelled'); }
      }
      if (options.model === 'test-fail') { yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'fixture rate limit' } } }; return; }
      await delay(150, null, { signal: options.signal });
      yield { type: 'text-delta', index: 0, text: '# 翻译验收样例\n\n模型调用已经通过真实宿主。\n\n```sh\nnpm test\n```\n\n<script>alert(1)</script>\n[unsafe](javascript:alert(1))\n' };
      yield { type: 'usage', usage: { inputTokens: 30, cacheReadTokens: 10, outputTokens: 15 } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  ctx.llm.registerAdapter(['market-test'], new TestTranslation());
}
