import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ProfileInstaller } from './plugin/compatibility/installer.mjs';
import { STANDARD_PATCH_KEY, STANDARD_LOADER_EXPORT, STANDARD_LOADER_URL, validateStandardConfig } from './plugin/compatibility/standard-loader.mjs';

/** Run with the host stopped. Restore upstream discovery before removing this package. */
export async function prepareUninstall({ home, profile, confirm, enableDisabled = false }) {
  if (typeof home !== 'string' || !path.isAbsolute(home)) throw Error('An absolute --home is required.');
  const installer = new ProfileInstaller({ home, profile, cli: process.execPath, folder: path.join(home, 'community/operations') });
  if ((await installer.recovery()).blocked) throw Error('Resolve the existing profile operation before uninstall preparation.');
  const { records, fingerprint } = await installer.configuration(STANDARD_PATCH_KEY);
  if (!records.length) return { status: 'not-managed', disabledPackages: [] };
  const [core, insertion] = records, owned = insertion?.insert?.[0];
  if (records.length !== 2 || core?.name !== '@dsh-std/adapter-dsh' || core.config?.discover !== false
    || !isDeepStrictEqual(Object.keys(core).sort(), ['config', 'id', 'name'])
    || !owned || !/^market-std-[a-f0-9-]{36}$/.test(owned.id)
    || ![STANDARD_LOADER_EXPORT, STANDARD_LOADER_URL].includes(owned.name)
    || !isDeepStrictEqual(Object.keys(owned).sort(), ['config', 'id', 'name'])
    || !isDeepStrictEqual(insertion, { insert: [owned] })) throw Error('Unrecognized standard ownership; no configuration was changed.');
  const policy = validateStandardConfig(owned.config);
  if (policy.profileDir !== path.resolve(home, 'profiles', profile) || policy.coreId !== core.id) throw Error('Standard ownership does not match this profile.');
  const preview = { status: 'preview', profile, fingerprint, disabledPackages: [...policy.disabledPackages],
    effect: 'Restore upstream discovery. Previously disabled standard components can load on the next start. Stop DSH before confirming.' };
  if (confirm === undefined) return preview;
  if (confirm !== fingerprint) throw Error('The profile changed; create a fresh uninstall preview.');
  if (policy.disabledPackages.length && enableDisabled !== true) throw Error('Use --enable-disabled only after reviewing which components will load again.');
  return installer.configure(STANDARD_PATCH_KEY, [], fingerprint);
}

async function main(args) {
  if (args.shift() !== 'prepare-uninstall') throw Error('Usage: maintenance.mjs prepare-uninstall --home <absolute DSH_HOME> --profile web [--confirm <preview fingerprint>] [--enable-disabled]');
  const values = {};
  while (args.length) {
    const key = args.shift();
    if (!['--home', '--profile', '--confirm', '--enable-disabled'].includes(key) || Object.hasOwn(values, key)) throw Error('Unknown or duplicate argument.');
    values[key] = key === '--enable-disabled' ? true : args.shift();
    if (typeof values[key] === 'string' && values[key].startsWith('--') || values[key] === undefined) throw Error('Missing argument value.');
  }
  const result = await prepareUninstall({ home: values['--home'], profile: values['--profile'], confirm: values['--confirm'], enableDisabled: values['--enable-disabled'] });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!['preview', 'not-managed', 'restart-required'].includes(result.status)) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
