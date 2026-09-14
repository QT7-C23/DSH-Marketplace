import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export async function buildClient() {
  const result = await build({
    absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
    entryPoints: [fileURLToPath(new URL('./plugin/client.tsx', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', write: false,
    external: ['react', 'react/jsx-runtime'],
    loader: { '.css': 'text' }, metafile: true,
  });
  const code = 'window.__ModuleLoader__.load({id:"dsh-market-integration",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n' + result.outputFiles[0].text + '\nreturn module.exports;}});\n';
  return { code, inputs: Object.keys(result.metafile.inputs) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code } = await buildClient();
  await writeFile(new URL('./plugin/client.js', import.meta.url), code);
  console.log('Built DSH client module.');
}
