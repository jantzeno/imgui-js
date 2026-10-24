import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function enumNames(header) {
  const names = new Set();
  for (const [, body] of header.matchAll(/\benum\s+\w+(?:\s*:\s*\w+)?\s*\{([^}]+)\}/g)) {
    for (const [, name] of body.matchAll(/\b((?:ImGui|ImDraw|ImFont|ImTexture)\w+_\w+)\s*(?==|,|$)/g)) {
      if (!name.endsWith('_')) names.add(name);
    }
  }
  return [...names];
}

export function writeChanged(path, text) {
  let previous;
  try { previous = readFileSync(path, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous !== text) writeFileSync(path, text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const header = execFileSync('em++', [
    '-E', '-P', '-x', 'c++', '-Iimgui', '-DIMGUI_DISABLE_OBSOLETE_FUNCTIONS', '-DIMGUI_USE_WCHAR32',
    'imgui/misc/freetype/imgui_freetype.h',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32' });
  const names = enumNames(header);
  if (names.length < 500) throw new Error('ImGui enum discovery failed');
  mkdirSync('build/generated', { recursive: true });
  writeChanged('build/generated/enums.json', `${JSON.stringify(names)}\n`);
  const types = [...header.matchAll(/\benum\s+(\w+)(?:\s*:\s*\w+)?\s*\{([^}]+)\}/g)]
    .filter(([, name]) => !name.endsWith('_') && /^(ImGui|ImTexture)/.test(name))
    .map(([, name, body]) => {
      const values = enumNames(`enum Placeholder {${body}}`);
      return `emscripten::enum_<${name}>("Native${name}", emscripten::enum_value_type::number)\n` +
        values.map(value => `    .value("${value}", ${value})`).join('\n') + ';\n';
    }).join('\n');
  writeChanged('build/generated/enums.inc', types + names.map(name =>
    `emscripten::constant("${name}", static_cast<int>(${name}));`,
  ).join('\n') + '\n');
}
