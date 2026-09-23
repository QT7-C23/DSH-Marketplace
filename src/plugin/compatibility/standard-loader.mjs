import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createStandardView, disabledPolicy, trustedStandardProfile, verifyStandardView } from './standard-view.mjs';

export const STANDARD_LOADER_EXPORT = 'dsh-market-integration/standard-loader';
export const STANDARD_LOADER_URL = import.meta.url;
export const STANDARD_PATCH_KEY = 'extension-standard';
const coreName = '@dsh-std/adapter-dsh';
const states = new Map(); // Our own mount receipts only; no SDK instance or borrowed disposal handles.
const fail = () => Error('标准组件受管入口不唯一、尚未稳定或不属于目标环境');
const localId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function standardLoaderConfig(profileDir, coreId, disabledPackages) {
  if (!path.isAbsolute(profileDir) || path.resolve(profileDir) !== profileDir || !localId(coreId)) throw fail();
  return Object.freeze({ schema: 1, owner: 'dsh-market', profileDir, coreId, disabledPackages: disabledPolicy(disabledPackages) });
}

export function validateStandardConfig(config) {
  if (!config || !isDeepStrictEqual(config, standardLoaderConfig(config.profileDir, config.coreId, config.disabledPackages))) throw fail();
  return standardLoaderConfig(config.profileDir, config.coreId, config.disabledPackages);
}

export function standardProfileDirectory(baseUrl) {
  const base = fileURLToPath(baseUrl);
  return /[/\\]$/.test(base) ? path.resolve(base) : path.dirname(base);
}

export function standardTopology(entries, tree, loaderName) {
  if (!tree || ![STANDARD_LOADER_EXPORT, STANDARD_LOADER_URL].includes(loaderName)) throw fail();
  const cores = entries.filter(row => row.options.name === coreName);
  const owned = entries.filter(row => [STANDARD_LOADER_EXPORT, STANDARD_LOADER_URL].includes(row.options.name));
  if (cores.length !== 1 || owned.length > 1 || owned.some(row => row.options.name !== loaderName)) throw fail();
  for (const entry of entries) {
    if (entry === cores[0] || entry === owned[0]) continue;
    const name = entry.options.name || '';
    if (/profile[-_/]?loader|standard[-_/]?loader|std[-_/].*loader/i.test(name)
      || name.includes('@dsh-std/adapter-dsh') && !/\/client$/.test(name)
      || entry.options.config?.profileBaseUrl !== undefined) throw fail();
  }
  for (const entry of [...cores, ...owned]) {
    if (entry.parent?.tree !== tree || entry.parent !== tree.root && tree.root !== undefined
      || !localId(entry.options.id) || entry.options.group || entry.disabled
      || entry.options.disabled !== undefined && entry.options.disabled !== false
      || entries.filter(row => row.options.id === entry.options.id).length !== 1) throw fail();
    let depth = 0;
    for (let parent = entry.parent.ctx.fiber?.entry; parent; parent = parent.parent.ctx.fiber?.entry) {
      if (++depth > 32 || parent.disabled || parent.options.disabled) throw fail();
    }
  }
  return { core: cores[0], owned: owned[0] };
}

export function standardRuntimeState(adapter) {
  const id = adapter?.describe().runtime.instanceId;
  const state = states.get(id);
  return state ? structuredClone(state) : null;
}

/** Public profile-loader seam. Activation must remain outside effect setup. */
export async function apply(ctx, config) {
  const policy = validateStandardConfig(config);
  const entry = ctx.fiber.entry;
  const entries = [...ctx.loader.entries()];
  const { core, owned } = standardTopology(entries, entry?.parent.tree, entry?.options.name);
  if (entry !== owned || core.options.id !== policy.coreId || core.options.config?.discover !== false) throw fail();
  const actualProfile = standardProfileDirectory(ctx.baseUrl);
  if (actualProfile !== policy.profileDir) throw fail();
  await trustedStandardProfile(policy.profileDir);
  // inject only admits an active dshStd provider. No wait on the whole Loader (self-deadlock).
  if (core.fiber?.state !== 2 || core.fiber.config?.discover !== false) throw fail();
  const adapter = ctx.dshStd, runtimeId = adapter.describe().runtime.instanceId;
  const previous = states.get(runtimeId);
  if (previous && !['stopped'].includes(previous.state)) throw fail();
  const state = { state: 'loading', profileDir: policy.profileDir, entryId: entry.id, coreId: policy.coreId, runtimeId,
    generation: null, disabledPackages: [...policy.disabledPackages], packages: [], cleanupErrors: 0 };
  states.set(runtimeId, state);
  let cleanup;
  // Veto only configuration-driven reinitialization of this active fiber. Dependency failures can still reload it.
  ctx.on('internal/update', nextConfig => {
    const next = validateStandardConfig(nextConfig);
    if (next.profileDir !== policy.profileDir || next.coreId !== policy.coreId) throw fail();
    // Intentionally no next(): the active batch and fiber.config retain their boot snapshot.
  });
  try {
    const view = await createStandardView(policy.profileDir, policy.disabledPackages, [...ctx.loader.entries()]);
    state.generation = path.basename(view.directory);
    state.packages = view.packages.map(row => ({ name: row.name, version: row.version, id: row.standardManifest.id }));
    await verifyStandardView(policy.profileDir, view, [...ctx.loader.entries()]);
    const disposers = await adapter.mountProfileComponents(view.directory);
    let settlement;
    cleanup = () => settlement ??= (async () => {
      state.state = 'stopping';
      const errors = [];
      for (const dispose of [...disposers].reverse()) { try { await dispose(); } catch (error) { errors.push(error); } }
      state.cleanupErrors = errors.length;
      state.state = errors.length ? 'recovery-required' : 'stopped';
      if (errors.length) throw new AggregateError(errors, '标准组件清理未全部成功');
    })();
    const snapshot = await adapter.snapshot();
    if (state.packages.some(row => !snapshot.facets.some(facet => facet.identity.component === row.id
      && facet.identity.version === row.version && facet.identity.facet === 'host' && (!facet.state || facet.state === 'active')))) throw fail();
    ctx.effect(() => cleanup, 'dsh-market standard batch');
    state.state = 'active';
  } catch (error) {
    if (cleanup) {
      try { await cleanup(); } catch (failure) { throw new AggregateError([error, failure], '标准组件启动和清理失败'); }
    }
    // Upstream owns rollback when its batch call rejects; no handles are returned to this loader.
    state.state = 'recovery-required';
    throw error;
  }
}
apply.inject = ['dshStd'];
export default apply;
