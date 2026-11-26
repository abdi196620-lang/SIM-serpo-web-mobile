import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesToRoundedKb,
  computeArrayBufferSha256,
  formatFileSizeKb,
  isSupportedFundDocumentType,
  MAX_FUND_DOC_BYTES,
  MAX_FUND_DOC_SIZE_KB,
  pickBestCompressedCandidate,
  replaceFileExtension,
  sanitizeUploadFileName,
  validateFundDocumentSizeKb,
} from './fileUpload';

test('validateFundDocumentSizeKb allows files <= 2 MB (2048 KB) including < 1 MB and rejects > 2 MB', () => {
  assert.equal(MAX_FUND_DOC_SIZE_KB, 2048);

  assert.equal(validateFundDocumentSizeKb(1).valid, true);
  assert.equal(validateFundDocumentSizeKb(128).valid, true);
  assert.equal(validateFundDocumentSizeKb(500).valid, true);
  assert.equal(validateFundDocumentSizeKb(1024).valid, true);
  assert.equal(validateFundDocumentSizeKb(1536).valid, true);
  assert.equal(validateFundDocumentSizeKb(2048).valid, true);

  assert.equal(validateFundDocumentSizeKb(2049).valid, false);
  assert.equal(validateFundDocumentSizeKb(0).valid, false);
  assert.equal(validateFundDocumentSizeKb(-10).valid, false);
  assert.equal(validateFundDocumentSizeKb(NaN).valid, false);
});

test('bytesToRoundedKb and formatFileSizeKb format MB and KB cleanly', () => {
  assert.equal(bytesToRoundedKb(500), 1);
  assert.equal(bytesToRoundedKb(500 * 1024), 500);
  assert.equal(bytesToRoundedKb(MAX_FUND_DOC_BYTES), 2048);
  assert.equal(bytesToRoundedKb(0), 0);

  assert.equal(formatFileSizeKb(512), '512 KB');
  assert.equal(formatFileSizeKb(1024), '1,00 MB (1.024 KB)');
  assert.equal(formatFileSizeKb(1536), '1,50 MB (1.536 KB)');
  assert.equal(formatFileSizeKb(2048), '2,00 MB (2.048 KB)');
});

test('sanitizeUploadFileName, replaceFileExtension, and isSupportedFundDocumentType handle valid and invalid inputs', () => {
  assert.equal(sanitizeUploadFileName('Nota BBM & Genset (Makassar).PDF'), 'nota-bbm-genset-makassar.pdf');
  assert.equal(replaceFileExtension('scan-nota.png', '.jpg'), 'scan-nota.jpg');

  assert.equal(isSupportedFundDocumentType('application/pdf', 'rab.pdf'), 'pdf');
  assert.equal(isSupportedFundDocumentType('image/jpeg', 'nota.jpg'), 'image');
  assert.equal(isSupportedFundDocumentType('image/png', 'scan.png'), 'image');
  assert.equal(isSupportedFundDocumentType('image/webp', 'foto.webp'), 'image');
  assert.equal(isSupportedFundDocumentType('text/plain', 'catatan.txt'), null);
  assert.equal(isSupportedFundDocumentType('application/zip', 'archive.zip'), null);
});

test('pickBestCompressedCandidate picks highest-quality candidate under 2 MB limit', () => {
  const best = pickBestCompressedCandidate([
    { id: 'small', sizeBytes: 420 * 1024 },
    { id: 'crisp', sizeBytes: 1650 * 1024 },
    { id: 'edge-high', sizeBytes: 2040 * 1024 },
    { id: 'too-big', sizeBytes: 2200 * 1024 },
  ]);
  assert.equal(best?.id, 'crisp');

  // If all valid candidates are small (< 1 MB), still accepts and picks highest quality
  const smallBest = pickBestCompressedCandidate([
    { id: 'low-q', sizeBytes: 210 * 1024 },
    { id: 'high-q', sizeBytes: 680 * 1024 },
    { id: 'too-big', sizeBytes: 2500 * 1024 },
  ]);
  assert.equal(smallBest?.id, 'high-q');

  assert.equal(
    pickBestCompressedCandidate([
      { id: 'too-big-1', sizeBytes: 2100 * 1024 },
      { id: 'too-big-2', sizeBytes: 2500 * 1024 },
    ]),
    null
  );
});

test('computeArrayBufferSha256 generates deterministic 64-char SHA-256 hex digest', async () => {
  const buf = new TextEncoder().encode('sim-serpo-nota-test').buffer;
  const hash1 = await computeArrayBufferSha256(buf);
  const hash2 = await computeArrayBufferSha256(buf);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});
