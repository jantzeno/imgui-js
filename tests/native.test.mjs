import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import createModule from '../dist/bind-imgui.js';
import * as enums from '../dist/enums.js';

test('generated enums equal every compiled native constant', async () => {
  const native = await createModule({ wasmBinary: readFileSync('dist/bind-imgui.wasm') });
  const names = JSON.parse(readFileSync('build/generated/enums.json', 'utf8'));
  assert.ok(names.length > 500);
  for (const name of names) {
    const index = name.indexOf('_');
    assert.equal(enums[name.slice(0, index)][name.slice(index + 1)], native[name], name);
  }
  assert.equal(enums.ImGuiKey['0'], 536);
  assert.equal(enums.ImDrawFlags.Closed, 512);
  assert.equal(enums.ImGuiPopupFlags.MouseButtonRight, 8);
  assert.equal(enums.ImGuiFreeTypeLoaderFlags.LoadColor, 256);
  assert.equal(enums.ImGuiFreeTypeLoaderFlags.Bitmap, 512);
  assert.equal(native.IMGUI_VERSION, '1.93.0');
});

test('native filters include and exclude text and failed font loads recover', async () => {
  const native = await createModule({ wasmBinary: readFileSync('dist/bind-imgui.wasm') });
  const context = native.CreateContext(null);
  const filter = new native.ImGuiTextFilter('alpha,beta,-secret');
  try {
    assert.equal(filter.PassFilter('ALPHA item'), true);
    assert.equal(filter.PassFilter('beta item'), true);
    assert.equal(filter.PassFilter('secret alpha'), false);
    assert.equal(filter.PassFilter('gamma'), false);
    filter.SetFilter('-hidden');
    assert.equal(filter.PassFilter('visible'), true);
    assert.equal(filter.PassFilter('hidden'), false);
    filter.Clear();
    assert.equal(filter.IsActive(), false);
    assert.equal(filter.PassFilter('anything'), true);
    const atlas = native.GetIO().Fonts;
    assert.throws(() => atlas.AddFontFromMemoryTTF(new Uint8Array(100), 16, null), /Invalid font/);
    assert.throws(() => atlas.AddFontFromMemoryTTF(new Uint8Array(101), 16, null), /could not be loaded/);
    assert.equal(atlas.GetFontCount(), 0);
    const font = atlas.AddFontDefault(null);
    assert.equal(font.IsLoaded(), true);
    assert.equal(atlas.GetFontCount(), 1);
  } finally { filter.delete(); native.DestroyContext(context); }
});
