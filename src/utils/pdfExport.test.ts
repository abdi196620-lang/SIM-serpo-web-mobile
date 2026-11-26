import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SERPO_STATE } from '../data/seedData';
import {
  buildCashLedgerPdfRows,
  computeCashLedgerExportSummary,
  formatPdfRupiah,
} from './pdfExport';

test('computeCashLedgerExportSummary calculates total IN, total OUT, and net balance cleanly', () => {
  const summary = computeCashLedgerExportSummary(INITIAL_SERPO_STATE.cashLedgers);
  assert.equal(summary.count, INITIAL_SERPO_STATE.cashLedgers.length);
  assert.ok(summary.totalIn > 0);
  assert.ok(summary.totalOut > 0);
  assert.equal(summary.netAmount, summary.totalIn - summary.totalOut);
});

test('buildCashLedgerPdfRows maps ledger entries with ASCII signs and basecamp names', () => {
  const rows = buildCashLedgerPdfRows(
    INITIAL_SERPO_STATE.cashLedgers.slice(0, 5),
    INITIAL_SERPO_STATE.basecamps
  );
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.ok(row.basecamp.length > 0);
    assert.ok(row.referensi.length > 0);
    assert.match(row.nominalText, /^[+-]/);
    assert.ok(!row.nominalText.includes('\u2212'));
    assert.ok(!row.saldoSesudahText.includes('\u2212'));
  }
  assert.equal(formatPdfRupiah(-200_000), '-Rp 200.000');
  assert.equal(formatPdfRupiah(1_250_000), 'Rp 1.250.000');
});
