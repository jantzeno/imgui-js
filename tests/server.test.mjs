import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createStaticServer } from '../scripts/serve.mjs';

for (const [name, linked] of [
  ['development server serves ESM and Wasm and rejects escaping paths', false],
  ['development server serves symlinked roots and rejects escaping paths', true],
]) test(name, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'imgui-server-'));
  const root = join(directory, 'root');
  await mkdir(root);
  const alias = join(directory, 'alias');
  if (linked) await symlink(root, alias, 'junction');
  const server = createStaticServer(linked ? alias : root);
  try {
    await mkdir(join(root, 'example'));
    await writeFile(join(root, 'example/index.html'), '<title>demo</title>');
    await writeFile(join(root, 'module.js'), 'export const answer = 42;');
    await writeFile(join(root, 'module.wasm'), new Uint8Array([0, 97, 115, 109]));
    await writeFile(join(root, '.secret'), 'hidden');
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await (await fetch(url)).text(), '<title>demo</title>');
    const module = await fetch(`${url}/module.js`);
    assert.equal(module.headers.get('content-type'), 'text/javascript');
    assert.equal(await module.text(), 'export const answer = 42;');
    const wasm = await fetch(`${url}/module.wasm`);
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    assert.deepEqual(new Uint8Array(await wasm.arrayBuffer()), new Uint8Array([0, 97, 115, 109]));
    assert.equal((await fetch(`${url}/%2e%2e%2foutside`)).status, 403);
    assert.equal((await fetch(`${url}/.secret`)).status, 403);
    assert.equal((await fetch(`${url}/%zz`)).status, 400);
    assert.equal((await fetch(`${url}/missing`)).status, 404);
    await symlink(join(root, '..'), join(root, 'escape'), 'junction');
    assert.equal((await fetch(`${url}/escape`)).status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
