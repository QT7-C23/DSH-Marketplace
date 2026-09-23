import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectPackage, packageName } from './packages.mjs';
import { nativeControl } from './native-control.mjs';
import { standardControl } from './standard-control.mjs';

export function profilePackages(home, profile) {
  if (!path.isAbsolute(home) || !/^[a-zA-Z0-9_-]+$/.test(profile)) throw Error('尚未确定目标运行环境');
  const folder = path.join(home, 'profiles', profile);
  return { read: async () => {
    const config = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
    const result = [];
    for (const name of Object.keys(config.dependencies || {})) {
      if (!packageName(name)) throw Error('运行环境的依赖记录无效');
      const packageRoot = path.join(folder, 'node_modules', ...name.split('/'));
      const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
      if (manifest.name !== name) throw Error('运行环境的依赖记录无效');
      let standard;
      try { standard = JSON.parse(await readFile(path.join(packageRoot, 'dsh-plugin.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      result.push(inspectPackage(manifest, standard));
    }
    return result;
  } };
}

/** Project only package identities and public lifecycle states, never options/configuration. */
export function nativeRuntimePort(ctx, installer) {
  const phases = ['pending', 'loading', 'active', 'failed', 'configured', 'unloading'];
  return { ...(installer ? nativeControl({ inventory: () => ctx.loader.entries(), installer, profileTree: () => {
    const rows = [...ctx.loader.entries()].filter(entry => entry.options.id === 'community-market');
    return rows.length === 1 ? rows[0].parent.tree : null;
  } }) : {}), read: async () => {
    const groups = new Map();
    for (const entry of ctx.loader.entries()) {
      if (entry.options.group || !packageName(entry.options.name)) continue;
      const name = entry.options.name;
      const state = entry.disabled ? 'disabled' : phases[entry.fiber?.state] || 'configured';
      const rows = groups.get(name) || []; rows.push(state); groups.set(name, rows);
    }
    return [...groups].map(([name, states]) => ({ name, entries: states.length, state: states.includes('failed') ? 'failed' : states.every(value => value === 'active') ? 'active' : states.every(value => value === 'disabled') ? 'disabled' : 'configured' }));
  } };
}

/** Standard facets are read from the adapter, independently of Cordis Loader rows. */
export function standardRuntimePort(ctx, options = {}) {
  const adapter = () => ctx.get('dshStd');
  const control = options.installer && options.profileDir ? standardControl({ ...options, adapter, inventory: () => ctx.loader.entries(), profileTree: () => {
    const rows = [...ctx.loader.entries()].filter(entry => entry.options.id === 'community-market');
    return rows.length === 1 ? rows[0].parent.tree : null;
  } }) : {};
  return { ...control, adapter, read: async () => {
    const current = adapter(); if (!current) return [];
    const snapshot = await current.snapshot();
    const components = new Map();
    for (const facet of snapshot.facets) {
      const { component: id, version } = facet.identity;
      const key = `${id}@${version}`;
      const value = components.get(key) || { id, version, facets: [] };
      value.facets.push({ name: facet.identity.facet, state: facet.state || 'active' });
      components.set(key, value);
    }
    return [...components.values()];
  } };
}
