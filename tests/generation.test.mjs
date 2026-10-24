import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enumNames, writeChanged } from '../scripts/generate-enums.mjs';
import { verifyToolchain } from '../scripts/build.mjs';
import { spawnSync } from 'node:child_process';

test('build requires the pinned toolchain versions', () => {
  verifyToolchain('emcc (Emscripten) 6.0.13', '6.0.13', 'em++');
  verifyToolchain('xmake v3.1.2+HEAD', '3.1.2', 'xmake');
  assert.throws(() => verifyToolchain('emcc 4.0.0', '6.0.13', 'em++'), /6.0.13 is required; found 4.0.0/);
  assert.throws(() => verifyToolchain('emcc 6.0.130', '6.0.13', 'em++'), /6.0.13 is required; found 6.0.130/);
  assert.throws(() => verifyToolchain('missing', '6.0.13', 'em++'), /found unknown/);
  for (const args of [['--unknown'], ['--debug', '--extra']]) {
    const result = spawnSync(process.execPath, ['scripts/build.mjs', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: node scripts\/build.mjs/);
  }
});

test('enum discovery preserves numeric keys, aliases, and automatic values', () => {
  assert.deepEqual(enumNames(`
    enum ImGuiKey { ImGuiKey_None = 0, ImGuiKey_0 = 536, ImGuiKey_A, ImGuiMod_Ctrl = 1 << 12 };
    enum ImDrawFlags_ : int { ImDrawFlags_None = 0, ImDrawFlags_Closed = 1 << 9, ImDrawFlags_Closed_ = 0 };
    enum ImGuiFreeTypeLoaderFlags_ { ImGuiFreeTypeLoaderFlags_LoadColor = 1 << 8, ImGuiFreeTypeLoaderFlags_Bitmap = 1 << 9 };
    enum Duplicate { ImGuiKey_A = 546 }; enum Unrelated { Other_Value = 5 };
  `), ['ImGuiKey_None', 'ImGuiKey_0', 'ImGuiKey_A', 'ImGuiMod_Ctrl', 'ImDrawFlags_None', 'ImDrawFlags_Closed', 'ImGuiFreeTypeLoaderFlags_LoadColor', 'ImGuiFreeTypeLoaderFlags_Bitmap']);
  assert.deepEqual(enumNames('struct NoEnums {};'), []);
});

test('generation changes files only when content changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'imgui-generation-'));
  try {
    const path = join(directory, 'generated.ts');
    writeChanged(path, 'first');
    utimesSync(path, new Date(0), new Date(0));
    writeChanged(path, 'first');
    assert.equal(statSync(path).mtimeMs, 0);
    writeChanged(path, 'second');
    assert.equal(readFileSync(path, 'utf8'), 'second');
    assert.notEqual(statSync(path).mtimeMs, 0);
    assert.throws(() => writeChanged(directory, 'invalid'), { code: 'EISDIR' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
