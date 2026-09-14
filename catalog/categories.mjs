/** Editorial use-case labels, separate from resource install/use formats. */
export const CATEGORIES = ['coding', 'design', 'writing', 'product', 'data', 'workflow', 'general'];
const names = {
  coding: ['code-reviewer', 'commit-message-generator', 'qa-testing', 'mcp-builder', 'webapp-testing', 'skill-creator', 'claude-api'],
  design: ['frontend-design', 'algorithmic-art', 'brand-guidelines', 'canvas-design', 'slack-gif-creator', 'theme-factory', 'web-artifacts-builder', 'ux-ui-review'],
  writing: ['internal-comms', 'doc-coauthoring', 'technical-writing', 'english-improver', 'socratic-method', 'weekly-prompt'],
  product: ['product-requirements', 'plan-mode', 'plan', 'plan-plugin', 'plan-command'],
};
export function categoryOf(item) {
  if (item.type === '主题') return 'design';
  const slug = item.id.replace(/^(github-|source-(skill|dsh|slash|mcp)-)/, '');
  for (const [category, slugs] of Object.entries(names)) if (slugs.includes(slug)) return category;
  return item.type === 'MCP' ? 'data' : ['插件', 'Slash'].includes(item.type) ? 'workflow' : 'general';
}
