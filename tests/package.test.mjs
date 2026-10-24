import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test('packed ESM package loads from an isolated TypeScript consumer', () => {
  const directory = mkdtempSync(join(tmpdir(), 'imgui-consumer-'));
  const shell = process.platform === 'win32';
  try {
    const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], { encoding: 'utf8', shell }))[0];
    const files = packed.files.map(file => file.path);
    for (const file of ['dist/imgui.js', 'dist/imgui.d.ts', 'dist/bind-imgui.js', 'dist/bind-imgui.d.ts', 'dist/bind-imgui.wasm', 'dist/enums.js', 'THIRD_PARTY_LICENSES.txt']) assert.ok(files.includes(file), file);
    assert.equal(files.some(file => file.startsWith('node_modules/') || file.startsWith('src/') || file.startsWith('tests/')), false);
    const map = JSON.parse(readFileSync('dist/imgui.js.map', 'utf8'));
    assert.match(map.sourcesContent[0], /export async function init/);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(directory, packed.filename)], { cwd: directory, encoding: 'utf8', shell });
    writeFileSync(join(directory, 'consumer.ts'), `
      import * as I from 'imgui-js';
      const key: I.ImGuiKey = I.ImGuiKey['0'];
      const flags: I.ImGuiMultiSelectFlags = I.ImGuiMultiSelectFlags.BoxSelect2d | I.ImGuiMultiSelectFlags.ClearOnClickVoid;
      async function use(canvas: HTMLCanvasElement) {
        await I.init({ canvas, locateFile: path => '/assets/' + path });
        const config = new I.ImFontConfig(); config.SizePixels = 18;
        config.FontLoaderFlags = I.FreeTypeLoaderFlags.LoadColor;
        I.addFontFromMemory(new Uint8Array(), 18, config);
        const texture: bigint = I.createTextureRGBA(new Uint8Array(4), 1, 1);
        I.newFrame(); I.Image(texture, { x: 32, y: 32 }); I.render();
        I.destroyTexture(texture); config.delete(); I.shutdown();
      }
      void key; void flags; void use;
    `);
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false, noEmit: true, types: [], lib: ['ES2022', 'DOM'] }, files: ['consumer.ts'] }));
    execFileSync(resolve('node_modules/.bin/' + (shell ? 'tsc.cmd' : 'tsc')), ['-p', directory], { cwd: directory, encoding: 'utf8', shell });
    const loaded = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import * as I from 'imgui-js';
      import { readFileSync } from 'node:fs';
      const wasm = readFileSync(new URL(import.meta.resolve('imgui-js/bind-imgui.wasm')));
      console.log(JSON.stringify({ key: I.ImGuiKey['0'], header: [...wasm.subarray(0, 4)], init: typeof I.init }));
    `], { cwd: directory, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(loaded), { key: 536, header: [0, 97, 115, 109], init: 'function' });
    const installed = JSON.parse(readFileSync(join(directory, 'node_modules/imgui-js/package.json'), 'utf8'));
    assert.equal(installed.version, '2.0.0');
    assert.equal(installed.dependencies, undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
