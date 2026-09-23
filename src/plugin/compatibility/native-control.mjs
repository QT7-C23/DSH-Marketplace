import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CommunityError } from '../../community/contracts.mjs';
import { packageName } from './packages.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = () => new CommunityError(409, '运行入口不唯一或已变化，无法安全切换；请刷新并检查宿主配置');
const keyFor = name => 'extension-' + digest(name).slice(0, 32);

/** Exact native entry coverage; official profile patching owns durable activation intent. */
export function nativeControl({ inventory, installer, profileTree }) {
  function targets(name, enabled) {
    if (!packageName(name)) throw fail();
    const all = [...inventory()];
    const found = all.filter(entry => entry.options.name === name);
    if (!found.length || found.length > 32 || all.some(entry => entry.options.name?.startsWith(name + '/'))) throw fail();
    return found.map(entry => {
      const local = entry.options.id;
      if (!profileTree?.() || entry.parent?.tree !== profileTree() || !/^[A-Za-z0-9_-]{1,128}$/.test(local) || entry.options.group
        || entry.options.disabled != null && typeof entry.options.disabled !== 'boolean'
        || all.filter(row => row.options.id === local).length !== 1
        || enabled && entry.disabled && !entry.options.disabled) throw fail();
      const ancestors = [];
      for (let parent = entry.parent.ctx.fiber?.entry; parent; parent = parent.parent.ctx.fiber?.entry) {
        if (ancestors.length >= 32 || enabled && parent.options.disabled) throw fail();
        ancestors.push({ id: parent.options.id, disabled: parent.options.disabled ?? false });
      }
      return { id: entry.id, local, fingerprint: digest(entry.options), ancestors };
    }).sort((a, b) => a.id.localeCompare(b.id));
  }
  async function prepareToggle(name, enabled) {
    if (typeof enabled !== 'boolean') throw fail();
    const selected = targets(name, enabled);
    const current = await installer.configuration(keyFor(name));
    if (current.records.some(row => !selected.some(target => target.local === row.id) || row.name !== name
      || typeof row.disabled !== 'boolean' || Object.keys(row).some(key => !['id', 'name', 'disabled'].includes(key)))
      || new Set(current.records.map(row => row.id)).size !== current.records.length) throw fail();
    return { name, enabled, selected, previous: current.records, fingerprint: current.fingerprint };
  }
  async function toggle(plan, fingerprint) {
    const current = await prepareToggle(plan.name, plan.enabled);
    if (fingerprint !== plan.fingerprint || !isDeepStrictEqual(current, plan)) throw fail();
    const records = plan.selected.map(row => ({ id: row.local, name: plan.name, disabled: !plan.enabled }));
    const result = await installer.configure(keyFor(plan.name), records, fingerprint);
    return { ...result, name: plan.name, action: plan.enabled ? 'enable' : 'disable' };
  }
  return { prepareToggle, toggle };
}
