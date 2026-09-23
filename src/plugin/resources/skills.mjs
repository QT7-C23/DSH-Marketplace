import path from 'node:path';
import { CommunityError } from '../../community/contracts.mjs';

/** Catalog identity and the native provider meet here; disk state alone never means loaded. */
export class SkillResources {
  constructor({ catalog, files, registry, home }) { Object.assign(this, { catalog, files, registry, home }); }
  async read() {
    const rows = await this.files.read();
    const registry = this.registry();
    return Promise.all(rows.map(async row => {
      if (row.state !== 'installed' || !registry) return row;
      let definition;
      try { definition = await registry.get(row.name); }
      catch { return { ...row, state: 'unavailable' }; }
      if (!definition) return row;
      const base = definition.resourceBase;
      const expected = path.join(this.home, 'skills', row.name);
      const state = base?.kind === 'directory' && path.resolve(base.path) === expected && typeof definition.content === 'string' ? 'loaded' : 'shadowed';
      return { ...row, state };
    }));
  }
  async run(command) {
    if (!command || Object.keys(command).some(key => !['action', 'id', 'revision'].includes(key))
      || !['install', 'update', 'disable', 'enable', 'remove', 'restore'].includes(command.action)
      || typeof command.id !== 'string' || !Number.isSafeInteger(command.revision) || command.revision < 1) throw new CommunityError(400, '不支持的 Skill 操作');
    let resource;
    if (['install', 'update'].includes(command.action)) {
      resource = this.catalog().find(item => item.id === command.id);
      if (!resource || resource.revision !== command.revision) throw new CommunityError(409, '资源版本已变化，请刷新后重新检查');
      if (resource.type !== 'Skill' || resource.bundle?.kind !== 'github-skill') throw new CommunityError(400, '此资源没有可安装的 Skill 文件');
    }
    try {
      const installed = resource ? await this.files[command.action](resource)
        : command.action === 'restore' ? await this.files.restore(command.id) : await this.files[command.action](command.id, command.revision);
      return (await this.read()).find(row => row.id === installed.id) || installed;
    } catch (error) {
      if (typeof error.code === 'string' && error.code.startsWith('SKILL_')) throw new CommunityError(409, error.message);
      throw error;
    }
  }
}
