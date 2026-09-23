import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import path from 'node:path';

/** Identify the running host, even when this plugin is installed in another node_modules. */
export function hostRuntime(entry = process.argv[1]) {
  try {
    if (!path.isAbsolute(entry)) throw Error();
    const require = createRequire(entry);
    const manifestPath = require.resolve('@deepseek-ai/dsh/package.json');
    const manifest = require(manifestPath);
    const cli = path.join(path.dirname(manifestPath), 'lib/bin.js');
    if (manifest.name !== '@deepseek-ai/dsh' || realpathSync(entry) !== realpathSync(cli)) throw Error();
    return { cli, home: require('@deepseek-ai/dsh-home-paths').resolveDshHome(), version: manifest.version, packageVersion: name => { try { return require(`${name}/package.json`).version; } catch { return null; } } };
  } catch { throw new Error('The marketplace requires the official DSH CLI host'); }
}
