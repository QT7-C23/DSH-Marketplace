/** @typedef {{name:string,version:string,route:string,state:string,removable:boolean,installed:boolean,toggleable?:boolean,desired?:'enabled'|'disabled',actual?:'enabled'|'disabled'|'unknown'|'unmanaged'|'absent'|'degraded'}} InstalledExtension */
/** @typedef {{schema:1,profile:string,hostVersion:string,adapter:string,complete:boolean,items:InstalledExtension[]}} ExtensionInventory */
/** @typedef {{id:string,action:'install'|'remove'|'enable'|'disable',name:string,version:string,profile:string,hostVersion:string,routes:string[],compatibility:{route:string|null,state:string,issues:string[]},allowed:boolean,license:string|null,source:string|null,permissions:Array<{name:string,scope:string}>,restartRequired:true,firstAdoption?:boolean,notice?:'standard-adoption-reloads-all'|'standard-restart-required'}} ExtensionPlan */
/** @typedef {{status:'restart-required'|'failed'|'recovery-required',operationId:string,action:'install'|'remove'|'enable'|'disable',name:string,version?:string,backupCreated:boolean}} ExtensionResult */
const states = ['configured', 'active', 'disabled', 'failed', 'unknown', 'degraded', 'restart-required', 'route-required', 'adapter-required'];
const checks = ['declared', 'unverified', 'negotiated', 'incompatible', 'adapter-required', 'route-required'];
const routes = ['native', 'dsh-std', 'dual'];
const string = value => typeof value === 'string' && value.length > 0 && value.length < 2048;
const strings = value => Array.isArray(value) && value.every(string);
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
function ensure(value) { if (!value) throw Error('扩展服务返回了无效数据'); }

/** @returns {ExtensionInventory} */
export function parseInventory(value) {
  ensure(value?.schema === 1 && string(value.profile) && string(value.hostVersion) && ['available', 'missing', 'unknown'].includes(value.adapter) && typeof value.complete === 'boolean' && Array.isArray(value.items));
  for (const row of value.items) {
    ensure(string(row?.name) && string(row.version) && routes.includes(row.route) && states.includes(row.state) && typeof row.removable === 'boolean' && typeof row.installed === 'boolean');
    ensure(row.toggleable === undefined || typeof row.toggleable === 'boolean');
    if (row.desired !== undefined || row.actual !== undefined) ensure(row.route === 'dsh-std' && ['enabled', 'disabled'].includes(row.desired) && ['enabled', 'disabled', 'unknown', 'unmanaged', 'absent', 'degraded'].includes(row.actual));
  }
  return value;
}

/** @returns {ExtensionPlan} */
export function parsePlan(value) {
  ensure(uuid(value?.id) && ['install', 'remove', 'enable', 'disable'].includes(value.action) && ['name', 'version', 'profile', 'hostVersion'].every(key => string(value[key])) && strings(value.routes) && value.routes.every(route => routes.includes(route)));
  const check = value.compatibility;
  ensure(check && (check.route === null || routes.includes(check.route)) && checks.includes(check.state) && strings(check.issues));
  ensure(typeof value.allowed === 'boolean' && value.allowed === ['declared', 'unverified', 'negotiated'].includes(check.state) && value.restartRequired === true);
  ensure(value.license === null || string(value.license));
  ensure(value.source === null || (typeof value.source === 'string' && /^https:\/\/registry\.npmjs\.org\/[^?#]+\.tgz$/.test(value.source)));
  ensure(Array.isArray(value.permissions) && value.permissions.every(row => string(row?.name) && string(row.scope)));
  if (check.route === 'dsh-std' && ['enable', 'disable'].includes(value.action)) ensure(typeof value.firstAdoption === 'boolean' && value.notice === (value.firstAdoption ? 'standard-adoption-reloads-all' : 'standard-restart-required'));
  return value;
}

/** Network port shared by the UI and retry tests; a failed response never creates a new execution ID. */
export class ExtensionClient {
  constructor(request = globalThis.fetch.bind(globalThis)) { this.request = request; this.operations = new Map(); }
  async call(language, command, signal) {
    const response = await this.request('/api/community/extensions' + (command ? '' : '/read'), { method: command ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-community-request': '1', 'x-market-language': language }, ...(command ? { body: JSON.stringify(command) } : {}), signal });
    const value = await response.json();
    if (!response.ok) throw Error(typeof value?.error === 'string' ? value.error : '扩展操作失败，请重新检查');
    return value;
  }
  async read(language, signal) { return parseInventory(await this.call(language, null, signal)); }
  async prepare(command, language) { return parsePlan(await this.call(language, command)); }
  /** @param {ExtensionPlan} plan @returns {Promise<ExtensionResult>} */
  execute(plan, language) {
    ensure(plan.allowed);
    let operation = this.operations.get(plan.id);
    if (!operation) { operation = { requestId: crypto.randomUUID() }; this.operations.set(plan.id, operation); }
    if (!operation.pending) {
      operation.pending = this.call(language, { action: 'execute', planId: plan.id, requestId: operation.requestId }).then(value => {
        ensure(['restart-required', 'failed', 'recovery-required'].includes(value?.status) && uuid(value.operationId) && value.name === plan.name && value.action === plan.action && typeof value.backupCreated === 'boolean');
        return value;
      }).catch(error => { operation.pending = null; throw error; });
    }
    return operation.pending;
  }
}
