export const UPSTREAM = 'https://api.github.com/repos/anthropics/skills/contents/skills';
export async function discover(fetcher = fetch) {
  const response = await fetcher(UPSTREAM, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DSH-Local-Prototype' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`来源返回 ${response.status}，请稍后重试`);
  const entries = await response.json();
  if (!Array.isArray(entries) || entries.some(entry => typeof entry.name !== 'string' || typeof entry.type !== 'string')) throw new Error('来源数据格式无法识别');
  const dirs = entries.filter(entry => entry.type === 'dir');
  return { count: dirs.length, sampleFound: dirs.some(entry => entry.name === 'internal-comms'), checkedAt: new Date().toISOString(), sourceUrl: UPSTREAM };
}
