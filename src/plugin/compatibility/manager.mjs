import { randomUUID } from 'node:crypto';
import { CommunityError } from '../../community/contracts.mjs';
import { preparePackage, packageName } from './packages.mjs';
import { assessCompatibility } from './assessment.mjs';

/** @typedef {{read: () => Promise<Array<object>>}} InventoryPort */
/** @typedef {{fingerprint:()=>Promise<string>, install:(candidate:object, fingerprint:string)=>Promise<object>, remove:(name:string, fingerprint:string)=>Promise<object>}} InstallerPort */
const protectedName = name => name === '@dsh-std/adapter-dsh' || name.startsWith('@deepseek-ai/') || /dsh-marketplace|dsh-market-integration/.test(name);
const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

/** One management boundary; original host interfaces remain inside their own ports. */
export class ExtensionManager {
  /** @param {{environment:object, packages:InventoryPort, native:InventoryPort, standard:InventoryPort & {adapter:()=>object|undefined}, installer:InstallerPort, prepare?:Function}} options */
  constructor(options) {
    for (const key of ['environment', 'packages', 'native', 'standard', 'installer']) this[key] = options[key];
    this.prepareRelease = options.prepare || preparePackage;
    this.plans = new Map(); this.requests = new Map(); this.changed = new Map();
  }
  async read() {
    const installed = await this.packages.read();
    const [native, standard, management] = await Promise.allSettled([this.native.read(), this.standard.read(), this.standard.management?.()]);
    const items = installed.filter(candidate => candidate.routes.length).map(candidate => {
      const route = candidate.routes.length === 1 ? candidate.routes[0] : 'dual';
      const node = native.status === 'fulfilled' && native.value.find(row => row.name === candidate.name);
      const component = standard.status === 'fulfilled' && standard.value.find(row => row.id === candidate.standardManifest?.id);
      const policy = route === 'dsh-std' && management.status === 'fulfilled' && management.value?.packages.find(row => row.name === candidate.name);
      let state = route === 'native' ? native.status === 'rejected' ? 'unknown' : node?.state || 'configured' : standard.status === 'rejected' ? 'unknown' : !this.standard.adapter() ? 'adapter-required' : !component ? 'configured' : component.version !== candidate.version ? 'restart-required' : component.facets.length && component.facets.every(row => row.state === 'active') ? 'active' : 'degraded';
      if (route === 'dual') state = 'route-required';
      if (policy?.actual === 'disabled' && policy.desired === 'disabled') state = 'disabled';
      if (policy?.restartRequired) state = 'restart-required';
      if (route === 'dsh-std' && management.status === 'rejected') state = 'unknown';
      if (this.changed.has(candidate.name)) state = 'restart-required';
      return { name: candidate.name, version: candidate.version, route, state, removable: !protectedName(candidate.name), installed: true,
        ...(policy ? { desired: policy.desired, actual: policy.actual } : {}),
        toggleable: !protectedName(candidate.name) && (route === 'native' && !!node && typeof this.native.prepareToggle === 'function'
          || route === 'dsh-std' && !!policy?.toggleable && typeof this.standard.prepareToggle === 'function') };
    });
    for (const [name, value] of this.changed) if (!items.some(row => row.name === name)) items.push({ name, ...value, state: 'restart-required', removable: false, installed: false });
    return { schema: 1, profile: this.environment.profile, hostVersion: this.environment.hostVersion, adapter: standard.status === 'rejected' ? 'unknown' : this.standard.adapter() ? 'available' : 'missing', complete: native.status === 'fulfilled' && standard.status === 'fulfilled' && management.status === 'fulfilled', items };
  }
  async prepare(command) {
    if (!this.environment.profile) throw new CommunityError(409, '尚未确定目标运行环境');
    for (const [id, plan] of this.plans) if (!plan.promise && plan.expires < Date.now()) this.plans.delete(id);
    if (this.plans.size >= 64) throw new CommunityError(429, '操作预览过多，请稍后重试');
    const fingerprint = await this.installer.fingerprint();
    let candidate, compatibility, action, control;
    if (command.action === 'prepare-install') {
      candidate = await this.prepareRelease(command.spec);
      compatibility = assessCompatibility(candidate, this.environment, command.route, this.standard.adapter());
      action = 'install';
    } else if (['prepare-remove', 'prepare-enable', 'prepare-disable'].includes(command.action)) {
      if (!packageName(command.name)) throw new CommunityError(400, '发布包身份不完整');
      if (protectedName(command.name)) throw new CommunityError(409, '此共享或基础扩展不能在市场中卸载');
      const installed = await this.packages.read();
      candidate = installed.find(row => row.name === command.name);
      if (!candidate) throw new CommunityError(404, '未找到此环境中的安装记录');
      const dependents = installed.filter(row => row.name !== command.name && [row.packageManifest.dependencies, row.packageManifest.peerDependencies, row.packageManifest.optionalDependencies].some(deps => deps && Object.hasOwn(deps, command.name)));
      if (dependents.length && command.action !== 'prepare-enable') throw new CommunityError(409, '其他已安装扩展仍依赖此包');
      compatibility = { route: candidate.routes.length === 1 ? candidate.routes[0] : 'dual', state: 'declared', issues: [] };
      action = command.action.slice('prepare-'.length);
      if (action !== 'remove') {
        const port = compatibility.route === 'native' ? this.native : compatibility.route === 'dsh-std' ? this.standard : null;
        if (candidate.routes.length !== 1 || !port?.prepareToggle) throw new CommunityError(409, '此扩展尚无可安全切换的受管运行入口');
        control = await port.prepareToggle(candidate.name, action === 'enable');
      }
    } else throw new CommunityError(400, '不支持的操作');
    const id = randomUUID();
    const allowed = ['declared', 'negotiated', 'unverified'].includes(compatibility.state);
    const plan = { id, candidate, action, compatibility, allowed, fingerprint, control, expires: Date.now() + 10 * 60000 };
    this.plans.set(id, plan);
    return { id, action, name: candidate.name, version: candidate.version, profile: this.environment.profile, hostVersion: this.environment.hostVersion, routes: candidate.routes, compatibility, allowed, license: typeof candidate.packageManifest.license === 'string' ? candidate.packageManifest.license : null, source: candidate.tarball || null, permissions: (candidate.standardManifest?.permissions || []).map(row => ({ name: row.name, scope: row.scope })), restartRequired: true,
      ...(control && compatibility.route === 'dsh-std' ? { firstAdoption: control.firstAdoption, notice: control.firstAdoption ? 'standard-adoption-reloads-all' : 'standard-restart-required' } : {}) };
  }
  async execute(command) {
    if (!uuid(command.requestId) || typeof command.planId !== 'string') throw new CommunityError(400, '操作请求格式无效');
    const previous = this.requests.get(command.requestId);
    if (previous && previous !== command.planId) throw new CommunityError(409, '重复请求编号不能用于不同操作');
    const plan = this.plans.get(command.planId);
    if (!plan) throw new CommunityError(409, '操作预览已失效，请重新检查');
    if (!plan.allowed) throw new CommunityError(409, '当前环境不满足此操作的条件');
    if (this.requests.size >= 128 && !previous) throw new CommunityError(429, '操作请求过多，请稍后重试');
    this.requests.set(command.requestId, command.planId);
    if (plan.promise) return plan.promise;
    if (plan.expires < Date.now()) throw new CommunityError(409, '操作预览已失效，请重新检查');
    plan.promise = (async () => {
      if (await this.installer.fingerprint() !== plan.fingerprint) throw new CommunityError(409, '环境已变化，请重新预览操作');
      if (plan.action === 'install') {
        const check = assessCompatibility(plan.candidate, this.environment, plan.compatibility.route, this.standard.adapter());
        if (!['declared', 'negotiated', 'unverified'].includes(check.state)) throw new CommunityError(409, '当前环境不满足此操作的条件');
      }
      const { name, version, tarball, integrity } = plan.candidate;
      const result = plan.action === 'install' ? await this.installer.install({ name, version, tarball, integrity }, plan.fingerprint)
        : plan.action === 'remove' ? await this.installer.remove(name, plan.fingerprint)
          : await (plan.compatibility.route === 'dsh-std' ? this.standard : this.native).toggle(plan.control, plan.fingerprint);
      if (result.status === 'restart-required') this.changed.set(plan.candidate.name, { version: plan.candidate.version, route: plan.compatibility.route });
      return result;
    })();
    return plan.promise;
  }
}
