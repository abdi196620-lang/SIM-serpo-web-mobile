import test from 'node:test';
import assert from 'node:assert/strict';
import { SERPO_SCHEMA_VERSION } from '../config';
import { INITIAL_SERPO_STATE } from '../data/seedData';
import {
  addBudgetAllocation,
  addDaysIso,
  applyCorrectionDecision,
  authenticateUser,
  buildCsvContent,
  canApproveCorrection,
  canLoginToPlatform,
  classifySyncAge,
  computeDashboardTicketKpis,
  computeTicketChartByBasecamp,
  decideFundRequest,
  flushOfflineOutboxFIFO,
  formatAttendanceDayLabel,
  generateSequentialLedgerRef,
  generateUniqueId,
  getAreaBudgetStatus,
  getAttendanceTypeLabel,
  getPendingApprovalsForUser,
  getUserStorageKeyForPlatform,
  haversineMeters,
  ingestLocationPings,
  isSessionExpired,
  parseCoordinateInput,
  parseStoredSerpoState,
  proposeCorrection,
  reconcileBudgetsWithLedgers,
  recordCashLedgerMutation,
  resolvePortalRedirectPath,
  resolveSyncAuditLog,
  restoreActiveUserId,
  runManualReconciliation,
  submitAttendance,
  submitFundRequest,
  updateBasecampLocation,
  updateBudgetThreshold,
  updateTicketWithHistory,
} from './serpoLogic';

test('D1 Auth: validates credentials against Auth_Providers, enforces 401/403, and records Auth_Sessions', () => {
  // Wrong password -> 401 generic
  const badPass = authenticateUser(INITIAL_SERPO_STATE, 'rina.m@serpo.example', 'wrongpass', 'Safari');
  assert.equal(badPass.statusCode, 401);
  assert.ok(badPass.error?.includes('401'));

  // Unknown email -> 401 generic
  const unknown = authenticateUser(INITIAL_SERPO_STATE, 'nobody@serpo.example', 'rahasia123', 'Safari');
  assert.equal(unknown.statusCode, 401);

  // Deactivated Technician_Profiles (even when Users.status is ACTIVE and password matches) -> 403
  const inactive = authenticateUser(INITIAL_SERPO_STATE, 'budi.nonaktif@serpo.example', 'rahasia123', 'Android');
  assert.equal(inactive.statusCode, 403);
  assert.ok(inactive.error?.includes('403'));

  // Valid login -> 200, loads role/placement/basecamp/area/Attendance_Locations & creates Auth_Sessions
  const ok = authenticateUser(INITIAL_SERPO_STATE, 'hendra.k@serpo.example', 'rahasia123', 'Pixel 8');
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.role?.code, 'KOORDINATOR');
  assert.equal(ok.basecamp?.name, 'Pasangkayu');
  assert.equal(ok.area?.name, 'Sulawesi Barat');
  assert.equal(ok.attendanceLocation?.radius, 200);
  assert.equal(ok.state.authSessions.length, INITIAL_SERPO_STATE.authSessions.length + 1);
  assert.equal(ok.state.authSessions[0].device_name, 'Pixel 8');
});

test('D2 Attendance: validates geofence Haversine, mock GPS, selfie attachment <=200KB, and open/closed state', () => {
  // User 207 (Dewi Lestari, Majene: lat -3.5403, lng 118.9707, radius 200m) has not checked in yet
  const mockFail = submitAttendance(INITIAL_SERPO_STATE, {
    userId: 207,
    aksi: 'CHECK_IN',
    lat: -3.5403,
    lng: 118.9707,
    accuracy: 10,
    is_mock: true,
    client_uuid: 'att-mock-1',
    selfie_path: '/tmp/s.jpg',
    selfie_sha256: 'abc123',
    selfie_size_kb: 120,
  });
  assert.equal(mockFail.statusCode, 422);
  assert.equal(mockFail.errorCode, 'MOCK_LOCATION');

  // Outside geofence (~550m north)
  const dist = haversineMeters(-3.535, 118.9707, -3.5403, 118.9707);
  assert.ok(dist > 200);
  const geoFail = submitAttendance(INITIAL_SERPO_STATE, {
    userId: 207,
    aksi: 'CHECK_IN',
    lat: -3.535,
    lng: 118.9707,
    accuracy: 12,
    is_mock: false,
    client_uuid: 'att-geo-1',
    selfie_path: '/tmp/s.jpg',
    selfie_sha256: 'abc123',
    selfie_size_kb: 120,
  });
  assert.equal(geoFail.statusCode, 422);
  assert.equal(geoFail.errorCode, 'DI_LUAR_AREA');

  // Poor GPS accuracy (> 50m) inside geofence -> AKURASI_BURUK
  const accFail = submitAttendance(INITIAL_SERPO_STATE, {
    userId: 207,
    aksi: 'CHECK_IN',
    lat: -3.5403,
    lng: 118.9707,
    accuracy: 85,
    is_mock: false,
    client_uuid: 'att-acc-1',
    selfie_path: '/tmp/s.jpg',
    selfie_sha256: 'abc123',
    selfie_size_kb: 120,
  });
  assert.equal(accFail.statusCode, 422);
  assert.equal(accFail.errorCode, 'AKURASI_BURUK');

  // Valid CHECK_IN
  const checkIn = submitAttendance(INITIAL_SERPO_STATE, {
    userId: 207,
    aksi: 'CHECK_IN',
    lat: -3.5404,
    lng: 118.9708,
    accuracy: 10,
    is_mock: false,
    client_uuid: 'att-ok-1',
    selfie_path: '/uploads/dewi-in.jpg',
    selfie_sha256: 'deadbeef1234',
    selfie_size_kb: 145,
  });
  assert.equal(checkIn.statusCode, 201);
  assert.equal(checkIn.attendance?.source, 'ONLINE');
  assert.equal(checkIn.attendance?.verification_status, 'VERIFIED');

  // Duplicate CHECK_IN -> 409 SUDAH_ABSEN
  const dup = submitAttendance(checkIn.state, {
    userId: 207,
    aksi: 'CHECK_IN',
    lat: -3.5404,
    lng: 118.9708,
    accuracy: 10,
    is_mock: false,
    client_uuid: 'att-ok-2',
    selfie_path: '/uploads/dewi-in2.jpg',
    selfie_sha256: 'deadbeef1235',
    selfie_size_kb: 140,
  });
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.errorCode, 'SUDAH_ABSEN');

  // Valid CHECK_OUT closes attendance
  const checkOut = submitAttendance(checkIn.state, {
    userId: 207,
    aksi: 'CHECK_OUT',
    lat: -3.5403,
    lng: 118.9707,
    accuracy: 9,
    is_mock: false,
    client_uuid: 'att-out-1',
    selfie_path: '/uploads/dewi-out.jpg',
    selfie_sha256: 'cafe1234',
    selfie_size_kb: 130,
  });
  assert.equal(checkOut.statusCode, 200);
  assert.ok(checkOut.attendance?.check_out_time);
});

test('D3 & D4: itemized Fund_Requests, client_uuid idempotency, audit gate 409, atomic Cash_Ledgers & D7 Budget Alert', () => {
  // 1. Submit itemized fund request (Hendra, id 104, Pasangkayu id 1)
  const frRes = submitFundRequest(INITIAL_SERPO_STATE, {
    requesterId: 104,
    basecampId: 1,
    description: 'Top-up kas lapangan Pasangkayu',
    items: [
      { item_name: 'Pertalite', quantity: 30, unit: 'liter', unit_price: 10_000 },
      { item_name: 'Konsumsi', quantity: 5, unit: 'paket', unit_price: 40_000 },
    ],
    doc_path: '/uploads/docs/test-nota.jpg',
    doc_sha256: 'sha256test',
    doc_size_kb: 1450,
    client_uuid: 'uuid-test-fr-1',
  });
  assert.equal(frRes.statusCode, 201);
  assert.equal(frRes.fundRequest?.amount, 500_000);
  assert.equal(frRes.fundRequest?.status, 'PENDING');

  // Idempotent retry returns same request (200)
  const frRetry = submitFundRequest(frRes.state, {
    requesterId: 104,
    basecampId: 1,
    description: 'Top-up kas lapangan Pasangkayu',
    items: [{ item_name: 'Pertalite', quantity: 30, unit: 'liter', unit_price: 10_000 }],
    doc_path: '/uploads/docs/test-nota.jpg',
    doc_sha256: 'sha256test',
    doc_size_kb: 1450,
    client_uuid: 'uuid-test-fr-1',
  });
  assert.equal(frRetry.statusCode, 200);
  assert.equal(frRetry.idempotentHit, true);

  // 2. Finance (102) attempts final approval on FR 3 (FR-2026-0416, offline ACCEPTED_FLAGGED unresolved) -> 409 FLAG_AUDIT_BELUM_DISELESAIKAN
  const blocked = decideFundRequest(INITIAL_SERPO_STATE, 3, 102, 'SETUJUI');
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.errorCode, 'FLAG_AUDIT_BELUM_DISELESAIKAN');

  // Wrong role (Manajer Area 103) tries step 2 on FR 3 -> 403 TIDAK_BERHAK
  const wrongRole = decideFundRequest(INITIAL_SERPO_STATE, 3, 103, 'SETUJUI');
  assert.equal(wrongRole.statusCode, 403);
  assert.equal(wrongRole.errorCode, 'TIDAK_BERHAK');

  // 3. Resolve Sync_Audit_Logs id 1 (CONFIRMED), then Finance approves FR 3 (1_250_000 -> area realized becomes 18_500_000 / 20_000_000 = 92.5% > 90% alert_threshold!)
  const resolvedState = resolveSyncAuditLog(INITIAL_SERPO_STATE, 1, 'CONFIRMED', 102, 'Nota fisik valid');
  const approved = decideFundRequest(resolvedState, 3, 102, 'SETUJUI', 'Cairkan kas');
  assert.equal(approved.statusCode, 200);
  assert.equal(approved.budgetAlertTriggered, true);

  const area1Budget = approved.state.budgets.find((b) => b.id === 1)!;
  assert.equal(area1Budget.realized_amount, 18_500_000);
  assert.equal(getAreaBudgetStatus(area1Budget), 'ALERT');

  const mamuju2Bal = approved.state.basecampCashBalances.find((cb) => cb.basecamp_id === 7)!;
  assert.equal(mamuju2Bal.current_balance, 1_320_000 + 1_250_000);

  // Budget alert notifications emitted with dedupe_key BUDGET_ALERT:1:90
  const budgetAlerts = approved.state.notifications.filter(
    (n) => n.dedupe_key === 'BUDGET_ALERT:1:90'
  );
  assert.ok(budgetAlerts.length >= 2); // Management + Koordinator in Area 1

  // D7 Reconciliation matches Cash_Ledgers TOP_UP sum
  const recon = reconcileBudgetsWithLedgers(approved.state);
  assert.equal(recon.every((r) => r.matched), true);

  // Reject without note fails 422; reject with note cancels remaining steps
  const badReject = decideFundRequest(approved.state, 1, 103, 'TOLAK', '  ');
  assert.equal(badReject.statusCode, 422);
  const goodReject = decideFundRequest(approved.state, 1, 103, 'TOLAK', 'Diluar rencana kerja');
  assert.equal(goodReject.statusCode, 200);
  assert.equal(goodReject.state.fundRequests.find((r) => r.id === 1)?.status, 'REJECTED');
  assert.equal(
    goodReject.state.fundRequestApprovals.find((a) => a.fund_request_id === 1 && a.step_order === 2)?.status,
    'CANCELLED'
  );
  assert.ok(getPendingApprovalsForUser(INITIAL_SERPO_STATE, 103).length >= 3);
});

test('D5 Tracking: batch ping validation, (user_id, recorded_at) idempotency, and post-checkout tolerance rejection', () => {
  const res = ingestLocationPings(INITIAL_SERPO_STATE, [
    {
      ping_id: 'p1',
      user_id: 201,
      attendance_id: 1, // open attendance
      latitude: -2.686,
      longitude: 118.8985,
      accuracy: 12,
      battery_level: 74,
      is_mock: false,
      fix_at: '2026-11-08T09:30:00+08:00',
      recorded_at: '2026-11-08T09:40:00+08:00',
    },
    {
      ping_id: 'p2-after-checkout',
      user_id: 209,
      attendance_id: 7, // checked out at 09:15 + 15m tolerance = 09:30 max
      latitude: -2.6894,
      longitude: 118.8961,
      accuracy: 10,
      battery_level: 80,
      is_mock: false,
      fix_at: '2026-11-08T09:35:00+08:00',
      recorded_at: '2026-11-08T09:35:00+08:00',
    },
  ]);
  assert.deepEqual(res.accepted_ids, ['p1']);
  assert.equal(res.rejected_ids.length, 1);
  assert.equal(res.rejected_ids[0].ping_id, 'p2-after-checkout');
});

test('D6 Offline Sync: FIFO flush classifies age, preserves LATE/CLOCK_ANOMALY as ACCEPTED_FLAGGED, and updates outbox', () => {
  assert.equal(classifySyncAge('2026-11-08T08:00:00+08:00', '2026-11-08T09:41:00+08:00').age_flag, 'NORMAL');
  assert.equal(classifySyncAge('2026-11-06T09:41:00+08:00', '2026-11-08T09:41:00+08:00').age_flag, 'PRIORITY');
  assert.equal(classifySyncAge('2026-11-04T09:41:00+08:00', '2026-11-08T09:41:00+08:00').age_flag, 'LATE');
  assert.equal(classifySyncAge('2026-11-09T09:41:00+08:00', '2026-11-08T09:41:00+08:00').age_flag, 'CLOCK_ANOMALY');

  // Queue an offline LATE fund request while offline
  const queued = submitFundRequest(INITIAL_SERPO_STATE, {
    requesterId: 104,
    basecampId: 1,
    description: 'Klaim BBM terputus sinyal 4 hari',
    items: [{ item_name: 'Pertalite', quantity: 25, unit: 'liter', unit_price: 10_000 }],
    doc_path: '/local/nota-late.jpg',
    doc_sha256: 'latehash123',
    doc_size_kb: 1320,
    client_uuid: 'outbox-late-fr-1',
    client_created_at: '2026-11-04T08:00:00+08:00',
    forceOffline: true,
  });
  assert.equal(queued.queuedOffline, true);

  // Flush FIFO when online
  const flushed = flushOfflineOutboxFIFO(queued.state);
  assert.equal(flushed.processed, 2); // seed item (Dewi check-in) + late FR
  const lateAudit = flushed.state.syncAuditLogs.find((l) => l.client_uuid === 'outbox-late-fr-1');
  assert.equal(lateAudit?.age_flag, 'LATE');
  assert.equal(lateAudit?.outcome, 'ACCEPTED_FLAGGED');
  assert.equal(lateAudit?.resolution_status, 'UNRESOLVED');
});

test('Ticket history & correction segregation of duties + CSV escaping', () => {
  const updatedTicketRes = updateTicketWithHistory(INITIAL_SERPO_STATE, 3, 103, {
    assigned_to: 207,
    status: 'ASSIGNED',
    note: 'Ditugaskan ke Dewi Lestari',
  });
  assert.equal(updatedTicketRes.error, undefined);
  assert.equal(
    updatedTicketRes.state.ticketStatusHistory.filter((h) => h.ticket_id === 3).length,
    2
  );

  const cor = INITIAL_SERPO_STATE.corrections[0]; // proposer_user_id: 102
  assert.equal(canApproveCorrection(cor, 102, 'MANAGEMENT').allowed, false);
  assert.equal(canApproveCorrection(cor, 101, 'FINANCE').allowed, false);
  assert.equal(canApproveCorrection(cor, 101, 'MANAGEMENT').allowed, true);

  const corRes = applyCorrectionDecision(
    INITIAL_SERPO_STATE,
    'COR-101',
    'approve',
    101,
    'Rina Kusuma',
    'MANAGEMENT'
  );
  assert.equal(corRes.error, undefined);
  assert.equal(
    corRes.state.basecampCashBalances.find((cb) => cb.basecamp_id === 1)?.current_balance,
    800_000
  );

  const csv = buildCsvContent(
    ['Basecamp', 'Catatan'],
    [['Pasangkayu', 'Melebihi "ambang", perlu tinjauan']]
  );
  assert.equal(csv, 'Basecamp,Catatan\nPasangkayu,"Melebihi ""ambang"", perlu tinjauan"');

  const kpis = computeDashboardTicketKpis(INITIAL_SERPO_STATE.tickets);
  assert.equal(kpis.totalTickets, INITIAL_SERPO_STATE.tickets.filter((t) => t.status !== 'CANCELLED').length);
  assert.ok(kpis.slaCompliancePct > 0 && kpis.slaCompliancePct <= 100);
  assert.ok(kpis.urgentIssuesCount >= 1);

  const chartSeries = computeTicketChartByBasecamp(INITIAL_SERPO_STATE);
  assert.ok(chartSeries.length > 0);
  assert.equal(
    chartSeries.every((d) => d.standardCount + d.urgentCount === d.totalCount),
    true
  );

  // Platform separation rules (Teknisi Mobile vs Backoffice Desktop)
  assert.equal(canLoginToPlatform('MANAGEMENT', 'backoffice').allowed, true);
  assert.equal(canLoginToPlatform('KOORDINATOR', 'backoffice').allowed, true);
  assert.equal(canLoginToPlatform('TEKNISI', 'backoffice').allowed, false);
  assert.equal(canLoginToPlatform('TEKNISI', 'teknisi').allowed, true);
  assert.equal(canLoginToPlatform('FINANCE', 'teknisi').allowed, false);
  assert.equal(canLoginToPlatform('MANAJER_AREA', 'teknisi').allowed, false);
});

test('Cash ledger ADJUSTMENT routes through Correction approval (IN/OUT) and blocks negative balances & invalid amounts', () => {
  // Direct ADJUSTMENT write is rejected
  const directAdj = recordCashLedgerMutation(INITIAL_SERPO_STATE, 102, {
    basecampId: 1,
    transactionType: 'ADJUSTMENT',
    amount: 50_000,
    description: 'Coba tulis langsung',
  });
  assert.ok(directAdj.error);

  // Rejects NaN, zero, negative, and < 1.000
  assert.ok(
    recordCashLedgerMutation(INITIAL_SERPO_STATE, 102, {
      basecampId: 1,
      transactionType: 'EXPENSE',
      amount: Number.NaN,
      description: 'Invalid NaN',
    }).error
  );
  assert.ok(
    recordCashLedgerMutation(INITIAL_SERPO_STATE, 102, {
      basecampId: 1,
      transactionType: 'EXPENSE',
      amount: 0,
      description: 'Zero',
    }).error
  );
  assert.ok(
    recordCashLedgerMutation(INITIAL_SERPO_STATE, 102, {
      basecampId: 1,
      transactionType: 'EXPENSE',
      amount: -5000,
      description: 'Negative',
    }).error
  );
  assert.ok(
    recordCashLedgerMutation(INITIAL_SERPO_STATE, 102, {
      basecampId: 1,
      transactionType: 'EXPENSE',
      amount: 999,
      description: 'Below minimum',
    }).error
  );

  // Rejects EXPENSE exceeding balance
  assert.ok(
    recordCashLedgerMutation(INITIAL_SERPO_STATE, 102, {
      basecampId: 1,
      transactionType: 'EXPENSE',
      amount: 10_000_000,
      description: 'Overdraft',
    }).error
  );

  // Sequential reference generation EXP-2611-XXXX
  const nextRef = generateSequentialLedgerRef(
    INITIAL_SERPO_STATE.cashLedgers,
    'EXPENSE',
    INITIAL_SERPO_STATE.serverNowIso
  );
  assert.match(nextRef, /^EXP-2611-\d{4}$/);

  // Propose ADJUSTMENT OUT that would make balance negative -> rejected
  const negProp = proposeCorrection(
    INITIAL_SERPO_STATE,
    { id: 102, fullName: 'Maya Anggraini', roleName: 'Finance' },
    {
      findingId: 'MANUAL-ADJ-1',
      type: 'ADJUSTMENT',
      basecampId: 1,
      cashDelta: -5_000_000,
      realizationDelta: 0,
      reason: 'Koreksi melebihi saldo',
    }
  );
  assert.ok(negProp.error);

  // Valid ADJUSTMENT OUT via proposal -> approval by Management updates Cash_Ledgers OUT & balance
  const balBefore = INITIAL_SERPO_STATE.basecampCashBalances.find((cb) => cb.basecamp_id === 1)!.current_balance;
  const outProp = proposeCorrection(
    INITIAL_SERPO_STATE,
    { id: 102, fullName: 'Maya Anggraini', roleName: 'Finance' },
    {
      findingId: 'MANUAL-ADJ-1',
      type: 'ADJUSTMENT',
      basecampId: 1,
      cashDelta: -100_000,
      realizationDelta: 0,
      reason: 'Koreksi selisih hitung kas fisik',
    }
  );
  assert.equal(outProp.error, undefined);
  assert.equal(outProp.state.cashLedgers.length, INITIAL_SERPO_STATE.cashLedgers.length);

  const approvedOut = applyCorrectionDecision(
    outProp.state,
    outProp.proposal!.id,
    'approve',
    101,
    'Rina Kusuma',
    'MANAGEMENT'
  );
  assert.equal(approvedOut.error, undefined);
  assert.equal(approvedOut.state.cashLedgers.length, INITIAL_SERPO_STATE.cashLedgers.length + 1);
  assert.equal(approvedOut.state.cashLedgers[0].transaction_type, 'ADJUSTMENT');
  assert.equal(approvedOut.state.cashLedgers[0].direction, 'OUT');
  assert.equal(
    approvedOut.state.basecampCashBalances.find((cb) => cb.basecamp_id === 1)?.current_balance,
    balBefore - 100_000
  );

  // Valid ADJUSTMENT IN via proposal -> approval adds balance
  const inProp = proposeCorrection(
    approvedOut.state,
    { id: 102, fullName: 'Maya Anggraini', roleName: 'Finance' },
    {
      findingId: 'MANUAL-ADJ-1',
      type: 'ADJUSTMENT',
      basecampId: 1,
      cashDelta: 50_000,
      realizationDelta: 0,
      reason: 'Penambahan selisih kas ditemukan',
    }
  );
  assert.equal(inProp.error, undefined);
  const approvedIn = applyCorrectionDecision(
    inProp.state,
    inProp.proposal!.id,
    'approve',
    101,
    'Rina Kusuma',
    'MANAGEMENT'
  );
  assert.equal(approvedIn.error, undefined);
  assert.equal(approvedIn.state.cashLedgers[0].direction, 'IN');
  assert.equal(
    approvedIn.state.basecampCashBalances.find((cb) => cb.basecamp_id === 1)?.current_balance,
    balBefore - 50_000
  );
});

test('Budget validation, 404 on missing fundRequest, and manual reconciliation findings', () => {
  // Budget allocation rejects NaN, <=0, <500_000, and accepts >=500_000
  assert.ok(addBudgetAllocation(INITIAL_SERPO_STATE, 1, Number.NaN).error);
  assert.ok(addBudgetAllocation(INITIAL_SERPO_STATE, 1, 0).error);
  assert.ok(addBudgetAllocation(INITIAL_SERPO_STATE, 1, 499_000).error);
  const okAlloc = addBudgetAllocation(INITIAL_SERPO_STATE, 1, 500_000);
  assert.equal(okAlloc.error, undefined);

  // Threshold validation
  assert.ok(updateBudgetThreshold(INITIAL_SERPO_STATE, 1, Number.NaN).error);
  assert.ok(updateBudgetThreshold(INITIAL_SERPO_STATE, 1, 0).error);
  assert.equal(updateBudgetThreshold(INITIAL_SERPO_STATE, 1, 85).error, undefined);

  // Missing fundRequest returns 404 (not 409)
  const missingFr = decideFundRequest(INITIAL_SERPO_STATE, 99999, 102, 'SETUJUI');
  assert.equal(missingFr.statusCode, 404);

  // Manual reconciliation when matched produces 0 new findings
  const cleanRecon = runManualReconciliation(INITIAL_SERPO_STATE, 'Maya Anggraini', 420);
  assert.equal(cleanRecon.newFindings.length, 0);
  assert.equal(cleanRecon.run.newFindings, 0);
  assert.match(cleanRecon.run.notes, /100%/);

  // Manual reconciliation when Budgets.realized_amount has discrepancy creates non-duplicate finding
  const skewedState = {
    ...INITIAL_SERPO_STATE,
    budgets: INITIAL_SERPO_STATE.budgets.map((b) =>
      b.id === 1 ? { ...b, realized_amount: b.realized_amount + 350_000 } : b
    ),
  };
  const firstRun = runManualReconciliation(skewedState, 'Maya Anggraini', 1500);
  assert.equal(firstRun.newFindings.length, 1);
  assert.equal(firstRun.run.newFindings, 1);
  assert.equal(firstRun.state.findings.length, skewedState.findings.length + 1);

  // Second run for same discrepancy updates occurrences without duplicating
  const secondRun = runManualReconciliation(firstRun.state, 'Maya Anggraini', 900);
  assert.equal(secondRun.newFindings.length, 0);
  assert.equal(secondRun.run.newFindings, 0);
  assert.equal(secondRun.state.findings.length, firstRun.state.findings.length);
  assert.equal(
    secondRun.state.findings.find((f) => f.id === firstRun.newFindings[0].id)?.occurrences,
    2
  );
});

test('Ticket state machine, dynamic session expiry, unique IDs, chart >6 basecamps, and schema validation', () => {
  // Ticket illegal jump OPEN -> IN_PROGRESS is rejected
  const openTicket = INITIAL_SERPO_STATE.tickets.find((t) => t.status === 'OPEN')!;
  const skipRes = updateTicketWithHistory(INITIAL_SERPO_STATE, openTicket.id, 103, {
    status: 'IN_PROGRESS',
  });
  assert.ok(skipRes.error);

  // Valid path OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED, then locked
  const step1 = updateTicketWithHistory(INITIAL_SERPO_STATE, openTicket.id, 103, {
    assigned_to: 207,
    status: 'ASSIGNED',
    priority: 'HIGH',
    note: 'Dikirim ke Dewi',
  });
  assert.equal(step1.error, undefined);

  // Same-status note & priority change records history
  const sameStatusNote = updateTicketWithHistory(step1.state, openTicket.id, 103, {
    priority: 'CRITICAL',
    note: 'Eskalasi prioritas',
  });
  assert.equal(sameStatusNote.error, undefined);
  assert.equal(
    sameStatusNote.state.ticketStatusHistory.filter((h) => h.ticket_id === openTicket.id).length >
      step1.state.ticketStatusHistory.filter((h) => h.ticket_id === openTicket.id).length,
    true
  );

  const step2 = updateTicketWithHistory(sameStatusNote.state, openTicket.id, 207, {
    status: 'IN_PROGRESS',
  });
  assert.equal(step2.error, undefined);
  const step3 = updateTicketWithHistory(step2.state, openTicket.id, 207, {
    status: 'RESOLVED',
  });
  assert.equal(step3.error, undefined);

  // RESOLVED ticket cannot reopen
  const locked = updateTicketWithHistory(step3.state, openTicket.id, 103, {
    status: 'OPEN',
  });
  assert.ok(locked.error);

  // Session expiry computed dynamically from serverNowIso + 7 days
  const auth = authenticateUser(INITIAL_SERPO_STATE, 'hendra.k@serpo.example', 'rahasia123', 'Chrome');
  assert.equal(auth.statusCode, 200);
  const expectedExpiry = addDaysIso(INITIAL_SERPO_STATE.serverNowIso, 7);
  assert.equal(auth.state.authSessions[0].expires_at, expectedExpiry);
  assert.equal(
    isSessionExpired(auth.state.authSessions[0], INITIAL_SERPO_STATE.serverNowIso),
    false
  );
  assert.equal(
    isSessionExpired(auth.state.authSessions[0], addDaysIso(INITIAL_SERPO_STATE.serverNowIso, 8)),
    true
  );

  // Expired session rejected on restore
  const expiredState = {
    ...auth.state,
    serverNowIso: addDaysIso(INITIAL_SERPO_STATE.serverNowIso, 8),
  };
  assert.equal(restoreActiveUserId(String(auth.user!.id), expiredState), null);

  // Unique IDs
  const idA = generateUniqueId('fr');
  const idB = generateUniqueId('fr');
  assert.notEqual(idA, idB);

  // Chart includes all basecamps with active tickets (>6 not truncated)
  const extraTickets = INITIAL_SERPO_STATE.basecamps.slice(0, 8).map((bc, idx) => ({
    ...INITIAL_SERPO_STATE.tickets[0],
    id: 900 + idx,
    ticket_no: `TKT-EXTRA-${idx}`,
    basecamp_id: bc.id,
    status: 'OPEN' as const,
  }));
  const chartAll = computeTicketChartByBasecamp({
    ...INITIAL_SERPO_STATE,
    tickets: [...INITIAL_SERPO_STATE.tickets, ...extraTickets],
  });
  assert.equal(chartAll.length, 8);
  assert.ok(chartAll.length > 6);

  // parseStoredSerpoState rejects invalid JSON, wrong schemaVersion, or missing arrays
  assert.equal(parseStoredSerpoState('not-json', INITIAL_SERPO_STATE), INITIAL_SERPO_STATE);
  const wrongSchema = JSON.stringify({ ...INITIAL_SERPO_STATE, schemaVersion: SERPO_SCHEMA_VERSION + 99 });
  assert.equal(parseStoredSerpoState(wrongSchema, INITIAL_SERPO_STATE), INITIAL_SERPO_STATE);
  const missingArr = JSON.stringify({ ...INITIAL_SERPO_STATE, cashLedgers: 'invalid' });
  assert.equal(parseStoredSerpoState(missingArr, INITIAL_SERPO_STATE), INITIAL_SERPO_STATE);
  const validStored = JSON.stringify(INITIAL_SERPO_STATE);
  assert.equal(parseStoredSerpoState(validStored, INITIAL_SERPO_STATE).schemaVersion, SERPO_SCHEMA_VERSION);

  // Separate standalone app storage keys & portal query redirects
  assert.notEqual(
    getUserStorageKeyForPlatform('backoffice'),
    getUserStorageKeyForPlatform('teknisi')
  );
  assert.equal(resolvePortalRedirectPath('?app=backoffice&autostart=1'), '/backoffice.html?app=backoffice&autostart=1');
  assert.equal(resolvePortalRedirectPath('?app=teknisi&autostart=1'), '/teknisi.html?app=teknisi&autostart=1');
  assert.equal(resolvePortalRedirectPath('?foo=bar'), null);
});

test('Attendance formatting & DINAS_LUAR / LEMBUR types preserve data integrity', () => {
  const day = formatAttendanceDayLabel('2026-11-08');
  assert.equal(day.weekday, 'Minggu');
  assert.equal(day.dateLabel, '8 Nov');

  assert.equal(getAttendanceTypeLabel('DINAS_LUAR'), 'Dinas Luar');
  assert.equal(getAttendanceTypeLabel('LEMBUR'), 'Lembur');
  assert.equal(getAttendanceTypeLabel('REGULER'), 'Reguler');

  const dinasLuar = submitAttendance(INITIAL_SERPO_STATE, {
    userId: 207,
    aksi: 'CHECK_IN',
    attendance_type: 'DINAS_LUAR',
    lat: -3.5404,
    lng: 118.9708,
    accuracy: 12,
    is_mock: false,
    client_uuid: 'att-dinas-1',
    selfie_path: '/uploads/dewi-dinas.jpg',
    selfie_sha256: 'dinas1234',
    selfie_size_kb: 95,
  });
  assert.equal(dinasLuar.statusCode, 201);
  assert.equal(dinasLuar.attendance?.attendance_type, 'DINAS_LUAR');
});

test('Basecamp 7 saved as Basecamp Makassar at -5.158113, 119.478260 and basecamp coordinate parser + updater validate inputs', () => {
  const bc7 = INITIAL_SERPO_STATE.basecamps.find((b) => b.id === 7)!;
  const bc7Loc = INITIAL_SERPO_STATE.attendanceLocations.find(
    (l) => l.attendance_location_id === 7
  )!;
  assert.equal(bc7.name, 'Makassar');
  assert.equal(bc7.code, 'BC-MKS');
  assert.equal(bc7Loc.name, 'Basecamp Makassar');
  assert.equal(bc7Loc.lat, -5.158113);
  assert.equal(bc7Loc.lng, 119.47826);

  // Real device coordinates near the saved Makassar basecamp fall inside 200m radius
  const distFromSaved = haversineMeters(-5.15799, 119.4783, bc7Loc.lat, bc7Loc.lng);
  assert.ok(distFromSaved < 50);

  // Google Maps URL & plain coordinate parsing
  assert.deepEqual(
    parseCoordinateInput('https://www.google.com/maps/search/-5.158113,+119.478260'),
    { lat: -5.158113, lng: 119.47826 }
  );
  assert.deepEqual(parseCoordinateInput('-5.158113, 119.478260'), {
    lat: -5.158113,
    lng: 119.47826,
  });
  assert.deepEqual(
    parseCoordinateInput('https://www.google.com/maps/@-5.158113,119.478260,17z'),
    { lat: -5.158113, lng: 119.47826 }
  );
  assert.equal(parseCoordinateInput('invalid coords'), null);

  // Rejects invalid coordinates or out-of-range radius
  assert.ok(updateBasecampLocation(INITIAL_SERPO_STATE, 7, { lat: 95, lng: 119.47826 }).error);
  assert.ok(updateBasecampLocation(INITIAL_SERPO_STATE, 7, { lat: -5.158113, lng: 190 }).error);
  assert.ok(
    updateBasecampLocation(INITIAL_SERPO_STATE, 7, { lat: -5.158113, lng: 119.47826, radius: 20 })
      .error
  );

  // Valid update updates attendanceLocations
  const updated = updateBasecampLocation(INITIAL_SERPO_STATE, 7, {
    lat: -5.1585,
    lng: 119.4789,
    radius: 250,
  });
  assert.equal(updated.error, undefined);
  assert.equal(updated.location?.lat, -5.1585);
  assert.equal(updated.location?.lng, 119.4789);
  assert.equal(updated.location?.radius, 250);
});

test('submitFundRequest allows documents <= 2 MB (1..2048 KB) and rejects > 2 MB or empty', () => {
  const basePayload = {
    requesterId: 104,
    basecampId: 1,
    description: 'Pembelian material darurat',
    items: [{ item_name: 'Kabel drop', quantity: 2, unit: 'roll', unit_price: 150_000 }],
    doc_path: '/uploads/docs/nota-material.jpg',
    doc_sha256: 'aabbccdd11223344',
  };

  for (const invalidSize of [NaN, 0, -10, 2049, 4096]) {
    const res = submitFundRequest(INITIAL_SERPO_STATE, {
      ...basePayload,
      doc_size_kb: invalidSize,
      client_uuid: `fr-invalid-${String(invalidSize)}`,
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.errorCode, 'LAMPIRAN_WAJIB');
  }

  for (const validSize of [120, 500, 1024, 1536, 2048]) {
    const res = submitFundRequest(INITIAL_SERPO_STATE, {
      ...basePayload,
      doc_size_kb: validSize,
      client_uuid: `fr-valid-${validSize}`,
    });
    assert.equal(res.statusCode, 201);
    const savedDoc = res.state.attachments.find(
      (a) => a.purpose === 'REQUEST_DOCUMENT' && a.ref_id === res.fundRequest?.id
    );
    assert.equal(savedDoc?.file_size_kb, validSize);
  }
});
