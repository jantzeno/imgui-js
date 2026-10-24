import { readFileSync } from 'node:fs';
import { writeChanged } from './generate-enums.mjs';
import createModule from '../dist/bind-imgui.js';

const native = await createModule({ wasmBinary: readFileSync('dist/bind-imgui.wasm') });
const groups = new Map();
for (const name of JSON.parse(readFileSync('build/generated/enums.json', 'utf8'))) {
  const index = name.indexOf('_');
  const group = name.slice(0, index);
  const member = name.slice(index + 1);
  const value = native[name];
  if (!Number.isInteger(value)) throw new Error(`Missing native enum: ${name}`);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(`  ${JSON.stringify(member)}: ${value},`);
}
const nativeEnums = new Set(['ImGuiDir', 'ImGuiSortDirection', 'ImGuiKey', 'ImGuiMouseSource', 'ImGuiSelectionRequestType', 'ImTextureFormat', 'ImTextureStatus']);
writeChanged('src/enums.ts', '// Generated from the compiled Dear ImGui library.\n' +
  [...groups].map(([name, values]) => {
    const type = nativeEnums.has(name) ? `typeof ${name}[keyof typeof ${name}]${name === 'ImGuiKey' ? ' | typeof ImGuiMod[keyof typeof ImGuiMod]' : ''}` : 'number';
    return `export const ${name} = {\n${values.join('\n')}\n} as const;\nexport type ${name} = ${type};`;
  }).join('\n\n') + '\n');
writeChanged('src/bind-imgui.d.ts', readFileSync('dist/bind-imgui.d.ts', 'utf8'));
