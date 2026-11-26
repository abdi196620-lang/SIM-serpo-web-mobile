import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_MODE } from '../config';
import {
  can,
  canAccessRoute,
  canRecordCashLedger,
  canSubmitAttendance,
  canUpdateBasecampLocation,
  canUpdateTicket,
  getAllowedRoutes,
} from './permissions';

test('DEMO_MODE flag is enabled by default', () => {
  assert.equal(DEMO_MODE, true);
});

test('Route permissions matrix: ADMIN gets only dashboard & profile, unknown role gets empty list', () => {
  assert.deepEqual(getAllowedRoutes('ADMIN'), ['dashboard', 'profil_pengaturan']);
  assert.equal(canAccessRoute('ADMIN', 'dashboard'), true);
  assert.equal(canAccessRoute('ADMIN', 'profil_pengaturan'), true);
  assert.equal(canAccessRoute('ADMIN', 'tiket'), false);
  assert.equal(canAccessRoute('ADMIN', 'dana_pengajuan'), false);

  // Unknown role MUST NOT fall back to KOORDINATOR
  assert.deepEqual(getAllowedRoutes('UNKNOWN_ROLE'), []);
  assert.equal(canAccessRoute('UNKNOWN_ROLE', 'dashboard'), false);
  assert.equal(canAccessRoute('UNKNOWN_ROLE', 'dana_pengajuan'), false);

  // Finance cannot open Tiket or Absensi
  assert.equal(canAccessRoute('FINANCE', 'tiket'), false);
  assert.equal(canAccessRoute('FINANCE', 'rekap_kehadiran'), false);
  assert.equal(canAccessRoute('FINANCE', 'persetujuan_koreksi'), false);
  assert.equal(canAccessRoute('FINANCE', 'buku_kas'), true);

  // Koordinator cannot open Anggaran Area or Temuan Rekonsiliasi
  assert.equal(canAccessRoute('KOORDINATOR', 'anggaran_area'), false);
  assert.equal(canAccessRoute('KOORDINATOR', 'temuan_rekonsiliasi'), false);
  assert.equal(canAccessRoute('KOORDINATOR', 'dana_pengajuan'), true);

  // Teknisi cannot open Finance/Rekonsiliasi pages
  assert.equal(canAccessRoute('TEKNISI', 'anggaran_area'), false);
  assert.equal(canAccessRoute('TEKNISI', 'buku_kas'), false);
  assert.equal(canAccessRoute('TEKNISI', 'peta_langsung'), true);
  assert.equal(canAccessRoute('TEKNISI', 'antrean_audit'), true);
});

test('Action permissions: can(roleCode, action) matches RBAC matrix', () => {
  // ticket.update
  assert.equal(can('KOORDINATOR', 'ticket.update'), true);
  assert.equal(can('MANAJER_AREA', 'ticket.update'), true);
  assert.equal(can('MANAGEMENT', 'ticket.update'), true);
  assert.equal(can('FINANCE', 'ticket.update'), false);
  assert.equal(can('TEKNISI', 'ticket.update'), false);
  assert.equal(can('ADMIN', 'ticket.update'), false);

  // ledger.*
  assert.equal(can('FINANCE', 'ledger.expense'), true);
  assert.equal(can('KOORDINATOR', 'ledger.expense'), true);
  assert.equal(can('MANAGEMENT', 'ledger.expense'), false);
  assert.equal(can('FINANCE', 'ledger.refund'), true);
  assert.equal(can('KOORDINATOR', 'ledger.refund'), false);
  assert.equal(can('FINANCE', 'ledger.adjustment'), true);
  assert.equal(can('MANAGEMENT', 'ledger.adjustment'), false);

  // budget.*
  assert.equal(can('FINANCE', 'budget.addAllocation'), true);
  assert.equal(can('MANAGEMENT', 'budget.addAllocation'), true);
  assert.equal(can('MANAJER_AREA', 'budget.addAllocation'), false);
  assert.equal(can('FINANCE', 'budget.setThreshold'), true);
  assert.equal(can('MANAGEMENT', 'budget.setThreshold'), true);
  assert.equal(can('KOORDINATOR', 'budget.setThreshold'), false);

  // recon / finding / correction
  assert.equal(can('FINANCE', 'recon.runManual'), true);
  assert.equal(can('MANAGEMENT', 'recon.runManual'), false);
  assert.equal(can('FINANCE', 'finding.markFalsePositive'), true);
  assert.equal(can('MANAGEMENT', 'finding.markFalsePositive'), false);
  assert.equal(can('FINANCE', 'correction.propose'), true);
  assert.equal(can('MANAGEMENT', 'correction.propose'), false);

  // demo.reset depends on MANAGEMENT and DEMO_MODE
  assert.equal(can('MANAGEMENT', 'demo.reset', true), true);
  assert.equal(can('MANAGEMENT', 'demo.reset', false), false);
  assert.equal(can('FINANCE', 'demo.reset', true), false);
  assert.equal(can('ADMIN', 'demo.reset', true), false);
});

test('Contextual guards: TEKNISI ticket status & KOORDINATOR own-basecamp EXPENSE', () => {
  // TEKNISI may update status of own assigned ticket only
  assert.equal(
    canUpdateTicket('TEKNISI', 201, { assigned_to: 201, priority: 'CRITICAL' }, { status: 'RESOLVED' }).allowed,
    true
  );
  // TEKNISI cannot update another technician's ticket
  assert.equal(
    canUpdateTicket('TEKNISI', 201, { assigned_to: 209, priority: 'HIGH' }, { status: 'IN_PROGRESS' }).allowed,
    false
  );
  // TEKNISI cannot reassign ticket
  assert.equal(
    canUpdateTicket('TEKNISI', 201, { assigned_to: 201, priority: 'CRITICAL' }, { assigned_to: 202 }).allowed,
    false
  );
  // FINANCE cannot update ticket
  assert.equal(
    canUpdateTicket('FINANCE', 102, { assigned_to: 201, priority: 'CRITICAL' }, { status: 'RESOLVED' }).allowed,
    false
  );

  // KOORDINATOR can record EXPENSE only for own basecamp
  assert.equal(canRecordCashLedger('KOORDINATOR', 'EXPENSE', 1, 1).allowed, true);
  assert.equal(canRecordCashLedger('KOORDINATOR', 'EXPENSE', 2, 1).allowed, false);
  assert.equal(canRecordCashLedger('KOORDINATOR', 'REFUND', 1, 1).allowed, false);
  assert.equal(canRecordCashLedger('KOORDINATOR', 'ADJUSTMENT', 1, 1).allowed, false);

  // FINANCE can record EXPENSE/REFUND/ADJUSTMENT for any basecamp
  assert.equal(canRecordCashLedger('FINANCE', 'EXPENSE', 7, null).allowed, true);
  assert.equal(canRecordCashLedger('FINANCE', 'REFUND', 7, null).allowed, true);
  assert.equal(canRecordCashLedger('FINANCE', 'ADJUSTMENT', 7, null).allowed, true);

  // Per-account attendance guard: TEKNISI can only submit attendance for own userId
  assert.equal(canSubmitAttendance('TEKNISI', 201, 201).allowed, true);
  assert.equal(canSubmitAttendance('TEKNISI', 201, 202).allowed, false);
  assert.equal(canSubmitAttendance('KOORDINATOR', 104, 201).allowed, false);
  assert.equal(canSubmitAttendance('MANAGEMENT', 101, 101).allowed, false);

  // Basecamp location edit guard
  assert.equal(canUpdateBasecampLocation('MANAGEMENT', 7, null).allowed, true);
  assert.equal(canUpdateBasecampLocation('MANAJER_AREA', 7, 4).allowed, true);
  assert.equal(canUpdateBasecampLocation('KOORDINATOR', 1, 1).allowed, true);
  assert.equal(canUpdateBasecampLocation('KOORDINATOR', 7, 1).allowed, false);
  assert.equal(canUpdateBasecampLocation('FINANCE', 7, null).allowed, false);
  assert.equal(canUpdateBasecampLocation('TEKNISI', 7, 7).allowed, false);
  assert.equal(canUpdateBasecampLocation('ADMIN', 7, null).allowed, false);
});

