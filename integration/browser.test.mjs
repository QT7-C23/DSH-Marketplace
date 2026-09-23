import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../node_modules/playwright/index.mjs';
import { createHash } from 'node:crypto';
import sourceCatalog from '../sources/catalog.json' with { type: 'json' };
import { mergeSourceResources } from '../sources/merge.mjs';
import { SOURCE_DEFINITIONS } from '../sources/definitions.mjs';
import path from 'node:path';
import { lab } from './host.mjs';
import { setPlugin } from './set-plugin.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { unzipSync, gunzipSync } from 'fflate';

async function openLab(t) {
  const url = (await readFile(path.join(lab, 'url.txt'), 'utf8')).trim();
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.setDefaultTimeout(10000);
  t.after(async () => {
    await page.screenshot({ path: `artifacts/dsh-integration/last-${createHash('sha256').update(t.name).digest('hex').slice(0, 12)}.png`, fullPage: true }).catch(() => {});
    await browser.close();
    assert.deepEqual(errors, [], 'No unhandled browser errors');
  });
  page.on('crash', () => t.diagnostic('Browser page crashed'));
  page.on('pageerror', error => errors.push(error.message));
  for (const name of ['继续', '稍后配置']) {
    await page.addLocatorHandler(page.getByRole('button', { name, exact: true }), async button => { await button.click(); });
  }
  await page.goto(url);
  await page.getByRole('button', { name: '新建会话', exact: true }).first().waitFor();
  return page;
}

async function openResource(page, title) {
  const search = page.locator('.community-market .search-field input');
  await search.fill(title);
  await page.getByRole('button', { name: '查看 ' + title, exact: true }).click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
}

async function chooseWorkspace(page) {
  if (!await page.getByRole('treeitem', { name: 'workspace', exact: true }).count()) {
    await page.getByRole('button', { name: '添加工作区', exact: true }).click();
    await page.getByRole('button', { name: '编辑路径', exact: true }).click();
    const input = page.getByRole('textbox', { name: '编辑路径', exact: true });
    await input.fill(path.join(lab, 'workspace'));
    await input.press('Enter');
    await page.getByRole('button', { name: '打开', exact: true }).click();
  }
  await page.getByRole('button', { name: '新建会话', exact: true }).first().click();
  if (!await page.getByRole('button', { name: '周报使用示例', exact: true }).count()) {
    await page.getByRole('button', { name: '选择工作区', exact: true }).click();
    await page.getByRole('menuitem', { name: 'workspace', exact: true }).click();
  }
  await page.getByRole('button', { name: '周报使用示例', exact: true }).waitFor();
}

test('market Skill installation loads original instructions into the real native tool', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, 'brand-guidelines');
  await page.getByRole('button', { name: '安装到 DSH', exact: true }).click();
  await page.getByRole('button', { name: '确认安装文件', exact: true }).click();
  await page.getByRole('dialog', { name: '确认安装 Skill' }).waitFor({ state: 'hidden', timeout: 120000 });
  const response = await page.request.get(new URL('/api/market-test/skill', page.url()).href, { headers: { origin: new URL(page.url()).origin } });
  assert.equal(response.status(), 200, await response.text());
  const probe = await response.json();
  assert.equal(probe.loaded, true, JSON.stringify(probe));
  assert.equal(probe.result.isError, false, JSON.stringify(probe.result));
  assert(probe.content.includes('Anthropic'));
  assert(probe.result.content.some(block => block.type === 'text' && block.text.includes(probe.content)), 'The actual native tool returns the original Skill body');
  const file = await readFile(path.join(lab, 'home/skills/brand-guidelines/SKILL.md'), 'utf8');
  assert(file.includes(probe.content));
  await page.getByRole('button', { name: '检查宿主加载', exact: true }).last().click();
  await page.locator('.action-panel .skill-manager').getByText(/默认预设已加载/).waitFor();
  const instructions = page.locator('.action-panel .skill-manager').getByText(/在新建会话的输入框/);
  assert((await instructions.boundingBox()).width >= 160, 'Management buttons must not squeeze Skill instructions into a vertical column');
});

test('management history, withdrawal requests and real npm counts are usable in the host UI', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '规划模式');
  const origin = new URL(page.url()).origin;
  const npm = await (await page.request.get(origin + '/api/community/npm-downloads?ids=source-dsh-plan-mode')).json();
  const count = npm['@deepseek-ai/dsh-plan-mode'];
  assert.equal(count.state, 'fresh'); assert(Number.isSafeInteger(count.count));
  const metric = page.locator('.detail-heading .npm-downloads');
  const expected = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(count.count);
  await metric.filter({ hasText: expected }).waitFor();
  assert((await metric.getAttribute('title')).includes(count.start));
  const removal = new URL(await page.getByRole('link', { name: '申请移除或修正署名' }).getAttribute('href'));
  assert.equal(removal.hostname, 'github.com'); assert(removal.searchParams.get('links').includes('source-dsh-plan-mode'));
  await page.getByRole('button', { name: '我的资源', exact: true }).click();
  await page.getByRole('button', { name: '已安装扩展', exact: true }).click();
  const operations = await (await page.request.get(origin + '/api/community/operations')).json();
  assert.equal(typeof operations.blocked, 'boolean'); assert(operations.recent.length <= 20);
  await page.getByRole('region', { name: '操作记录', exact: true }).waitFor();
  assert(!JSON.stringify(operations).includes('privatePath'));
  await page.locator('.community-market').getByRole('button', { name: '设置', exact: true }).click();
  const history = page.getByRole('region', { name: '已下架资源', exact: true });
  await history.waitFor();
  const records = await (await page.request.get(origin + '/api/community/withdrawals')).json();
  assert(Array.isArray(records));
  if (!records.length) await history.getByText('目前没有已确认的下架记录。', { exact: true }).waitFor();
  for (const [locale, title] of [['en-US', 'Withdrawn resources'], ['ja-JP', '掲載を取り下げたリソース']]) {
    await page.locator('.setting-line select').selectOption(locale);
    await page.getByRole('region', { name: title, exact: true }).waitFor();
  }
});

test('market MCP connects Microsoft Learn and calls its real search tool before disabling and removing', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, 'Microsoft Learn 文档');
  await page.getByRole('button', { name: '配置并连接 MCP', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认 MCP 连接' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '确认操作', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 45000 });
  await page.getByText(/工具已注册；当前连通性需通过实际调用确认/).waitFor({ timeout: 45000 });
  const response = await page.request.get(new URL('/api/market-test/mcp', page.url()).href, { headers: { origin: new URL(page.url()).origin } });
  assert.equal(response.status(), 200, await response.text());
  const result = await response.json();
  assert.equal(result.isError, false, JSON.stringify(result));
  assert.match(JSON.stringify(result.content), /learn\.microsoft\.com/);
  assert.match(JSON.stringify(result.content), /[Bb]lob/);
  const section = page.locator('.action-panel .mcp-manager');
  await section.getByRole('button', { name: '停用连接', exact: true }).click();
  await page.getByRole('dialog', { name: '停用连接' }).getByRole('button', { name: '确认操作', exact: true }).click();
  await section.getByText(/已停用/).waitFor({ timeout: 30000 });
  await section.getByRole('button', { name: '移除连接', exact: true }).click();
  await page.getByRole('dialog', { name: '移除连接' }).getByRole('button', { name: '确认操作', exact: true }).click();
  await section.getByRole('button', { name: '配置并连接 MCP', exact: true }).waitFor({ timeout: 30000 });
  const patch = await readFile(path.join(lab, 'home/profiles/web/cordis.patch.yml'), 'utf8');
  assert(!patch.includes('market-mcp-'), 'Removal clears only the owned durable connection block');
  assert(patch.includes('community-market'));
});

test('GitHub settings keep credentials out of reads and browser storage and translate status', async t => {
  const page = await openLab(t);
  const actual = await page.request.get(new URL('/api/community/github/read', page.url()).href);
  assert.equal(actual.status(), 200);
  const status = await actual.json();
  assert.equal(typeof status.configured, 'boolean');
  assert(Object.keys(status).every(key => ['configured', 'state', 'limit', 'remaining', 'resetAt', 'checkedAt'].includes(key)));
  let fixture = { configured: false, state: 'anonymous' };
  const commands = [];
  const synthetic = 'ghs_12345_' + ['synthetic-header', 'browser_test_only_'.repeat(32), 'synthetic-signature'].join('.');
  await page.route('**/api/community/github/read', route => route.fulfill({ json: fixture }));
  await page.route('**/api/community/github', route => {
    const command = route.request().postDataJSON(); commands.push(command);
    assert.equal(route.request().headers()['x-community-request'], '1');
    fixture = command.action === 'remove' ? { configured: false, state: 'anonymous' } : { configured: true, state: 'connected', remaining: 4999, limit: 5000, resetAt: '2027-01-01T00:00:00Z', checkedAt: '2026-09-14T00:00:00Z' };
    return route.fulfill({ json: fixture });
  });
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.locator('.market-nav button').nth(2).click();
  const section = page.locator('.github-settings');
  await section.getByText('尚未配置令牌，使用匿名访问。', { exact: true }).waitFor();
  const input = section.getByLabel('GitHub 个人访问令牌', { exact: true });
  assert.equal(await input.getAttribute('type'), 'password');
  await input.fill(synthetic);
  assert.equal(await input.inputValue(), synthetic, 'Long installation credentials must not be truncated by the input');
  await section.getByRole('button', { name: '保存并验证', exact: true }).click();
  await section.getByText('GitHub 连接正常。', { exact: true }).waitFor();
  assert.equal(await input.inputValue(), '');
  assert.deepEqual(commands, [{ action: 'save', token: synthetic }]);
  assert.equal(await page.evaluate(secret => Object.values(localStorage).some(value => value.includes(secret)), synthetic), false);
  assert(!(await page.locator('body').innerText()).includes(synthetic));
  for (const [locale, title, connected] of [['en-US', 'GitHub connection', 'Connected to GitHub.'], ['ja-JP', 'GitHub 接続', 'GitHub に接続できました。']]) {
    await page.locator('.community-market select').first().selectOption(locale);
    await section.getByRole('heading', { name: title, exact: true }).waitFor();
    await section.getByText(connected, { exact: true }).waitFor();
  }
  await section.getByRole('button', { name: 'トークンを削除', exact: true }).click();
  await section.getByText('トークン未設定。匿名でアクセスします。', { exact: true }).waitFor();
  assert.deepEqual(commands.at(-1), { action: 'remove' });
  await page.locator('.community-market select').first().selectOption('zh-CN');
  await page.screenshot({ path: 'artifacts/github-auth/settings.png', fullPage: true });
});

test('installed extension management reads the actual profile and presents three languages', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('button', { name: '我的资源', exact: true }).click();
  await page.getByRole('button', { name: '已安装扩展', exact: true }).click();
  await page.getByText('运行环境：web · DSH 0.1.5-rc.2', { exact: true }).waitFor();
  await page.getByRole('heading', { name: '此环境还没有可管理的扩展', exact: true }).waitFor();
  const input = page.getByRole('textbox', { name: 'npm 包与固定版本', exact: true });
  await input.fill('not-a-fixed-version');
  await page.getByRole('button', { name: '检查安装', exact: true }).click();
  await page.locator('.extension-manager [role=alert]').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  for (const [locale, name] of [['en-US', 'Installed extensions'], ['ja-JP', 'インストール済み拡張']]) {
    await page.locator('.market-nav button').nth(2).click();
    await page.locator('.community-market select').first().selectOption(locale);
    await page.locator('.market-nav button').nth(1).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
  }
  await page.getByRole('button', { name: '收起侧边栏', exact: true }).click();
  await page.getByRole('button', { name: '打开侧边栏', exact: true }).waitFor();
  await page.setViewportSize({ width: 440, height: 900 });
  await page.waitForFunction(() => document.querySelector('.community-market')?.clientWidth > 300);
  await page.screenshot({ path: 'artifacts/dsh-integration/extensions-ja.png', fullPage: true });
  assert.ok(await page.locator('.community-market').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
});

test('extension review blocks incompatible packages and keeps uncertain retries bound to the same plan', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('button', { name: '我的资源', exact: true }).click();
  await page.getByRole('button', { name: '已安装扩展', exact: true }).click();
  await page.getByText('运行环境：web · DSH 0.1.5-rc.2', { exact: true }).waitFor();
  const plan = { id: crypto.randomUUID(), action: 'install', name: 'ui-fixture', version: '1.0.0', profile: 'web', hostVersion: '0.1.5-rc.2', routes: ['native'], compatibility: { route: 'native', state: 'incompatible', issues: ['host-version'] }, allowed: false, license: 'MIT', source: null, permissions: [], restartRequired: true };
  const executions = [];
  await page.route('**/api/community/extensions', route => {
    const command = route.request().postDataJSON();
    if (command.action !== 'execute') return route.fulfill({ json: plan });
    executions.push(command);
    if (executions.length === 1) return route.abort('failed');
    return route.fulfill({ json: { status: 'restart-required', action: 'install', operationId: crypto.randomUUID(), name: plan.name, version: plan.version, backupCreated: true } });
  });
  await page.getByRole('textbox', { name: 'npm 包与固定版本', exact: true }).fill('ui-fixture@1.0.0');
  await page.getByRole('button', { name: '检查安装', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认安装变更', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('button', { name: '确认安装到此环境', exact: true }).isDisabled(), true);
  assert.equal(executions.length, 0);
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click();
  plan.compatibility.state = 'unverified'; plan.compatibility.issues = []; plan.allowed = true;
  await page.getByRole('button', { name: '检查安装', exact: true }).click();
  await dialog.getByRole('button', { name: '确认安装到此环境', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  await dialog.getByRole('button', { name: '确认安装到此环境', exact: true }).click();
  await dialog.getByText('环境变更已确认。请重启 DSH，再检查入口状态。', { exact: true }).waitFor();
  assert.equal(executions.length, 2); assert.equal(executions[0].requestId, executions[1].requestId);
  await page.screenshot({ path: 'artifacts/dsh-integration/extensions-review.png', fullPage: true });
});

async function downloadResource(page, buttonName) {
  const download = page.waitForEvent('download', { timeout: 60000 });
  const response = page.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === '/api/community' && request.method() === 'POST' && request.postDataJSON()?.action === 'download';
  }, { timeout: 60000 });
  const [file] = await Promise.all([download, (async () => {
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    const result = await response;
    if (!result.ok()) {
      const body = await result.json();
      throw new Error(`Archive download failed (${result.status()}): ${body.error}`);
    }
  })()]);
  return file;
}

async function resumeSkillChecks(page) {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/community/sources' && response.request().postDataJSON()?.action === 'setAutomatic');
  await page.getByRole('region', { name: 'Anthropic Skills' }).getByRole('button', { name: '恢复自动检查', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200);
  const source = (await result.json()).find(row => row.id === 'skills');
  if (!source.syncing && source.state !== 'fresh') assert.fail(source.error || source.state);
  const row = page.getByRole('region', { name: 'Anthropic Skills' });
  await row.getByRole('button', { name: '暂停自动检查', exact: true }).waitFor();
  const status = row.getByRole('status').filter({ hasText: /^(已更新|保留上次目录|读取失败)$/ });
  await status.waitFor({ timeout: 45000 });
  assert.equal(await status.innerText(), '已更新', (await row.getByRole('alert').allTextContents()).join(' '));
}

async function openAuthorDocuments(page) {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/community/documentation', { timeout: 45000 });
  await Promise.all([page.getByRole('button', { name: '作者文档', exact: true }).click(), (async () => {
    const result = await response;
    if (!result.ok()) {
      const body = await Promise.race([result.json().catch(() => null), delay(500).then(() => null)]);
      throw new Error(`Author documentation failed (${result.status()}): ${body?.error || 'response body unavailable'}`);
    }
  })()]);
  await page.locator('.readme-body').waitFor({ timeout: 45000 });
}

async function previewPrompt(page, period) {
  await page.getByRole('button', { name: '周报使用示例', exact: true }).click();
  await page.getByRole('textbox', { name: '报告周期', exact: true }).fill(period);
  await page.getByRole('textbox', { name: '本周记录', exact: true }).fill('保留已有资料');
  await page.getByRole('textbox', { name: '下周计划', exact: true }).fill('验证下一步');
  await page.getByRole('button', { name: '预览模板', exact: true }).click();
}

test('market entry works in a fresh host before a target session exists', async t => {
  const page = await openLab(t);
  const hostButtonStyle = () => page.getByRole('button', { name: '新建会话', exact: true }).first().evaluate(element => { const style = getComputedStyle(element); return [style.color, style.backgroundColor, style.fontFamily, style.borderRadius, style.padding]; });
  const beforeMarket = await hostButtonStyle();
  assert.equal(await page.getByRole('treeitem', { name: '新会话', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '周报使用示例', exact: true }).count(), 0);
  await page.getByRole('button', { name: '扩展市场', exact: true }).waitFor({ timeout: 10000 });
  const starResponse = page.waitForResponse(response => response.url().includes('/api/community/stars'));
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const response = await starResponse;
  assert.equal(response.status(), 200);
  await writeFile('artifacts/dsh-integration/repository-stars-live.json', JSON.stringify(await response.json(), null, 2) + '\n');
  await page.getByRole('heading', { name: '发现资源', exact: true }).waitFor();
  assert.deepEqual(await hostButtonStyle(), beforeMarket, 'Market styles must not change native host controls');
  const cards = page.locator('.resource-card');
  assert.equal(await cards.locator('[aria-label="资源统计"]').count(), await cards.count(), 'Every resource card keeps its metrics row');
  assert.equal(await page.getByRole('combobox', { name: '资源排序' }).locator('option[value="stars"]').count(), 1, 'Repository Stars can be sorted independently');
  const featured = page.getByRole('button', { name: '查看代码审查 Prompt', exact: true });
  assert.equal(await featured.count(), 1, 'The market has one actionable featured banner');
  await featured.click();
  await page.getByRole('heading', { name: '代码审查助手', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '扩展市场', exact: true }).locator('[data-market-logo]').count(), 1);
  await page.getByRole('button', { name: '在当前会话使用', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '请先在 DSH 创建或选择会话' }).waitFor();
  await page.locator('.community-market').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('combobox', { name: '界面语言', exact: true }).waitFor();
  await page.getByRole('button', { name: '发现', exact: true }).click();
  await page.screenshot({ path: 'artifacts/dsh-integration/host-market.png', fullPage: true });
});

test('market metrics remain visible across types, count actual GitHub downloads and expose stale Star states', async t => {
  const page = await openLab(t);
  const fixture = {
    'f/prompts.chat': { count: 12345, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' },
    'deepseek-ai/deepseek-harness': { count: 120, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' },
    'anthropics/skills': { count: null, checkedAt: '', state: 'unavailable' },
    'modelcontextprotocol/servers': { count: 0, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' },
  };
  await page.route('**/api/community/stars*', route => route.fulfill({ headers: { 'x-test-star-state': fixture['f/prompts.chat'].state }, json: fixture }));
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const code = page.getByRole('button', { name: '查看 代码审查助手', exact: true });
  await code.getByText('仓库 Star 1.2万', { exact: true }).waitFor();
  assert.match(await code.locator('.repo-stars').getAttribute('title'), /f\/prompts.chat 整个仓库/);
  assert.equal(await code.getByText('未评分', { exact: true }).count(), 1);
  for (const type of ['插件', 'Skill', 'MCP', 'Slash', 'Prompt']) {
    await page.getByRole('button', { name: type, exact: true }).click();
    const cards = page.locator('.resource-card');
    await cards.first().waitFor();
    assert.equal(await cards.first().locator('.card-tags span').first().innerText(), type);
    assert.equal(await cards.locator('[aria-label="资源统计"]').count(), await cards.count());
  }
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.getByRole('combobox', { name: '资源排序' }).selectOption('stars');
  assert.match(await page.locator('.resource-card').first().innerText(), /Prompt/);
  await page.getByRole('button', { name: '查看 文件系统工具', exact: true }).getByText('仓库 Star 0', { exact: true }).waitFor();
  await page.getByRole('button', { name: '查看 内部沟通助手', exact: true }).getByText('仓库 Star 暂不可用', { exact: true }).waitFor();
  const origin = new URL(page.url()).origin;
  const before = (await (await page.request.get(origin + '/api/community/read')).json()).stats['github-code-reviewer'].downloads;
  await code.click();
  await page.getByText('f/prompts.chat 整个仓库的 GitHub Star。', { exact: true }).waitFor();
  let lose = true;
  await page.route('**/api/community', async route => {
    if (route.request().postDataJSON()?.action === 'download' && lose) { lose = false; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: '下载 Prompt 文本', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: /连接中断|fetch/ }).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 Prompt 文本', exact: true }).click();
  assert.match(await readFile(await (await downloadEvent).path(), 'utf8'), /rajudandigam/);
  await page.getByText(`下载 ${before + 1}`, { exact: true }).waitFor();
  await page.getByRole('button', { name: '收藏到本机', exact: true }).click();
  await page.getByText('已收藏', { exact: true }).waitFor();
  await page.getByRole('combobox', { name: '我的评分' }).selectOption('4');
  await page.getByRole('button', { name: '保存评分', exact: true }).click();
  await page.getByText('我的评分 4/5', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.locator('.community-market .search-field input').fill('代码审查助手');
  await page.getByRole('button', { name: '查看 代码审查助手', exact: true }).getByText('已收藏', { exact: true }).waitFor();
  await code.getByText('仓库 Star 1.2万', { exact: true }).waitFor();
  fixture['f/prompts.chat'].state = 'stale';
  const refreshedStars = page.waitForResponse(response => response.url().includes('/api/community/stars') && response.headers()['x-test-star-state'] === 'stale');
  await page.getByRole('button', { name: '刷新市场', exact: true }).click();
  assert.equal((await (await refreshedStars).json())['f/prompts.chat'].state, 'stale');
  await page.getByRole('button', { name: '查看 代码审查助手', exact: true }).getByText('仓库 Star 1.2万 · 缓存', { exact: true }).waitFor();
  await page.getByRole('button', { name: '收起侧边栏', exact: true }).click();
  await page.getByRole('button', { name: '打开侧边栏', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.community-market')?.clientWidth > 300);
  assert.ok(await page.locator('.community-market').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
});

test('archive HTTP failures are reported before the download event deadline', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '内部沟通助手');
  await page.route('**/api/community', route => {
    const request = route.request();
    if (request.method() === 'POST' && request.postDataJSON()?.action === 'download') return route.fulfill({ status: 502, json: { error: 'upstream request timed out' } });
    return route.continue();
  });
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/community' && response.status() === 502);
  const outcome = downloadResource(page, '下载完整 Skill ZIP').then(() => ({ downloaded: true }), error => ({ error }));
  await response;
  const result = await Promise.race([outcome, delay(1500).then(() => ({ waiting: true }))]);
  assert.match(result.error?.message || 'Still waiting for a download after HTTP failure', /502.*upstream request timed out/);
  await page.getByText('下载 0', { exact: true }).waitFor();
});

test('source failures are reported before the updated UI deadline', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.locator('.community-market').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('region', { name: 'Anthropic Skills' }).getByRole('button', { name: '暂停自动检查', exact: true }).click();
  await page.getByRole('region', { name: 'Anthropic Skills' }).getByRole('button', { name: '恢复自动检查', exact: true }).waitFor();
  const origin = new URL(page.url()).origin;
  const sources = await (await page.request.get(origin + '/api/community/sources/read')).json();
  const skills = sources.find(row => row.id === 'skills');
  Object.assign(skills, { automatic: true, state: 'stale', syncing: false, error: '来源返回 403，请稍后重试' });
  await page.route('**/api/community/sources', route => route.fulfill({ json: sources }));
  const resumed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/community/sources');
  const sync = resumeSkillChecks(page).then(() => ({}), error => ({ error }));
  await resumed;
  const syncResult = await Promise.race([sync, delay(1500).then(() => ({}))]);
  await page.unroute('**/api/community/sources');
  const restored = await page.request.post(origin + '/api/community/sources', { headers: { origin, 'x-community-request': '1' }, data: { sourceId: 'skills', action: 'setAutomatic', enabled: true } });
  assert.equal(restored.status(), 200);
  assert.match(syncResult.error?.message || 'Still waiting for updated source UI', /403/);
});

test('documentation failures are reported before the rendered UI deadline', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '规划模式');
  await page.route('**/api/community/documentation?*', route => route.fulfill({ status: 502, json: { error: '来源返回 403，请稍后重试' } }));
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/community/documentation');
  const document = openAuthorDocuments(page).then(() => ({}), error => ({ error }));
  await response;
  const documentResult = await Promise.race([document, delay(1500).then(() => ({}))]);
  assert.match(documentResult.error?.message || 'Still waiting for document success UI', /502.*403/);
});

test('expanded sources deliver Skill archives, plugin packages, MCP definitions and linked Slash entries', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.locator('.community-market .search-field input').fill('内部沟通助手');
  await page.getByRole('button', { name: '查看 内部沟通助手', exact: true }).waitFor();
  const origin = new URL(page.url()).origin;
  const snapshot = await (await page.request.get(origin + '/api/community/read')).json();
  const sourceResponse = await page.request.get(origin + '/api/community/sources/read');
  assert.equal(sourceResponse.status(), 200, await sourceResponse.text());
  assert.deepEqual((await sourceResponse.json()).map(row => row.id).sort(), SOURCE_DEFINITIONS.map(row => row.id).sort());
  for (const item of mergeSourceResources(sourceCatalog.flatMap(row => row.entries))) assert(snapshot.catalog.some(value => value.id === item.id), item.id);
  assert.equal(new Set(snapshot.catalog.map(item => item.id)).size, snapshot.catalog.length);
  assert.equal(snapshot.catalog.filter(item => item.sourceId === 'community' && item.type === 'Prompt').length, 8);
  assert.equal(await page.getByRole('button', { name: '查看 内部沟通助手', exact: true }).count(), 1, 'Live entry replaces its old sample');
  await openResource(page, '内部沟通助手');
  const zip = await downloadResource(page, '下载完整 Skill ZIP');
  const files = unzipSync(await readFile(await zip.path()));
  assert.ok(files['internal-comms/LICENSE.txt']);
  assert.ok(files['internal-comms/examples/general-comms.md']);
  assert.match(Buffer.from(files['internal-comms/SKILL.md']).toString(), /internal-comms/);
  await page.getByText('下载 1', { exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/dsh-integration/source-skill.png', fullPage: true });
  await page.getByRole('button', { name: '发现', exact: true }).click();
  await openResource(page, '/plan');
  await page.getByRole('button', { name: '所属插件：规划模式', exact: true }).click();
  const archive = await downloadResource(page, '下载插件发布包');
  const tar = Buffer.from(gunzipSync(await readFile(await archive.path())));
  let manifest;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, '');
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    if (name === 'package/package.json') manifest = JSON.parse(tar.subarray(offset + 512, offset + 512 + size).toString());
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.equal(manifest?.name, '@deepseek-ai/dsh-plan-mode');
  assert.equal(manifest.version, '0.1.5-rc.2');
  await page.getByRole('button', { name: '发现', exact: true }).click();
  await openResource(page, 'Microsoft Learn 文档');
  const definitionEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 MCP 服务定义', exact: true }).click();
  const definition = JSON.parse(await readFile(await (await definitionEvent).path(), 'utf8'));
  assert.equal(definition.name, 'com.microsoft/microsoft-learn-mcp');
  assert.equal(definition.remotes[0].type, 'streamable-http');
  await page.locator('.community-market').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('region', { name: 'DSH 官方插件与命令', exact: true }).waitFor();
  await page.route('**/api/community/sources', async route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '更新 DSH 官方插件与命令', exact: true }).click();
  await page.locator('.market-status[role="alert"]').filter({ hasText: /连接中断|fetch/ }).waitFor();
  await page.unroute('**/api/community/sources');
  await page.getByRole('button', { name: '更新 DSH 官方插件与命令', exact: true }).click();
  await page.getByRole('region', { name: 'DSH 官方插件与命令', exact: true }).getByRole('status').filter({ hasText: /^已更新$/ }).waitFor();
  const updated = await (await page.request.get(origin + '/api/community/read')).json();
  assert.equal(updated.catalog.filter(item => item.sourceId === 'dsh').length, 7);
  await page.screenshot({ path: 'artifacts/dsh-integration/source-settings.png', fullPage: true });
});

test('a discovered npm theme opens a fixed-version installation review', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const item = sourceCatalog.flatMap(row => row.entries).find(item => item.packageRef?.name === 'dsh-skin-galactic-opera');
  await openResource(page, item.title);
  await page.getByRole('button', { name: '检查安装', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'npm 包与固定版本', exact: true });
  assert.equal(await field.inputValue(), item.packageRef.name + '@' + item.packageRef.version);
  await page.getByRole('button', { name: '检查安装', exact: true }).click();
  const review = page.getByRole('dialog', { name: '确认安装变更', exact: true });
  await review.waitFor();
  await review.getByText(item.packageRef.name + '@' + item.packageRef.version, { exact: true }).waitFor();
  assert.equal(await review.getByRole('button', { name: '确认安装到此环境', exact: true }).isEnabled(), true);
});

test('Star ranking discloses partial coverage and can discover a high-Star repository beyond its first page', async t => {
  const page = await openLab(t);
  const template = sourceCatalog.flatMap(row => row.entries).find(item => item.type === '主题');
  const catalog = Array.from({ length: 49 }, (_, i) => ({ ...template, id: 'source-ranking-' + i, title: '排名 ' + i, url: 'https://github.com/ranker/repo-' + i }));
  await page.route('**/api/community/read', route => route.fulfill({ json: { schema: 2, catalog, stats: {} } }));
  await page.route('**/api/community/stars*', route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',') || [];
    assert(ids.length <= 60);
    const values = catalog.filter(item => ids.includes(item.id)).map(item => [item.url.replace('https://github.com/', ''), { count: item.id === 'source-ranking-48' ? 10000 : 1, state: 'fresh', checkedAt: '2026-09-14T00:00:00Z' }]);
    return route.fulfill({ json: Object.fromEntries(values) });
  });
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('button', { name: '主题', exact: true }).click();
  await page.locator('.resource-card').nth(47).waitFor();
  await page.getByRole('combobox', { name: '资源排序' }).selectOption('stars');
  await page.locator('.star-ranking-note').filter({ hasText: '48/49' }).waitFor();
  assert.match(await page.locator('.star-ranking-note').innerText(), /未读取/);
  assert.equal(await page.getByRole('button', { name: '查看 排名 48', exact: true }).count(), 0);
  await page.getByRole('button', { name: '显示更多', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.resource-card')?.getAttribute('aria-label') === '查看 排名 48');
  await page.locator('.star-ranking-note').filter({ hasText: '49/49' }).waitFor();
});

test('market follows host theme, scopes its styles, and reflows at narrow widths', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('heading', { name: '发现资源', exact: true }).waitFor();
  const market = page.locator('.community-market');
  assert.match(await market.evaluate(element => getComputedStyle(element).fontFamily), /Segoe UI/);
  const nativeBackground = () => market.evaluate(element => {
    const context = new OffscreenCanvas(1, 1).getContext('2d');
    const normalize = value => { context.fillStyle = value; return context.fillStyle; };
    return { actual: normalize(getComputedStyle(element).backgroundColor), native: normalize(getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim()) };
  });
  const light = await nativeBackground();
  assert.equal(light.actual, light.native);
  assert.equal(await page.getByRole('button', { name: '查看代码审查 Prompt', exact: true }).count(), 1);
  await page.getByRole('button', { name: '设置', exact: true }).first().click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const dark = await nativeBackground();
  assert.equal(dark.actual, dark.native);
  assert.notEqual(dark.actual, light.actual);
  await page.getByRole('button', { name: '发现', exact: true }).click();
  await page.screenshot({ path: 'artifacts/dsh-integration/community-dark.png', fullPage: true });
  const collapse = page.getByRole('button', { name: '收起侧边栏', exact: true });
  await collapse.click();
  await page.getByRole('button', { name: '打开侧边栏', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.community-market')?.clientWidth > 300);
  if (await market.evaluate(element => element.scrollWidth > element.clientWidth + 1)) t.diagnostic(await market.evaluate(element => JSON.stringify({ width: element.clientWidth, scroll: element.scrollWidth, overflowing: [...element.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > element.getBoundingClientRect().right).slice(0, 12).map(child => [child.tagName, child.className, child.getBoundingClientRect().width]) })));
  assert.equal(await market.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'No horizontal market overflow');
  await page.getByRole('textbox', { name: '搜索扩展资源', exact: true }).fill('不存在的资源');
  assert.equal(await page.getByRole('button', { name: '查看代码审查 Prompt', exact: true }).count(), 0, 'Active search prioritizes results over recommendations');
  await page.getByRole('heading', { name: '没有找到匹配的资源', exact: true }).waitFor();
  await page.getByRole('textbox', { name: '搜索扩展资源', exact: true }).fill('');
  await page.screenshot({ path: 'artifacts/dsh-integration/community-mobile.png', fullPage: true });
});

test('submissions retain authorship and draft data for every resource type without account requests', async t => {
  const page = await openLab(t);
  const writes = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/community')) writes.push(request.postDataJSON()); });
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('button', { name: '分享资源', exact: true }).click();
  await page.getByRole('textbox', { name: '资源名称', exact: true }).fill('投稿测试资源');
  await page.getByRole('textbox', { name: '资源编号', exact: true }).fill('test-resource');
  await page.getByRole('textbox', { name: '用途说明', exact: true }).fill('根据作者的原始说明使用');
  await page.getByRole('textbox', { name: '原作者 GitHub 用户名', exact: true }).fill('original-author');
  await page.getByRole('combobox', { name: '作品许可', exact: true }).selectOption('MIT');
  await page.getByRole('textbox', { name: '发布地址', exact: true }).fill('https://github.com/author/resource');
  await page.getByRole('textbox', { name: '内容', exact: true }).fill('原始内容 {{材料}}');
  await page.getByRole('button', { name: '保存本机草稿', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: '扩展市场', exact: true }).click(); await page.getByRole('button', { name: '分享资源', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '原作者 GitHub 用户名', exact: true }).inputValue(), 'original-author');
  for (const type of ['插件', 'Skill', 'MCP', 'Slash', 'Prompt', '主题']) {
    await page.getByRole('combobox', { name: '资源类型', exact: true }).selectOption(type);
    await page.getByRole('button', { name: '预览投稿', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '准备 GitHub 投稿' });
    await dialog.waitFor();
    const event = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '导出 GitHub 投稿文件', exact: true }).click();
    const entry = JSON.parse(await readFile(await (await event).path(), 'utf8'));
    assert.equal(entry.author, 'original-author'); assert.equal(entry.type, type); assert.equal(entry.body, '原始内容 {{材料}}');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: '预览投稿', exact: true }).evaluate(element => element === document.activeElement), true);
  }
  assert.deepEqual(writes, [], 'Attribution and personal data need no market account or publication API');
  assert.equal(await page.getByRole('textbox', { name: '密码', exact: true }).count(), 0);
});

test('theme category shows discovered packages, real empty searches and localized submission guidance on narrow screens', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const market = page.locator('.community-market');
  await page.getByRole('button', { name: '主题', exact: true }).click();
  await market.locator('.resource-card').first().waitFor();
  const themes = sourceCatalog.flatMap(row => row.entries).filter(item => item.type === '主题');
  for (const theme of themes) await page.getByRole('button', { name: '查看 ' + theme.title, exact: true }).waitFor();
  await market.locator('.search-field input').fill('no-matching-theme-7ca169');
  assert.equal(await market.locator('.resource-card').count(), 0);
  await market.locator('.search-field input').fill('');
  await page.getByRole('button', { name: '分享资源', exact: true }).click();
  await page.getByRole('combobox', { name: '资源类型', exact: true }).selectOption('主题');
  await page.getByText(/说明主题插件或配色文件/).waitFor();
  for (const [language, settings, languageLabel, discover, theme, share, typeLabel] of [
    ['en-US', '设置', '界面语言', 'Discover', 'Themes', 'Submit a resource', 'Resource type'],
    ['ja-JP', 'Settings', 'Interface language', '探す', 'テーマ', 'リソースを投稿', 'リソースの種類'],
  ]) {
    await market.getByRole('button', { name: settings, exact: true }).click();
    await page.getByRole('combobox', { name: languageLabel, exact: true }).selectOption(language);
    await market.getByRole('button', { name: discover, exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    assert.equal(await market.locator('.resource-card').count(), themes.length);
    await page.getByRole('button', { name: share, exact: true }).click();
    await page.getByRole('combobox', { name: typeLabel, exact: true }).selectOption('主题');
    assert.doesNotMatch(await market.innerText(), /typeTheme|themeSubmissionNote/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.community-market')?.clientWidth > 300);
  assert.ok(await market.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
  await page.screenshot({ path: path.join(lab, 'theme-submission-ja-narrow.png'), fullPage: true });
});

test('settings persist three languages, personal data and automatic discovery preferences', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const market = page.locator('.community-market');
  await market.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('region', { name: 'Anthropic Skills' }).getByRole('button', { name: '暂停自动检查', exact: true }).click();
  await page.getByText('自动检查已暂停', { exact: false }).waitFor();
  await page.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en-US');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.reload(); await page.getByRole('button', { name: 'Marketplace', exact: true }).click();
  await market.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('region', { name: 'Anthropic Skills' }).getByRole('button', { name: 'Resume automatic checks', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Interface language', exact: true }).selectOption('ja-JP');
  await page.getByRole('heading', { name: '設定', exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/dsh-integration/settings-ja.png', fullPage: true });
  await page.getByRole('combobox', { name: '表示言語', exact: true }).selectOption('zh-CN');
  await resumeSkillChecks(page);
  const row = page.getByRole('region', { name: 'Anthropic Skills' });
  await row.getByText(/扫描 19 项/).waitFor();
  await row.getByText('查看未收录原因', { exact: true }).click();
  assert.match(await row.innerText(), /pdf/);
  await market.getByRole('button', { name: '发现', exact: true }).click();
  await page.getByRole('combobox', { name: '用途分类', exact: true }).selectOption('design');
  assert.ok(await page.getByRole('button', { name: '查看 algorithmic-art', exact: true }).count());
  assert.equal(await page.getByRole('button', { name: '查看 代码审查助手', exact: true }).count(), 0);
  await openResource(page, 'algorithmic-art');
  const zip = await downloadResource(page, '下载完整 Skill ZIP');
  const archive = unzipSync(await readFile(await zip.path()));
  assert(archive['algorithmic-art/SKILL.md']); assert(archive['algorithmic-art/LICENSE.txt']);
});

test('resource information shows actual host composition without claiming installation or enabling plugins', async t => {
  const page = await openLab(t);
  const patchFile = path.join(lab, 'home/profiles/web/cordis.patch.yml');
  const originalPatch = await readFile(patchFile, 'utf8');
  const writes = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/community')) writes.push(request.url()); });
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/community/availability');
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const inventory = await response.json();
  await writeFile(path.join(lab, 'availability.json'), JSON.stringify(inventory, null, 2) + '\n');
  const resource = inventory.resources['source-dsh-plan-mode'];
  assert.equal(resource.detected, true, 'Pinned DSH actually includes the planning module');
  assert.ok(resource.locations.length > 0);
  await page.locator('.community-market .search-field input').fill('规划模式');
  const card = page.getByRole('button', { name: '查看 规划模式', exact: true });
  await card.getByText('宿主已有记录', { exact: true }).waitFor();
  assert.equal(await card.getByText('0.1.5-rc.2', { exact: true }).count(), 1);
  assert.equal(await card.getByText('MIT', { exact: true }).count(), 1);
  assert.equal(await card.getByText('deepseek-ai/deepseek-harness', { exact: true }).count(), 1);
  await page.screenshot({ path: path.join(lab, 'market-information.png'), fullPage: true });
  await card.click();
  assert.equal(await page.locator('.community-market').evaluate(element => element.scrollTop), 0, 'Opening a resource starts at its heading');
  const presence = page.getByRole('region', { name: '宿主状态', exact: true });
  await presence.locator('li').first().waitFor();
  assert.equal(await presence.locator('li').count(), resource.locations.length);
  const labels = { configured: '已配置', active: '已加载', disabled: '已停用', conditional: '条件启用', failed: '加载失败', pending: '等待依赖', loading: '加载中', unloading: '卸载中' };
  assert.deepEqual(await presence.locator('.phase-label').allTextContents(), resource.locations.map(row => labels[row.state]));
  assert.equal(await page.getByRole('button', { name: '一键安装', exact: true }).count(), 0);
  await page.getByRole('heading', { name: '如何使用', exact: true }).waitFor();
  await page.getByRole('region', { name: '资源信息', exact: true }).getByText('@deepseek-ai/dsh-plan-mode', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(lab, 'plugin-information.png'), fullPage: true });
  await page.getByRole('button', { name: '收起侧边栏', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.community-market')?.clientWidth > 300);
  assert.equal(await page.locator('.community-market').evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
  const aside = await page.locator('.action-panel').boundingBox();
  const content = await page.locator('.detail-main').boundingBox();
  assert(aside.y < content.y, 'Getting the resource stays before long documentation on narrow screens');
  await page.screenshot({ path: path.join(lab, 'plugin-information-narrow.png'), fullPage: true });
  assert.deepEqual(writes, [], 'Reading host state never triggers installation or model usage');
  assert.equal(await readFile(patchFile, 'utf8'), originalPatch);
});

test('host state errors stay unknown and retry restores real state', async t => {
  const page = await openLab(t);
  await page.route('**/api/community/availability', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '规划模式');
  const presence = page.getByRole('region', { name: '宿主状态', exact: true });
  await presence.getByRole('alert').waitFor();
  assert.equal(await presence.getByText('宿主已有记录', { exact: true }).count(), 0);
  await page.unroute('**/api/community/availability');
  await page.getByRole('button', { name: '刷新宿主状态', exact: true }).click();
  await presence.locator('li').first().waitFor();
  assert.equal(await presence.getByRole('alert').count(), 0);
  for (const [locale, settings, field, title] of [
    ['en-US', '设置', '界面语言', 'How to use'],
    ['ja-JP', 'Settings', 'Interface language', '使い方'],
  ]) {
    await page.locator('.community-market').getByRole('button', { name: settings, exact: true }).click();
    await page.getByRole('combobox', { name: field, exact: true }).selectOption(locale);
    // Navigation labels come from the shipped dictionary, not a second translation table.
    const dictionary = JSON.parse(await readFile(`languages/${locale}.json`, 'utf8'));
    await page.getByRole('button', { name: dictionary.discover, exact: true }).click();
    await page.getByRole('button', { name: dictionary.view.replace('{title}', '规划模式'), exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.getByRole('region', { name: dictionary.hostStatus, exact: true }).waitFor();
  }
});

test('author documents render actual pinned README content and retry failures without unsafe HTML', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '规划模式');
  await openAuthorDocuments(page);
  assert.match(await page.locator('.readme-body').innerText(), /plan/i);
  assert.match(await page.locator('.author-documentation .section-head strong').innerText(), /README\.zh\.md/);
  assert.doesNotMatch(await page.locator('.readme-body').innerText(), /kind:.*package-reference/);
  assert.match(await page.getByRole('link', { name: '查看文档原文 ↗', exact: true }).getAttribute('href'), /\/blob\/[a-f0-9]{40}\/packages\//);
  await page.screenshot({ path: 'artifacts/dsh-integration/resource-readme.png', fullPage: true });
  await page.getByRole('button', { name: 'README.md', exact: true }).click();
  assert.match(await page.getByRole('link', { name: '查看文档原文 ↗', exact: true }).getAttribute('href'), /\/README\.md$/);
  await page.getByRole('button', { name: '发现', exact: true }).click();
  await openResource(page, '内部沟通助手');
  await page.route('**/api/community/documentation?*', route => route.abort('failed'));
  await page.getByRole('button', { name: '作者文档', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '文档读取失败' }).waitFor();
  await page.unroute('**/api/community/documentation?*');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await page.locator('.readme-body').waitFor();
  assert.match(await page.locator('.readme-body').innerText(), /To write internal communications/);
  assert.match(await page.locator('.author-documentation details pre').textContent(), /name: internal-comms/);
  await page.route('**/api/community/documentation?*', route => route.fulfill({ json: { schema: 1, state: 'available', scope: 'resource', versionMatch: true, checkedAt: '', files: [{ name: 'README.md', body: '# Safe heading\n<script>alert(1)</script>\n[x](javascript:alert(1))\n[guide](./guide.md)\n![tracking](https://example.com/image.png)', url: 'https://github.com/owner/repo/blob/' + 'a'.repeat(40) + '/README.md', commit: 'a'.repeat(40) }] } }));
  await page.getByRole('button', { name: '概况', exact: true }).click();
  await page.getByRole('button', { name: '作者文档', exact: true }).click();
  await page.getByRole('heading', { name: 'Safe heading', exact: true }).waitFor();
  assert.equal(await page.locator('.readme-body script, .readme-body img, .readme-body a[href^="javascript:"]').count(), 0);
  assert.match(await page.getByRole('link', { name: 'guide', exact: true }).getAttribute('href'), /\/guide.md$/);
});

test('document translation is explicit, uses the selected host model and preserves the original', async t => {
  const page = await openLab(t);
  const requests = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/community/translation') requests.push(request); });
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '代码审查助手');
  await page.getByRole('button', { name: '作者文档', exact: true }).click();
  const original = await page.locator('.readme-body').innerText();
  await page.getByRole('button', { name: '翻译文档', exact: true }).click();
  await page.getByRole('combobox', { name: '模型服务商', exact: true }).selectOption('market-test');
  await page.getByRole('combobox', { name: '翻译模型', exact: true }).selectOption('test-translate');
  assert.equal(requests.length, 0);
  await page.getByText(/会消耗该模型的 Token 额度/).waitFor();
  await page.getByRole('button', { name: '开始翻译（消耗 Token）', exact: true }).dblclick();
  await page.getByRole('heading', { name: '翻译验收样例', exact: true }).waitFor();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].postDataJSON().model, 'test-translate');
  await page.getByText('服务商报告用量：输入 40 Token（含缓存），输出 15 Token。', { exact: true }).waitFor();
  assert.equal(await page.locator('.readme-body script, .readme-body a[href^="javascript:"]').count(), 0);
  await page.screenshot({ path: 'artifacts/dsh-integration/document-translation.png', fullPage: true });
  await page.setViewportSize({ width: 600, height: 950 });
  await page.screenshot({ path: 'artifacts/dsh-integration/document-translation-narrow.png', fullPage: true });
  assert.equal(await page.locator('.community-market').evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
  await page.getByRole('button', { name: '原文', exact: true }).click();
  assert.equal(await page.locator('.readme-body').innerText(), original);
  await page.getByRole('button', { name: '译文', exact: true }).click();
  assert.equal(requests.length, 1);
  await page.getByRole('combobox', { name: '翻译模型', exact: true }).selectOption('test-fail');
  await page.getByRole('button', { name: '开始翻译（消耗 Token）', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '模型额度或速率受限' }).waitFor();
  assert.equal(requests.length, 2, 'a failed translation is not automatically retried');
  assert.equal(await page.getByRole('heading', { name: '翻译验收样例', exact: true }).count(), 1, 'prior translation survives failure');
  const calls = (await readFile(path.join(lab, 'home/translation-test-calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)).filter(entry => entry.event === 'call');
  assert.deepEqual(calls.map(entry => entry.model), ['test-translate', 'test-fail']);
  assert(calls.every(entry => entry.messages === 1 && !entry.tools && !entry.session));
});

test('translation cancellation leaves the original and does not leak results into another resource', async t => {
  const page = await openLab(t);
  const calls = () => readFile(path.join(lab, 'home/translation-test-calls.jsonl'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '代码审查助手');
  await page.getByRole('button', { name: '作者文档', exact: true }).click();
  const original = await page.locator('.readme-body').innerText();
  await page.getByRole('button', { name: '翻译文档', exact: true }).click();
  await page.getByRole('combobox', { name: '模型服务商', exact: true }).selectOption('market-test');
  await page.getByRole('combobox', { name: '翻译模型', exact: true }).selectOption('test-slow');
  await page.getByRole('button', { name: '开始翻译（消耗 Token）', exact: true }).click();
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await calls()).includes('test-slow')) break;
    await delay(50);
  }
  assert.match(await calls(), /test-slow/, 'The selected host model must have started before cancellation');
  await page.getByRole('button', { name: '取消翻译', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '翻译已取消或超时' }).waitFor();
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await calls()).includes('"event":"aborted"')) break;
    await delay(50);
  }
  assert.match(await calls(), /"event":"aborted"/);
  assert.equal(await page.locator('.readme-body').innerText(), original);
  await page.getByRole('button', { name: '发现', exact: true }).click();
  await openResource(page, '提交信息生成器');
  await page.getByRole('button', { name: '作者文档', exact: true }).click();
  await page.locator('.readme-body').waitFor();
  assert.notEqual(await page.locator('.readme-body').innerText(), original);
  assert.equal(await page.getByRole('button', { name: '译文', exact: true }).count(), 0);
});

test('Prompt content follows the real host font-size setting', async t => {
  const page = await openLab(t);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '把零散记录，整理成周报');
  const before = await page.locator('.market-detail .content-preview').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  await page.getByRole('button', { name: '设置', exact: true }).first().click();
  await page.getByRole('button', { name: '增大字号', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.waitForFunction(size => parseFloat(getComputedStyle(document.querySelector('.market-detail .content-preview')).fontSize) === size + 1, before);
});

test('market Slash action executes the real plan command and preserves the session draft', async t => {
  const page = await openLab(t);
  await chooseWorkspace(page);
  const composer = page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true });
  await composer.fill('命令执行前已有的草稿 @report');
  await page.getByRole('option', { name: 'report.md', exact: true }).click();
  const before = await composer.innerHTML();
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await openResource(page, '/plan');
  await page.getByRole('button', { name: '在会话中运行命令', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认会话命令', exact: true });
  await dialog.getByRole('button', { name: '运行到当前会话', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: /Plan mode on|进入规划模式/ }).waitFor();
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('button', { name: '在会话中运行命令', exact: true }).click();
  await dialog.getByRole('textbox', { name: '命令参数（可选）', exact: true }).fill('off');
  await dialog.getByRole('button', { name: '运行到当前会话', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: /Plan mode off|退出规划模式/ }).waitFor();
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('treeitem', { name: '新会话', exact: true }).click();
  assert.equal(await composer.innerHTML(), before);
  assert.equal(await composer.locator('[data-composer-chip="reference"]').count(), 1, 'The reference survives the host panel remount');
});

test('GitHub contributor prompts keep attribution and work in the real composer', async t => {
  const page = await openLab(t);
  await chooseWorkspace(page);
  const composer = page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true });
  await composer.fill('请结合当前项目的实际改动。');
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('button', { name: '查看代码审查 Prompt', exact: true }).click();
  await page.getByRole('heading', { name: '代码审查助手', exact: true }).waitFor();
  const source = page.getByRole('link', { name: '查看原作者发布地址 ↗', exact: true });
  assert.match(await source.getAttribute('href'), /eaab6b14a085f3b9e4461be90367fcd9a16d3204\/prompts.csv$/);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 Prompt 文本', exact: true }).click();
  const file = await readFile(await (await downloadEvent).path(), 'utf8');
  assert.match(file, /作者：rajudandigam/);
  assert.match(file, /许可：CC0-1.0/);
  assert.match(file, /I want you to act as a Code reviewer/);
  await page.getByRole('button', { name: '在当前会话使用', exact: true }).click();
  await page.getByRole('button', { name: '预览模板', exact: true }).click();
  await page.getByRole('button', { name: '追加到当前会话', exact: true }).click();
  await composer.filter({ hasText: 'I want you to act as a Code reviewer' }).waitFor();
  assert.match(await composer.innerText(), /^请结合当前项目的实际改动。/);
});

test('real composer keeps reference objects and uploaded attachments; stale previews cannot overwrite typing', async t => {
  const page = await openLab(t);
  const promptRequests = [];
  page.on('request', request => { if (/\/api\/(session|subagents)\/prompt(?:\?|$)/.test(request.url())) promptRequests.push(request.url()); });
  await chooseWorkspace(page);
  const composer = page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true });
  await composer.fill('已有记录 @report');
  await page.getByRole('option', { name: 'report.md', exact: true }).click();
  const chip = await composer.locator('[data-composer-chip="reference"]').elementHandle();
  assert(chip, 'The selected file is a real reference chip');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '添加附件', exact: true }).click();
  const uploaded = page.waitForResponse(response => response.request().method() === 'POST' && response.request().headers()['content-type'] === 'application/octet-stream');
  const bytes = Buffer.from('A generated test attachment, without private data.');
  await (await chooser).setFiles({ name: 'browser-generated-fixture.txt', mimeType: 'text/plain', buffer: bytes });
  const response = await uploaded;
  assert.equal(response.status(), 200);
  await page.getByText('browser-generated-fixture.txt', { exact: true }).first().waitFor();
  const attachment = await page.getByText('browser-generated-fixture.txt', { exact: true }).first().elementHandle();
  const digest = createHash('sha256').update(bytes).digest('hex');
  const stored = path.join(lab, `home/attachments/v1/files/${digest.slice(0, 2)}/${digest}/browser-generated-fixture.txt`);
  assert.deepEqual(await readFile(stored), bytes, 'The host persisted the generated attachment bytes');
  await page.getByRole('button', { name: '周报使用示例', exact: true }).click();
  await page.getByRole('textbox', { name: '报告周期', exact: true }).fill('真实宿主测试周');
  await page.getByRole('textbox', { name: '本周记录', exact: true }).fill('引用和附件应被保留');
  await page.getByRole('textbox', { name: '下周计划', exact: true }).fill('继续五类接入');
  await page.getByRole('button', { name: '预览模板', exact: true }).click();
  await composer.press('Control+End');
  await page.keyboard.insertText('预览后的新内容');
  const changedDraft = await composer.innerText();
  await page.getByRole('button', { name: '追加到当前会话', exact: true }).click();
  await page.getByText('草稿已变化，请重新预览', { exact: true }).waitFor();
  assert.equal(await composer.innerText(), changedDraft);
  await page.getByRole('button', { name: '预览模板', exact: true }).click();
  await page.getByRole('button', { name: '追加到当前会话', exact: true }).click();
  await page.getByText('已追加到真实 DSH 草稿，未发送任务。', { exact: true }).waitFor();
  assert.match(await composer.innerText(), /真实宿主测试周/);
  assert.match(await composer.innerText(), /预览后的新内容/);
  assert.equal(await chip.evaluate(element => element.isConnected), true, 'The original reference object remains mounted');
  assert.equal(await composer.locator('[data-composer-chip="reference"]').count(), 1);
  assert(await page.getByText('browser-generated-fixture.txt', { exact: true }).count());
  assert.equal(await attachment.evaluate(element => element.isConnected), true, 'The existing attachment remains mounted');
  assert.deepEqual(promptRequests, [], 'No model submission RPC was sent');
  await page.screenshot({ path: 'artifacts/dsh-integration/host-prompt.png', fullPage: true });
});

test('switching workspaces cannot insert an old prompt preview into another session', async t => {
  const page = await openLab(t);
  await chooseWorkspace(page);
  await page.getByRole('button', { name: '添加工作区', exact: true }).click();
  await page.getByRole('button', { name: '编辑路径', exact: true }).click();
  const input = page.getByRole('textbox', { name: '编辑路径', exact: true });
  await input.fill(path.join(lab, 'workspace-second'));
  await input.press('Enter');
  await page.getByRole('button', { name: '打开', exact: true }).click();
  await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: 'workspace-second' }).waitFor();
  await page.getByRole('button', { name: '选择工作区', exact: true }).click();
  await page.getByRole('menuitem', { name: 'workspace', exact: true }).click();
  await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: /^workspace$/ }).waitFor();
  const composer = page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true });
  await composer.fill('会话 A 原有草稿');
  await previewPrompt(page, '仅属于会话 A 的模板');
  await page.getByRole('button', { name: '选择工作区', exact: true }).click();
  await page.getByRole('menuitem', { name: 'workspace-second', exact: true }).click();
  await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: 'workspace-second' }).waitFor();
  await page.getByTestId('host-prompt-preview').waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: '追加到当前会话', exact: true }).count(), 0, 'A new session discards the old preview');
  assert.doesNotMatch(await composer.innerText(), /仅属于会话 A 的模板/);
  await page.getByRole('button', { name: '选择工作区', exact: true }).click();
  await page.getByRole('menuitem', { name: 'workspace', exact: true }).click();
  await composer.filter({ hasText: '会话 A 原有草稿' }).waitFor();
});

async function reloadUntilPlugin(page, enabled) {
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.reload();
    await page.getByRole('button', { name: '新建会话', exact: true }).first().waitFor();
    if (Boolean(await page.getByRole('button', { name: '扩展市场', exact: true }).count()) === enabled) return;
    await delay(250);
  }
  throw new Error(`Plugin did not become ${enabled ? 'enabled' : 'disabled'} after refreshing the host UI`);
}

test('disabling and re-enabling with page refresh removes and restores its UI without duplicates', async t => {
  const page = await openLab(t);
  await chooseWorkspace(page);
  await setPlugin(true);
  try {
    await reloadUntilPlugin(page, false);
    assert.equal(await page.getByRole('button', { name: '周报使用示例', exact: true }).count(), 0);
  } finally { await setPlugin(); }
  await reloadUntilPlugin(page, true);
  await page.getByRole('button', { name: '周报使用示例', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '扩展市场', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '周报使用示例', exact: true }).count(), 1);
});
