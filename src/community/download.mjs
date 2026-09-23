/** Export only the public content of the reviewed version. Never execute resource text. */
export function downloadFile(resource) {
  const { type, title, summary, version, body, url, author } = resource;
  if (type === 'MCP' && resource.serverDefinition) return { filename: `${resource.id}.json`, mime: 'application/json;charset=utf-8', content: JSON.stringify(resource.serverDefinition, null, 2) + '\n' };
  if (type === 'Prompt') return {
    filename: `${resource.id}.md`, mime: 'text/markdown;charset=utf-8',
    content: `# ${title}\n\n作者：${author}\n版本：${version}\n${resource.license ? `许可：${resource.license}\n` : ''}\n${summary}\n\n${body}\n${url ? `\n来源：${url}\n` : ''}`,
  };
  return {
    filename: `${resource.id}.json`, mime: 'application/json;charset=utf-8',
    content: JSON.stringify({ type, title, summary, version, body, url, author }, null, 2) + '\n',
  };
}
