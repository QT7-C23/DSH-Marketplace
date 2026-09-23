import { initialState, parseState, transition, resource, fields, fillTemplate, catalog } from './state.mjs';
import { ACTORS } from './catalog.mjs';
import { esc, icon, button, field } from './components.mjs';
import { shell, discoverView, detailView, libraryView, shareView, sharePreview, publicationsView, sourcesView, updatesView, taskView } from './views.mjs';

const STORAGE = 'dsh-community-prototype-v1';
let state = initialState();
let storageBlocked = false;
try { const stored = localStorage.getItem(STORAGE); if (stored) state = parseState(stored); }
catch (error) { storageBlocked = true; queueMicrotask(()=>toast(error.message,true)); }
const ui = { route:'discover', id:null, copy:false, query:'', filter:'全部', detailTab:'overview', menu:false, syncing:false, editor:null };
const root = document.getElementById('app');
const dialog = document.getElementById('dialog');
let toastTimer;
let dialogResource;
let returnFocus;

function toast(message,error=false) {
  const target=document.getElementById('toast');
  clearTimeout(toastTimer); target.textContent=message; target.className=`visible ${error?'error':''}`;
  toastTimer=setTimeout(()=>{target.className='';},6500);
}
function commit(action, redraw=true) {
  if(storageBlocked) throw new Error('本机存储无法读取，暂不覆盖原始记录。请检查浏览器存储。');
  const next=transition(state,action);
  try { localStorage.setItem(STORAGE,JSON.stringify(next)); }
  catch { throw new Error('本机保存失败，当前内容仍保留在表单中。请检查浏览器存储空间。'); }
  state=next; if(redraw) render();
}
function route() {
  const hash=location.hash.slice(2)||'discover';
  const [path,query]=hash.split('?'); const [view,id]=path.split('/');
  ui.route=view; ui.id=id?decodeURIComponent(id):null; ui.copy=new URLSearchParams(query).get('copy')==='1';
  ui.editor=null; ui.detailTab='overview'; ui.menu=false;
  render(); window.scrollTo(0,0); document.getElementById('main-content')?.focus({preventScroll:true});
}
function currentItem(id) { return ui.copy?state.saved[state.actor].find(item=>item.id===id)||resource(state,id):resource(state,id); }
function render() {
  const active=document.activeElement; const focused=active?.id; const start=active?.selectionStart; const end=active?.selectionEnd;
  const view={discover:discoverView,resource:detailView,library:libraryView,share:shareView,publications:publicationsView,sources:sourcesView,updates:updatesView,task:taskView}[ui.route]||discoverView;
  document.documentElement.dataset.theme=state.theme;
  root.innerHTML=shell(state,ui,view(state,ui));
  if(storageBlocked) root.insertAdjacentHTML('afterbegin','<div class="storage-error" role="alert">本机存储无法读取，原始记录已保留。当前为只读预览，请检查浏览器存储。</div>');
  if(focused) { const target=document.getElementById(focused); if(target) { target.focus({preventScroll:true}); if(typeof start==='number'&&target.setSelectionRange) try { target.setSelectionRange(start,end); } catch {} } }
}
function openDialog(title,body) {
  returnFocus=document.activeElement;
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="dialog-title">${esc(title)}</h2>${button(icon('close'),'data-action="closeDialog" aria-label="关闭对话框"','ghost icon-button')}</div>${body}`;
  dialog.showModal();
}
function closeDialog() { dialog.close(); }
dialog.addEventListener('close',()=>{ if(returnFocus?.isConnected) returnFocus.focus(); else document.getElementById('main-content')?.focus({preventScroll:true}); });

function promptDialog(item) {
  dialogResource=item;
  const slots=fields(item.body);
  openDialog('填写你的内容',`<p class="dialog-description">${esc(item.title)} · ${esc(item.version)}<br>先预览完整内容，再放入任务草稿。</p><form id="prompt-form">${slots.map((name,index)=>field(name,`slot-${index}`,'',{multiline:true,required:true,placeholder:`填写${name}`})).join('')}<p class="inline-error" id="dialog-error" role="alert"></p><div id="prompt-preview" class="prompt-preview" hidden><h3>发送内容预览</h3><pre id="filled-preview"></pre></div><div class="form-actions">${button('预览内容','type="submit"')}${button('追加到任务草稿','type="button" data-action="appendPrompt"','primary')}</div><p class="fine-print">将保留已有草稿，不会自动发送。</p></form>`);
}
function filledPrompt() {
  const form=document.getElementById('prompt-form');
  if(!form.reportValidity()) return null;
  const values=Object.fromEntries(fields(dialogResource.body).map((name,index)=>[name,document.getElementById(`slot-${index}`).value]));
  return fillTemplate(dialogResource.body,values);
}
function installDialog(item) {
  dialogResource=item;
  openDialog(item.type==='MCP'?'体验连接流程':'体验添加流程',`<p class="dialog-description">${esc(item.title)}<br>${esc(item.requirements)}</p><div class="notice compact-notice">本页只模拟状态，不会下载程序、执行命令或启动服务。</div><form id="install-form">${field(item.type==='MCP'?'允许访问的目录（仅演示）':'配置说明（仅演示）','install-config','',{required:item.type==='MCP',placeholder:item.type==='MCP'?'例如 D:\\Demo\\Notes':'填写指导文本或说明',multiline:true})}<label class="field"><span>体验哪一种结果</span><select id="install-result"><option value="success">正常完成</option><option value="dependency">缺少运行依赖</option><option value="auth">授权未完成</option></select></label><p id="dialog-error" class="inline-error" role="alert"></p><div class="form-actions">${button('取消','type="button" data-action="closeDialog"')}${button(item.type==='MCP'?'模拟连接':'模拟添加','type="submit"','primary')}</div></form>`);
}
function confirmDialog(title,message,action,id) {
  openDialog(title,`<p class="dialog-description">${esc(message)}</p><div class="form-actions">${button('取消','data-action="closeDialog"')}${button('确认',`data-action="${action}" data-id="${esc(id||'')}"`,'primary')}</div>`);
}
function editorValue() {
  const form=document.getElementById('share-form'); if(!form) return null;
  return { id:form.dataset.id||undefined, type:document.getElementById('resource-type').value, ...Object.fromEntries(['title','summary','body','url','version'].map(key=>[key,document.getElementById(key)?.value||''])) };
}
async function syncSource() {
  if(ui.syncing) return; ui.syncing=true; render();
  try {
    const response=await fetch('/api/discovery'); const body=await response.json();
    if(!response.ok) throw new Error(body.error||'来源读取失败');
    commit({type:'sourceSuccess',value:body},false);
  } catch(error) { try { commit({type:'sourceError',value:error.message},false); } catch(storageError) { toast(storageError.message,true); } }
  finally { ui.syncing=false; render(); }
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]'); if(!target) return;
  const {action,id}=target.dataset;
  try {
    if(action==='filter') {ui.filter=target.dataset.type;render();}
    else if(action==='clearFilters') {ui.filter='全部';ui.query='';render();}
    else if(action==='menu') {ui.menu=!ui.menu;render();}
    else if(action==='theme') commit({type:'theme',value:state.theme==='light'?'dark':'light'});
    else if(action==='detailTab') {ui.detailTab=target.dataset.tab;render();}
    else if(action==='closeDialog') closeDialog();
    else if(action==='usePrompt') promptDialog(currentItem(id));
    else if(action==='appendPrompt') {const content=filledPrompt();if(content!==null){commit({type:'appendTask',value:content});closeDialog();location.hash='#/task';toast('已追加到任务草稿，原有内容已保留。');}}
    else if(action==='save'||action==='removeSaved') {commit({type:action,id});toast(action==='save'?'已保存一份本机副本。':'已从我的资源移除保存的副本。');}
    else if(action==='install') installDialog(currentItem(id));
    else if(action==='uninstall') confirmDialog('移除演示状态',id==='plan-plugin'||id==='plan-command'?'规划插件与 /plan 命令共用状态，将一起移除；可以在更新与恢复中撤销。':'只移除当前体验身份的演示安装状态，可恢复。','confirmUninstall',id);
    else if(action==='confirmUninstall') {commit({type:'uninstall',id});closeDialog();toast('演示状态已移除，真实 DSH 未被更改。');}
    else if(action==='restore') {commit({type:'restore'});toast('已恢复上一份演示安装状态。');}
    else if(action==='withdraw') confirmDialog('撤回这份资源','它将从本机演示社区移除；使用者保存的副本仍会保留。','confirmWithdraw',id);
    else if(action==='confirmWithdraw') {commit({type:'withdraw',id});closeDialog();toast('已从本机演示社区撤回。');}
    else if(action==='saveDraft') {commit({type:'draft',value:editorValue()},false);toast('草稿已保存在本机。');}
    else if(action==='feedback') {dialogResource=currentItem(id);openDialog('分享你的反馈',`<form id="feedback-form">${field('建议或遇到的问题','feedback-content','',{multiline:true,required:true,placeholder:'说明你希望改进的地方…'})}<p id="dialog-error" class="inline-error" role="alert"></p><div class="form-actions">${button('保存反馈','type="submit"','primary')}</div><p class="fine-print">仅在本机演示身份之间展示，不发送给真实作者。</p></form>`);}
    else if(action==='updateSaved') {const latest=catalog(state).find(item=>item.id===id);confirmDialog('更新已保存的副本',`将以 ${latest.version} 替换当前保存的模板内容。任务草稿不会改变。`,'confirmUpdate',id);}
    else if(action==='confirmUpdate') {commit({type:'updateSaved',id});closeDialog();toast('已保存作者的最新版本。');}
    else if(action==='refreshSource') await syncSource();
    else if(action==='copyTask') {if(!state.tasks[state.actor].trim())throw Error('请先填写任务草稿。');await navigator.clipboard.writeText(state.tasks[state.actor]);toast('草稿已复制，可自行粘贴到 DSH 使用。');}
    else if(action==='sendPreview') openDialog('内容已准备好',`<p class="dialog-description">这个原型尚未连接模型，因此没有发送任务。你的草稿已保留，可以复制后自行使用。</p><div class="form-actions">${button('返回草稿','data-action="closeDialog"','primary')}</div>`);
  } catch(error) {const message=document.getElementById('dialog-error')||document.getElementById('form-error');if(message)message.textContent=error.message;else toast(error.message,true);}
});

document.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    if(event.target.id==='share-form') {const value=editorValue();commit({type:'publish',value,id:value.id||crypto.randomUUID()},false);ui.editor=null;location.hash='#/publications';toast('已发布到本机演示社区。可切换体验身份查看。');}
    else if(event.target.id==='prompt-form') {const content=filledPrompt();if(content!==null){document.getElementById('prompt-preview').hidden=false;document.getElementById('filled-preview').textContent=content;}}
    else if(event.target.id==='install-form') {const outcome=document.getElementById('install-result').value;if(outcome==='dependency')throw Error('演示：缺少运行依赖。当前没有新增安装状态，请补齐依赖后重试。');if(outcome==='auth')throw Error('演示：授权未完成。当前没有新增连接，请检查账户设置。');commit({type:'install',id:dialogResource.id,config:document.getElementById('install-config').value});closeDialog();toast('演示状态已更新，未执行真实安装或连接。');}
    else if(event.target.id==='feedback-form') {commit({type:'feedback',id:dialogResource.id,value:document.getElementById('feedback-content').value});closeDialog();toast('反馈已保存在本机。');}
  } catch(error) {const target=document.getElementById('dialog-error')||document.getElementById('form-error');if(target)target.textContent=error.message;else toast(error.message,true);}
});
document.addEventListener('input',event=>{
  try {
    if(event.target.id==='search') {ui.query=event.target.value;render();}
    else if(event.target.id==='task-draft') commit({type:'task',value:event.target.value},false);
    else if(event.target.closest('#share-form')&&event.target.id!=='resource-file') {ui.editor=editorValue();commit({type:'draft',value:ui.editor},false);document.getElementById('live-preview').innerHTML=sharePreview(ui.editor);}
  } catch(error) {toast(error.message,true);}
});
document.addEventListener('change',async event=>{
  try {
    if(event.target.id==='actor') {commit({type:'actor',value:event.target.value},false);ui.editor=null;location.hash='#/discover';route();toast(`已切换到${ACTORS[state.actor]}视角。`);}
    else if(event.target.id==='resource-type') {ui.editor=editorValue();commit({type:'draft',value:ui.editor},false);render();}
    else if(event.target.id==='resource-file') {const file=event.target.files[0];if(!file)return;if(file.size>102400||! /\.(txt|md|json)$/i.test(file.name))throw Error('请选择 100 KB 以内的 TXT、Markdown 或 JSON 文件。');const text=await file.text();let imported={body:text};if(file.name.endsWith('.json')){const parsed=JSON.parse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('JSON 应为资源字段对象。');imported=Object.fromEntries(['title','summary','body','url','version'].filter(key=>typeof parsed[key]==='string').map(key=>[key,parsed[key]]));}ui.editor={...editorValue(),...imported};commit({type:'draft',value:ui.editor},false);render();toast('内容已导入草稿，请检查后再发布。');}
  } catch(error) {toast(error.message,true);}
});
document.addEventListener('keydown',event=>{if(event.key==='/'&&! /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!dialog.open){const search=document.getElementById('search');if(search){event.preventDefault();search.focus();}}});
window.addEventListener('hashchange',route);
route();
if(!storageBlocked&&state.source.status==='idle') syncSource();
