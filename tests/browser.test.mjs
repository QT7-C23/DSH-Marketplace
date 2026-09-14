import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from '../server/server.mjs';

async function setup(t) {
  const server=createServer({discovery:async()=>({count:12,sampleFound:true,checkedAt:'2026-09-13T12:00:00Z'})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1080}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));assert.deepEqual(errors,[],'No uncaught browser errors');});
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base);await page.getByRole('heading',{name:'发现社区的好工具.'}).waitFor();
  await mkdir('artifacts',{recursive:true});
  return {page,base};
}

test('discovery, empty search, keyboard and prompt use preserve the task draft', async t=>{
  const {page,base}=await setup(t);
  await page.screenshot({path:'artifacts/discovery-desktop.png',fullPage:true});
  await page.keyboard.press('/');assert.equal(await page.locator('#search').evaluate(el=>el===document.activeElement),true);
  await page.locator('#search').fill('没有这个资源');await page.getByRole('heading',{name:'还没有找到匹配的资源'}).waitFor();
  await page.getByRole('button',{name:'清除筛选'}).click();
  await page.getByRole('button',{name:'Skill',exact:true}).click();assert.equal(await page.locator('.resource-card').count(),1);
  await page.goto(`${base}/#/task`);await page.locator('#task-draft').fill('保留我已有的记录');
  await page.goto(`${base}/#/resource/weekly-prompt`);await page.getByRole('button',{name:'使用提示词',exact:true}).click();
  await page.locator('#slot-0').fill('内部试用周');await page.locator('#slot-1').fill('说明已完成，连接测试未开始');await page.locator('#slot-2').fill('继续连接测试');
  await page.getByRole('button',{name:'预览内容',exact:true}).click();assert.match(await page.locator('#filled-preview').textContent(),/连接测试未开始/);
  await page.screenshot({path:'artifacts/prompt-preview.png',fullPage:true});
  await page.getByRole('button',{name:'追加到任务草稿'}).click();await page.locator('#task-draft').waitFor();
  assert.match(await page.locator('#task-draft').inputValue(),/^保留我已有的记录\n\n/);
  await page.reload();assert.match(await page.locator('#task-draft').inputValue(),/继续连接测试/);
  await page.getByRole('button',{name:'预览发送流程'}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
  assert.equal(await page.getByRole('button',{name:'预览发送流程'}).evaluate(el=>el===document.activeElement),true);
});

test('community publication, safe rendering, author update and saved-copy use', async t=>{
  const {page,base}=await setup(t);
  await page.locator('#actor').selectOption('author');await page.goto(`${base}/#/share`);
  const title='测试分享 <img src=x onerror=alert(1)>';
  await page.locator('#title').fill(title);await page.locator('#summary').fill('整理测试输入，保留已保存的旧版本');await page.locator('#body').fill('旧版本 {{内容}}');await page.locator('#version').fill('1.0.0');
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.locator('#actor').selectOption('reader');
  assert.equal(await page.locator('.resource-card').filter({hasText:title}).count(),0);
  await page.locator('#actor').selectOption('author');await page.goto(`${base}/#/share`);assert.equal(await page.locator('#title').inputValue(),title);
  assert.equal(await page.locator('#live-preview img').count(),0);
  await page.getByRole('button',{name:'发布资源',exact:true}).click();await page.locator('.publication-row').waitFor();
  const editHref=await page.getByRole('link',{name:'编辑新版'}).getAttribute('href');
  const detailHref=await page.getByRole('link',{name:'查看',exact:true}).getAttribute('href');
  await page.locator('#actor').selectOption('reader');await page.goto(base+'/'+detailHref);
  await page.getByRole('button',{name:'保存到我的资源',exact:true}).click();
  await page.goto(base+'/'+editHref);await page.getByRole('heading',{name:'当前身份无权编辑'}).waitFor();
  await page.locator('#actor').selectOption('author');await page.goto(base+'/'+editHref);await page.locator('#body').fill('新版本 {{内容}}');await page.locator('#version').fill('2.0.0');await page.getByRole('button',{name:'发布新版本',exact:true}).click();
  await page.locator('#actor').selectOption('reader');await page.goto(`${base}/#/library`);await page.locator('.resource-card').filter({hasText:title}).click();
  await page.getByRole('button',{name:'使用提示词',exact:true}).click();await page.locator('#slot-0').fill('需要保留旧版');await page.getByRole('button',{name:'预览内容',exact:true}).click();
  assert.equal(await page.locator('#filled-preview').textContent(),'旧版本 需要保留旧版');
  await page.keyboard.press('Escape');await page.goto(`${base}/#/updates`);await page.getByRole('button',{name:'查看并更新'}).click();await page.getByRole('button',{name:'确认',exact:true}).click();
  await page.getByRole('heading',{name:'已保存的资源暂时没有更新'}).waitFor();
});

test('connection error, shared installation, recovery, source failure and responsive themes', async t=>{
  const {page,base}=await setup(t);
  await page.goto(`${base}/#/resource/filesystem`);await page.getByRole('button',{name:'模拟连接',exact:true}).click();
  await page.locator('#install-config').fill('D:\\Demo\\Notes');await page.locator('#install-result').selectOption('dependency');await page.locator('#install-form').getByRole('button',{name:'模拟连接',exact:true}).click();
  assert.match(await page.locator('#dialog-error').textContent(),/缺少运行依赖/);await page.keyboard.press('Escape');
  await page.goto(`${base}/#/resource/plan-command`);await page.getByRole('button',{name:'模拟添加',exact:true}).click();await page.locator('#install-form').getByRole('button',{name:'模拟添加',exact:true}).click();
  await page.goto(`${base}/#/resource/plan-plugin`);await page.getByRole('button',{name:'移除演示状态'}).click();await page.getByRole('button',{name:'确认',exact:true}).click();
  await page.goto(`${base}/#/updates`);await page.getByRole('button',{name:'恢复上一步'}).click();await page.goto(`${base}/#/resource/plan-command`);await page.getByRole('button',{name:'移除演示状态'}).waitFor();
  await page.route('**/api/discovery',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'测试断网'})}));
  await page.goto(`${base}/#/sources`);await page.getByRole('button',{name:'刷新来源'}).click();await page.getByText('测试断网。已有来源样本与上次信息仍保留。').waitFor();assert.match(await page.locator('.source-detail').textContent(),/12 个目录/);
  await page.goto(base);await page.getByRole('button',{name:'切换深浅主题'}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.screenshot({path:'artifacts/discovery-dark.png',fullPage:true});
  await page.getByRole('button',{name:'切换深浅主题'}).click();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'artifacts/discovery-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'展开导航'}).click();await page.getByRole('link',{name:'我的发布',exact:true}).click();await page.getByRole('heading',{name:'我的发布',exact:true}).waitFor();
  await page.setViewportSize({width:1100,height:900});await page.goto(`${base}/#/share`);
  await page.evaluate(()=>{for(const name of ['xs','sm','base','md','lg','xl','display']){const key='--text-'+name;const size=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(key));document.documentElement.style.setProperty(key,size*2+'px');}});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'200% token text does not overflow');
});
