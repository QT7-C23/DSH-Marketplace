import entries from './index.json' with { type: 'json' };
import settings from './settings.json' with { type: 'json' };
import { validatePrompt, submissionUrl } from './contracts.mjs';

export const githubSubmission = submissionUrl(settings);
export const githubPrompts = entries.map(value => {
  validatePrompt(value);
  return { ...value, id: `github-${value.id}`, owner: `github:${value.author}`, revision: 1, status: 'github', source: 'GitHub 精选', updatedAt: '', author: value.author };
});
