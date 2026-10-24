import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { prepareTestFonts } from '../scripts/prepare-test-fonts.mjs';

test('font fixtures restore verified bytes and overwrite stale output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'imgui test fonts '));
  const output = join(directory, 'output fonts');
  try {
    const entries = readFileSync(new URL('./fonts/SHA256SUMS', import.meta.url), 'utf8').trim().split(/\r?\n/).map(line => line.split('  '));
    prepareTestFonts(undefined, output);
    assert.deepEqual(readdirSync(output).sort(), entries.map(([, filename]) => filename).sort());
    for (const [expectedHash, filename] of entries) {
      assert.equal(createHash('sha256').update(readFileSync(join(output, filename))).digest('hex'), expectedHash, filename);
    }
    writeFileSync(join(output, 'NotoSans-Regular.ttf'), 'stale font');
    prepareTestFonts(undefined, output);
    assert.equal(createHash('sha256').update(readFileSync(join(output, 'NotoSans-Regular.ttf'))).digest('hex'),
      'f3961a9cde016d41a4879aecda1474d3a36d6bf54fa0e4643de029cc2248b0e8');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const { name, bytes, error } of [
  { name: 'missing input', bytes: null, error: { code: 'ENOENT' } },
  { name: 'truncated input', bytes: brotliCompressSync(Buffer.from('font fixture bytes')).subarray(0, 8), error: { code: 'Z_BUF_ERROR' } },
  { name: 'checksum mismatch', bytes: brotliCompressSync(Buffer.from('changed font fixture')), error: { message: 'SHA-256 checksum mismatch' } },
]) {
  test(`font preparation rejects ${name}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'imgui test fonts '));
    const source = join(directory, 'source fonts'), output = join(directory, 'output fonts');
    try {
      mkdirSync(source); mkdirSync(output);
      const hash = createHash('sha256').update('font fixture bytes').digest('hex');
      writeFileSync(join(source, 'SHA256SUMS'), `${hash}  fixture.ttf\r\n`);
      if (bytes) writeFileSync(join(source, 'fixture.ttf.br'), bytes);
      writeFileSync(join(output, 'fixture.ttf'), 'existing font');
      assert.throws(() => prepareTestFonts(source, output), failure => {
        assert.match(failure.message, /Could not prepare test font fixture\.ttf:/);
        for (const [key, expected] of Object.entries(error)) assert.equal(failure.cause[key], expected);
        return true;
      });
      assert.equal(readFileSync(join(output, 'fixture.ttf'), 'utf8'), 'existing font');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}

test('font preparation rejects invalid manifests', () => {
  const directory = mkdtempSync(join(tmpdir(), 'imgui test fonts '));
  const source = join(directory, 'source fonts'), output = join(directory, 'output fonts');
  try {
    mkdirSync(source);
    const hash = createHash('sha256').update('font fixture bytes').digest('hex');
    for (const manifest of ['', 'invalid checksum', `${hash}  ../escape.ttf`, `${hash}  ..\\escape.ttf`]) {
      writeFileSync(join(source, 'SHA256SUMS'), manifest);
      assert.throws(() => prepareTestFonts(source, output), /Invalid font checksum entry:/);
      assert.deepEqual(readdirSync(output), []);
    }
    assert.deepEqual(readdirSync(directory).sort(), ['output fonts', 'source fonts']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
