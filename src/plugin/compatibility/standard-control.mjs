import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { projectManifest } from '@dsh-std/manifest';
import { CommunityError } from '../../community/contracts.mjs';
import { inspectStandardProfile } from './standard-view.mjs';
// Static marker keeps the managed entrypoint inside the closed public package graph.
import { STANDARD_LOADER_URL, STANDARD_PATCH_KEY, standardLoaderConfig, standardTopology, standardRuntimeState, standardProfileDirectory, validateStandardConfig } from './standard-loader.mjs';

const fail = () => new CommunityError(409, '标准组件入口或环境已变化，请重启宿主并重新预览');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const recordsFor = (core, owned) => [{ id: core.id, name: core.name, config: core.config }, { insert: [owned] }];
// Replacement SDK snapshots cannot attest cleanup of the former stock-core batch.
// Keep this process-scoped boundary across market/adapter reinitialization; only a cold process clears it.
const liveAdoptions = new Set();

/** Desired policy and public active state are separate; all writes share ProfileInstaller's lock. */
export function standardControl({ profileDir, inventory, profileTree, installer, adapter, loaderName = STANDARD_LOADER_URL, runtime = () => standardRuntimeState(adapter()) }) {
  async function inspect() {
    const entries = [...inventory()];
    const topology = standardTopology(entries, profileTree(), loaderName);
    const installed = await inspectStandardProfile(profileDir, entries);
    const durable = await installer.configuration(STANDARD_PATCH_KEY);
    const current = adapter();
    if (!current || topology.core.fiber?.state !== 2 || !topology.core.fiber.uid) throw fail();
    if (standardProfileDirectory(topology.core.fiber.config?.profileBaseUrl || topology.core.ctx?.baseUrl) !== profileDir) throw fail();
    const core = topology.core.options;
    if (!core.config || typeof core.config !== 'object' || Array.isArray(core.config)) throw fail();
    const firstAdoption = !durable.records.length;
    let owned, disabled = [];
    if (firstAdoption) {
      if (topology.owned || core.config.discover === false || core.config.discover !== undefined && core.config.discover !== true) throw fail();
      const snapshot = await current.snapshot();
      if (snapshot.facets.some(facet => !installed.installed.some(row => row.standardManifest?.id === facet.identity.component
        && row.version === facet.identity.version))) throw fail();
    } else {
      const [corePatch, insertion] = durable.records;
      owned = insertion?.insert?.[0];
      if (durable.records.length !== 2 || !owned || !/^market-std-[a-f0-9-]{36}$/.test(owned.id)
        || owned.name !== loaderName || Object.keys(owned).some(key => !['id', 'name', 'config'].includes(key))
        || corePatch.id !== core.id || corePatch.name !== core.name || corePatch.config?.discover !== false
        || !isDeepStrictEqual(durable.records, recordsFor(corePatch, owned))
        || !isDeepStrictEqual(core.config, corePatch.config)) throw fail();
      const policy = validateStandardConfig(owned.config);
      if (policy.profileDir !== profileDir || policy.coreId !== core.id) throw fail();
      if (!topology.owned || topology.owned.options.id !== owned.id || topology.owned.fiber?.state !== 2 || !topology.owned.fiber.uid) throw fail();
      const effective = validateStandardConfig(topology.owned.options.config);
      if (effective.profileDir !== profileDir || effective.coreId !== core.id) throw fail();
      disabled = [...policy.disabledPackages];
    }
    const active = runtime();
    if (!firstAdoption && !isDeepStrictEqual(topology.owned.options.config, owned.config)
      && (!active || !isDeepStrictEqual(topology.owned.options.config,
        standardLoaderConfig(profileDir, core.id, active.disabledPackages)))) throw fail();
    return { topology, installed, durable, current, firstAdoption, owned, disabled, active };
  }

  async function prepareToggle(name, enabled) {
    if (typeof enabled !== 'boolean') throw fail();
    if (liveAdoptions.has(profileDir)) throw fail();
    const value = await inspect();
    const { installed, topology, durable, current, firstAdoption, owned, disabled, active } = value;
    const target = installed.installed.find(row => row.name === name && row.standardManifest);
    if (!target) throw fail();
    if (!firstAdoption && (!active || active.state !== 'active' || active.profileDir !== profileDir
      || active.entryId !== topology.owned.id || active.coreId !== topology.core.options.id
      || active.runtimeId !== current.describe().runtime.instanceId || !active.generation)) throw fail();
    if (!enabled) {
      if (installed.installed.some(row => row.name !== name && ['dependencies', 'optionalDependencies', 'peerDependencies']
        .some(key => Object.hasOwn(row.packageManifest[key] || {}, name)))) throw new CommunityError(409, '其他已安装扩展仍依赖此包');
    }
    const removedNames = new Set([name, ...disabled]);
    const removed = new Set(installed.installed.filter(row => row.standardManifest && removedNames.has(row.name)).map(row => row.standardManifest.id));
    for (const row of active?.packages || []) if (removedNames.has(row.name)) removed.add(row.id);
    const remaining = current.publications.list().filter(row => !removed.has(row.identity.component)).map(row => row.declaration);
    if (enabled) remaining.push({ participant: { id: 'dsh-market-enable:' + name },
      requires: projectManifest(target.standardManifest).spec.facets.find(row => row.name === 'host').protocols?.requires || [] });
    if (!current.protocols.negotiate(remaining).compatible) throw new CommunityError(409, '变更后运行组件所需的契约无法满足');
    const desired = enabled ? disabled.filter(value => value !== name) : [...new Set([...disabled, name])].sort();
    return { name, version: target.version, enabled, firstAdoption, fingerprint: durable.fingerprint, installedFingerprint: installed.fingerprint,
      core: { id: topology.core.options.id, name: topology.core.options.name, config: structuredClone(topology.core.options.config) },
      coreFingerprint: digest(topology.core.options), ownedFingerprint: topology.owned ? digest(topology.owned.options) : null,
      runtimeId: current.describe().runtime.instanceId, generation: active?.generation ?? null,
      previous: durable.records, owned: owned ? structuredClone(owned) : null, disabledPackages: desired };
  }

  async function toggle(plan, fingerprint) {
    const latest = await prepareToggle(plan.name, plan.enabled);
    if (fingerprint !== plan.fingerprint || !isDeepStrictEqual(latest, plan)) throw fail();
    const core = { ...plan.core, config: { ...plan.core.config, discover: false } };
    const owned = { id: plan.owned?.id || 'market-std-' + randomUUID(), name: loaderName,
      config: standardLoaderConfig(profileDir, core.id, plan.disabledPackages) };
    // Mark before the write: the host watcher may replace the adapter before configure() returns.
    if (plan.firstAdoption) liveAdoptions.add(profileDir);
    const result = await installer.configure(STANDARD_PATCH_KEY, recordsFor(core, owned), fingerprint);
    return { ...result, action: plan.enabled ? 'enable' : 'disable', name: plan.name, firstAdoption: plan.firstAdoption,
      notice: plan.firstAdoption ? 'standard-adoption-reloads-all' : 'standard-restart-required' };
  }

  async function management() {
    if (!adapter()) {
      const entries = [...inventory()];
      const durable = await installer.configuration(STANDARD_PATCH_KEY);
      if (!durable.records.length && !liveAdoptions.has(profileDir)
        && !entries.some(row => row.options.name === '@dsh-std/adapter-dsh'
          || row.options.name === loaderName)) return { state: 'adapter-required', packages: [] };
      throw fail();
    }
    const { installed, disabled, firstAdoption, active, topology, current } = await inspect();
    const unresolved = liveAdoptions.has(profileDir);
    const stable = !unresolved && !firstAdoption && active?.state === 'active' && active.profileDir === profileDir
      && active.entryId === topology.owned?.id && active.runtimeId === current.describe().runtime.instanceId;
    const snapshot = stable ? await current.snapshot() : null;
    return { state: unresolved ? 'restart-required' : firstAdoption ? 'adoption-required' : stable ? 'active' : active?.state === 'recovery-required' ? 'recovery-required' : 'restart-required',
      packages: installed.installed.filter(row => row.standardManifest).map(row => {
        const mounted = stable && active.packages.find(item => item.name === row.name);
        const observed = mounted && snapshot.facets.find(item => item.identity.component === mounted.id && item.identity.version === mounted.version && item.identity.facet === 'host');
        const desired = disabled.includes(row.name) ? 'disabled' : 'enabled';
        const actual = unresolved ? 'unknown' : firstAdoption ? 'unmanaged' : !stable ? 'unknown' : mounted ? !observed ? 'unknown' : observed.state && observed.state !== 'active' ? 'degraded' : 'enabled'
          : active.disabledPackages.includes(row.name) ? snapshot.facets.some(item => item.identity.component === row.standardManifest.id) ? 'unknown' : 'disabled' : 'absent';
        const restartRequired = unresolved || !firstAdoption && (desired !== actual || !!mounted && mounted.version !== row.version);
        return { name: row.name, desired, actual, restartRequired, toggleable: !unresolved && (firstAdoption || stable) };
      }) };
  }
  return { prepareToggle, toggle, management };
}
