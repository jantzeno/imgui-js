import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyToolchain(output, expected, name) {
  const version = output.match(/\d+\.\d+\.\d+/)?.[0];
  if (version !== expected) throw new Error(`${name} ${expected} is required; found ${version ?? 'unknown'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const debug = process.argv[2] === '--debug';
  if (process.argv.length > (debug ? 3 : 2)) throw new Error('Usage: node scripts/build.mjs [--debug]');
  const options = { shell: process.platform === 'win32' };
  for (const [tool, version] of [['em++', '6.0.13'], ['xmake', '3.1.2']]) {
    verifyToolchain(execFileSync(tool, ['--version'], { ...options, encoding: 'utf8' }), version, tool);
  }
  const run = (command, args) => execFileSync(command, args, { ...options, stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/generate-enums.mjs'], { shell: false, stdio: 'inherit' });
  run('xmake', ['f', '-p', 'wasm', '-a', 'wasm32', '-m', debug ? 'debug' : 'release', '-y']);
  run('xmake', []);
  execFileSync(process.execPath, ['scripts/generate-types.mjs'], { shell: false, stdio: 'inherit' });
}
