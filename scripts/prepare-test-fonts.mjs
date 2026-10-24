import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

export function prepareTestFonts(
  sourceDirectory = fileURLToPath(new URL('../tests/fonts/', import.meta.url)),
  outputDirectory = fileURLToPath(new URL('../build/test-fonts/', import.meta.url)),
) {
  const entries = readFileSync(join(sourceDirectory, 'SHA256SUMS'), 'utf8').trim().split(/\r?\n/);
  mkdirSync(outputDirectory, { recursive: true });
  for (const entry of entries) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9_-]+\.(?:ttf|otf))$/.exec(entry);
    if (!match) throw new Error(`Invalid font checksum entry: ${entry}`);
    const [, expectedHash, filename] = match;
    try {
      const bytes = brotliDecompressSync(readFileSync(join(sourceDirectory, filename + '.br')));
      if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
        throw new Error('SHA-256 checksum mismatch');
      }
      writeFileSync(join(outputDirectory, filename), bytes);
    } catch (cause) {
      throw new Error(`Could not prepare test font ${filename}: ${cause.message}`, { cause });
    }
  }
}

export default function setup() { prepareTestFonts(); }
