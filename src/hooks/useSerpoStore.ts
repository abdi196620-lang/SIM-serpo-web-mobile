import { useEffect, useMemo, useState } from 'react';
import { DEMO_MODE } from '../config';
import { INITIAL_SERPO_STATE } from '../data/seedData';
import {
  ActiveSessionContext,
  PlatformMode,
  RouteId,
  SerpoState,
  TicketPriority,
  TicketStatus,
} from '../types/serpo';
import {
  addBudgetAllocation,
  addDaysIso,
  applyCorrectionDecision,
  authenticateUser,
  canLoginToPlatform,
  decideFundRequest,
  flushOfflineOutboxFIFO,
  formatDateShortId,
  formatTimeWita,
  generateUniqueId,
  getPendingApprovalsForUser,
  getUserBasecampAndArea,
  getUserRole,
  getUserStorageKeyForPlatform,
  ingestLocationPings,
  isSessionExpired,
  LocationPingInput,
  markAllNotificationsRead,
  markNotificationRead,
  parseStoredSerpoState,
  proposeCorrection,
  recordCashLedgerMutation,
  resolveSyncAuditLog,
  restoreActiveUserId,
  runManualReconciliation,
  submitAttendance,
  SubmitAttendanceInput,
  submitFundRequest,
  SubmitFundRequestInput,
  updateBasecampLocation,
  updateBudgetThreshold,
  updateTicketWithHistory,
} from '../utils/serpoLogic';
import {
  can,
  canRecordCashLedger,
  canSubmitAttendance,
  canUpdateBasecampLocation,
  canUpdateTicket,
} from '../utils/permissions';

export const SERPO_STATE_STORAGE_KEY = 'sim_serpo_state_v2';

function loadInitialState(): SerpoState {
  try {
    const raw = localStorage.getItem(SERPO_STATE_STORAGE_KEY);
    return parseStoredSerpoState(raw, INITIAL_SERPO_STATE);
  } catch {
    return INITIAL_SERPO_STATE;
  }
}

export const ROUTE_BREADCRUMB_MAP: Record<RouteId, string> = {
  dashboard: 'Ringkasan Operasional',
  tiket: 'Tiket Operasional',
  rekap_tiket: 'Rekap Tiket & SLA',
  rekap_kehadiran: 'Absensi Teknisi',
  riwayat_absensi: 'Riwayat Absensi',
  peta_langsung: 'Pelacakan Langsung',
  jejak_teknisi: 'Jejak Teknisi',
  anggaran_area: 'Anggaran Area',
  saldo_kas: 'Saldo Kas Basecamp',
  kas_basecamp: 'Detail Kas Basecamp',
  dana_pengajuan: 'Pengajuan Dana',
  antrean_persetujuan: 'Antrean Persetujuan',
  riwayat_keputusan: 'Riwayat Keputusan',
  buku_kas: 'Buku Kas',
  antrean_audit: 'Audit & Antrean Offline',
  temuan_rekonsiliasi: 'Temuan Rekonsiliasi',
  detail_temuan: 'Detail Temuan',
  usulan_koreksi: 'Usulan Koreksi',
  persetujuan_koreksi: 'Persetujuan Koreksi',
  riwayat_run: 'Riwayat Pemeriksaan',
  profil_pengaturan: 'Profil & Penempatan',
};

export function useSerpoStore(platform: PlatformMode) {
  const userStorageKey = getUserStorageKeyForPlatform(platform);
  const defaultAutostartUserId = platform === 'teknisi' ? 201 : 101;

  const [state, setState] = useState<SerpoState>(loadInitialState);
  const [rememberSession, setRememberSession] = useState<boolean>(() => {
    try {
      if (sessionStorage.getItem(userStorageKey) !== null) return false;
    } catch {
      // ignore
    }
    return true;
  });

  const [activeUserId, setActiveUserId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (DEMO_MODE && params.get('autostart') === '1') {
      return defaultAutostartUserId;
    }
    try {
      const fromSession = sessionStorage.getItem(userStorageKey);
      if (fromSession !== null) {
        const restored = restoreActiveUserId(fromSession, state);
        if (restored !== null) {
          const u = state.users.find((x) => x.id === restored);
          const r = u ? getUserRole(state, u) : null;
          if (r && canLoginToPlatform(r.code, platform).allowed) {
            return restored;
          }
        }
        return null;
      }
      const fromLocal = localStorage.getItem(userStorageKey);
      const restored = restoreActiveUserId(fromLocal, state);
      if (restored !== null) {
        const u = state.users.find((x) => x.id === restored);
        const r = u ? getUserRole(state, u) : null;
        if (r && canLoginToPlatform(r.code, platform).allowed) {
          return restored;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeRoute, setActiveRoute] = useState<RouteId>('dashboard');
  const [routeContextId, setRouteContextId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SERPO_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Live cross-app synchronization when Desktop Backoffice & Android Teknisi run in parallel tabs/windows
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SERPO_STATE_STORAGE_KEY || !event.newValue) return;
      const incoming = parseStoredSerpoState(event.newValue, INITIAL_SERPO_STATE);
      setState(incoming);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeUserId, activeRoute]);

  useEffect(() => {
    try {
      if (activeUserId !== null) {
        if (rememberSession) {
          localStorage.setItem(userStorageKey, String(activeUserId));
          sessionStorage.removeItem(userStorageKey);
        } else {
          sessionStorage.setItem(userStorageKey, String(activeUserId));
          localStorage.removeItem(userStorageKey);
        }
      } else {
        localStorage.removeItem(userStorageKey);
        sessionStorage.removeItem(userStorageKey);
      }
    } catch {
      // ignore
    }
  }, [activeUserId, rememberSession, userStorageKey]);

  const session: ActiveSessionContext | null = useMemo(() => {
    if (activeUserId === null) return null;
    const user = state.users.find((u) => u.id === activeUserId);
    if (!user || user.status !== 'ACTIVE') return null;
    const role = getUserRole(state, user);
    if (!role || !canLoginToPlatform(role.code, platform).allowed) return null;
    const technicianProfile =
      state.technicianProfiles.find((tp) => tp.user_id === user.id) ?? null;
    if (technicianProfile?.deactivated_at) return null;

    const validSession = state.authSessions.find(
      (s) => s.user_id === user.id && !isSessionExpired(s, state.serverNowIso)
    );
    const params = new URLSearchParams(window.location.search);
    const isDemoAutostart = DEMO_MODE && params.get('autostart') === '1';
    const hasAnyUserSession = state.authSessions.some((s) => s.user_id === user.id);

    const authSession =
      validSession ??
      (isDemoAutostart && !hasAnyUserSession
        ? {
            id: 0,
            user_id: user.id,
            refresh_token_hash: '',
            device_name: platform === 'teknisi' ? 'Aplikasi Teknisi Android' : 'Web Browser',
            created_at: state.serverNowIso,
            expires_at: addDaysIso(state.serverNowIso, 7),
            ended_at: null,
          }
        : null);

    if (!authSession) return null;

    const { placement, basecamp, area, attendanceLocation } = getUserBasecampAndArea(state, user.id);
    return {
      session: authSession,
      user,
      role,
      placement,
      basecamp,
      area,
      attendanceLocation,
      technicianProfile,
      access_token: `jwt.${role.code.toLowerCase()}.${user.id}`,
    };
  }, [activeUserId, platform, state]);

  const pendingApprovalCount = useMemo(() => {
    if (!session) return 0;
    return getPendingApprovalsForUser(state, session.user.id).length;
  }, [state, session]);

  const unresolvedAuditCount = useMemo(
    () =>
      state.syncAuditLogs.filter((l) => {
        if (session?.role.code === 'TEKNISI' && l.user_id !== session.user.id) {
          return false;
        }
        return l.outcome === 'ACCEPTED_FLAGGED' && l.resolution_status === 'UNRESOLVED';
      }).length,
    [state.syncAuditLogs, session]
  );

  const openFindingsCount = useMemo(
    () => state.findings.filter((f) => f.status === 'Terbuka').length,
    [state.findings]
  );

  const outboxCount = useMemo(
    () =>
      state.offlineOutbox.filter((o) => {
        if (session?.role.code === 'TEKNISI' && o.user_id !== session.user.id) {
          return false;
        }
        return o.status !== 'SYNCED';
      }).length,
    [state.offlineOutbox, session]
  );

  const unreadNotificationsCount = useMemo(() => {
    if (!session) return 0;
    return state.notifications.filter((n) => n.user_id === session.user.id && !n.is_read).length;
  }, [state.notifications, session]);

  const myNotifications = useMemo(() => {
    if (!session) return [];
    return state.notifications
      .filter((n) => n.user_id === session.user.id)
      .sort((a, b) => (a.is_read === b.is_read ? 0 : a.is_read ? 1 : -1));
  }, [state.notifications, session]);

  const handleNavigate = (route: RouteId, contextId?: string) => {
    setActiveRoute(route);
    setRouteContextId(contextId ?? null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthenticate = (
    email: string,
    password: string,
    deviceName: string,
    rememberMe: boolean
  ) => {
    const res = authenticateUser(state, email, password, deviceName);
    if (res.statusCode === 200 && res.user && res.role) {
      const gate = canLoginToPlatform(res.role.code, platform);
      if (!gate.allowed) {
        return { statusCode: 403 as const, error: gate.error };
      }
      setRememberSession(rememberMe);
      setState(res.state);
      setActiveUserId(res.user.id);
      setActiveRoute('dashboard');
      return { statusCode: 200 as const };
    }
    return { statusCode: res.statusCode, error: res.error };
  };

  const handleLogout = () => {
    if (!session) return;
    setState((prev) => ({
      ...prev,
      authSessions: prev.authSessions.map((s) =>
        s.user_id === session.user.id && !s.ended_at
          ? { ...s, ended_at: prev.serverNowIso }
          : s
      ),
    }));
    try {
      localStorage.removeItem(userStorageKey);
      sessionStorage.removeItem(userStorageKey);
    } catch {
      // ignore
    }
    setActiveUserId(null);
    setActiveRoute('dashboard');
  };

  const handleToggleNetwork = () => {
    if (!DEMO_MODE) return;
    setState((prev) => ({ ...prev, networkOnline: !prev.networkOnline }));
  };

  const handleUpdateBudgetThreshold = (
    budgetId: number,
    thresholdPct: number
  ): { error?: string } => {
    if (!session || !can(session.role.code, 'budget.setThreshold')) {
      return {
        error: 'Akses ditolak: hanya Finance atau Management yang dapat mengubah ambang alert anggaran.',
      };
    }
    const res = updateBudgetThreshold(state, budgetId, thresholdPct);
    if (res.error) return { error: res.error };
    setState(res.state);
    return {};
  };

  const handleAddBudgetAllocation = (
    budgetId: number,
    extraAmount: number
  ): { error?: string } => {
    if (!session || !can(session.role.code, 'budget.addAllocation')) {
      return {
        error: 'Akses ditolak: hanya Finance atau Management yang dapat menambah alokasi anggaran.',
      };
    }
    const res = addBudgetAllocation(state, budgetId, extraAmount);
    if (res.error) return { error: res.error };
    setState(res.state);
    return {};
  };

  const handleMarkNotificationRead = (notificationId: number) => {
    setState((prev) => markNotificationRead(prev, notificationId));
  };

  const handleMarkAllNotificationsRead = (userId: number) => {
    setState((prev) => markAllNotificationsRead(prev, userId));
  };

  const handleUpdateTicket = (
    ticketId: number,
    patch: { status?: TicketStatus; assigned_to?: number | null; priority?: TicketPriority; note?: string }
  ): { error?: string } => {
    if (!session) return { error: 'Sesi login tidak aktif.' };
    const target = state.tickets.find((t) => t.id === ticketId);
    if (!target) {
      return { error: 'Tiket tidak ditemukan.' };
    }
    const perm = canUpdateTicket(session.role.code, session.user.id, target, patch);
    if (!perm.allowed) {
      return { error: perm.reason ?? 'Akses ditolak untuk memperbarui tiket.' };
    }
    const res = updateTicketWithHistory(state, ticketId, session.user.id, patch);
    if (res.error) {
      return { error: res.error };
    }
    setState(res.state);
    return {};
  };

  const handleSubmitAttendance = (input: SubmitAttendanceInput) => {
    if (!session) {
      return {
        statusCode: 403 as const,
        errorCode: 'TIDAK_BERHAK',
        error: 'Sesi login tidak aktif.',
        state,
      };
    }
    const perm = canSubmitAttendance(session.role.code, session.user.id, input.userId);
    if (!perm.allowed) {
      return {
        statusCode: 403 as const,
        errorCode: 'TIDAK_BERHAK',
        error: perm.reason ?? 'Akses ditolak untuk mencatat absensi.',
        state,
      };
    }
    const res = submitAttendance(state, input);
    if (res.state !== state) {
      setState(res.state);
    }
    return res;
  };

  const handleRecordLocationAccess = (technicianUserId: number, date: string) => {
    if (!session) return;
    const tech = state.users.find((u) => u.id === technicianUserId);
    if (!tech) return;
    setState((prev) => {
      const latest = prev.locationAccessLogs[0];
      if (
        latest &&
        latest.viewer_user_id === session.user.id &&
        latest.technician_user_id === technicianUserId &&
        latest.date === date
      ) {
        return prev;
      }
      return {
        ...prev,
        locationAccessLogs: [
          {
            id: generateUniqueId('LOG'),
            viewer_user_id: session.user.id,
            viewer_name: session.user.full_name,
            viewer_role: session.role.name,
            technician_user_id: technicianUserId,
            technician_name: tech.full_name,
            date,
            accessed_at: `${formatTimeWita(prev.serverNowIso)} WITA`,
          },
          ...prev.locationAccessLogs,
        ],
      };
    });
  };

  const handleIngestPings = (pings: LocationPingInput[]) => {
    const safePings =
      session?.role.code === 'TEKNISI'
        ? pings.filter((p) => p.user_id === session.user.id)
        : pings;
    const res = ingestLocationPings(state, safePings);
    setState(res.state);
    return res;
  };

  const handleSubmitFundRequest = (input: SubmitFundRequestInput) => {
    const res = submitFundRequest(state, input);
    if (res.state !== state) {
      setState(res.state);
    }
    return res;
  };

  const handleDecideFundRequest = (
    fundRequestId: number,
    decision: 'SETUJUI' | 'TOLAK',
    note?: string
  ) => {
    if (!session) return decideFundRequest(state, fundRequestId, 0, decision, note);
    const res = decideFundRequest(state, fundRequestId, session.user.id, decision, note);
    if (res.state !== state) {
      setState(res.state);
    }
    return res;
  };

  const handleRecordCashLedger = (payload: {
    basecampId: number;
    transactionType: 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
    amount: number;
    description: string;
    referenceNo: string;
  }): { error?: string } => {
    if (!session) return { error: 'Sesi login tidak aktif.' };
    const perm = canRecordCashLedger(
      session.role.code,
      payload.transactionType,
      payload.basecampId,
      session.basecamp?.id ?? null
    );
    if (!perm.allowed) {
      return { error: perm.reason ?? 'Akses ditolak untuk mencatat mutasi kas.' };
    }
    const res = recordCashLedgerMutation(state, session.user.id, payload);
    if (res.error) {
      return { error: res.error };
    }
    setState(res.state);
    return {};
  };

  const handleFlushOfflineOutbox = () => {
    const res = flushOfflineOutboxFIFO(state);
    setState(res.state);
    return { processed: res.processed, failed: res.failed };
  };

  const handleResolveSyncAuditLog = (
    auditLogId: number,
    resolution: 'CONFIRMED' | 'REJECTED',
    note: string
  ) => {
    if (!session) return;
    setState((prev) => resolveSyncAuditLog(prev, auditLogId, resolution, session.user.id, note));
  };

  const handleProposeCorrection = (payload: {
    findingId: string;
    type: 'REPAIR' | 'ADJUSTMENT';
    basecampId?: number;
    cashDelta: number;
    realizationDelta: number;
    reason: string;
  }): { error?: string } => {
    if (!session || !can(session.role.code, 'correction.propose')) {
      return { error: 'Akses ditolak: hanya Finance yang berhak mengusulkan koreksi rekonsiliasi.' };
    }
    const res = proposeCorrection(
      state,
      { id: session.user.id, fullName: session.user.full_name, roleName: session.role.name },
      payload
    );
    if (res.error) {
      return { error: res.error };
    }
    setState(res.state);
    return {};
  };

  const handleMarkFalsePositive = (findingId: string, reason: string): { error?: string } => {
    if (!session || !can(session.role.code, 'finding.markFalsePositive')) {
      return { error: 'Akses ditolak: hanya Finance yang berhak menandai temuan sebagai false positive.' };
    }
    if (!reason.trim()) {
      return { error: 'Catatan alasan false positive wajib diisi.' };
    }
    setState((prev) => ({
      ...prev,
      findings: prev.findings.map((f) =>
        f.id === findingId
          ? {
              ...f,
              status: 'False positive',
              falsePositiveReason: reason.trim(),
              detectionHistory: [
                {
                  runLabel: `${formatDateShortId(prev.serverNowIso)}, ${formatTimeWita(prev.serverNowIso)}`,
                  note: `Ditandai false positive oleh ${session.user.full_name}`,
                },
                ...f.detectionHistory,
              ],
            }
          : f
      ),
    }));
    return {};
  };

  const handleCorrectionDecision = (
    correctionId: string,
    action: 'approve' | 'reject',
    note?: string
  ) => {
    if (!session) return { error: 'Sesi login tidak aktif.' };
    const res = applyCorrectionDecision(
      state,
      correctionId,
      action,
      session.user.id,
      session.user.full_name,
      session.role.code,
      note
    );
    if (!res.error) {
      setState(res.state);
    }
    return { error: res.error };
  };

  const handleRunManualReconciliation = (): { error?: string } => {
    if (!session || !can(session.role.code, 'recon.runManual')) {
      return { error: 'Akses ditolak: hanya Finance yang berhak menjalankan rekonsiliasi manual.' };
    }
    const startMs = performance.now();
    const res = runManualReconciliation(
      state,
      session.user.full_name,
      Math.max(1, performance.now() - startMs)
    );
    setState(res.state);
    return {};
  };

  const handleUpdateBasecampLocation = (
    basecampId: number,
    payload: { lat: number; lng: number; radius?: number; name?: string }
  ): { error?: string } => {
    if (!session) return { error: 'Sesi login tidak aktif.' };
    const perm = canUpdateBasecampLocation(
      session.role.code,
      basecampId,
      session.basecamp?.id ?? null
    );
    if (!perm.allowed) {
      return { error: perm.reason ?? 'Akses ditolak untuk mengubah lokasi basecamp.' };
    }
    const res = updateBasecampLocation(state, basecampId, payload);
    if (res.error) return { error: res.error };
    setState(res.state);
    return {};
  };

  const handleResetDemoData = (): { error?: string } => {
    if (!session || !DEMO_MODE || !can(session.role.code, 'demo.reset')) {
      return { error: 'Akses ditolak: hanya Management dalam DEMO_MODE yang dapat mereset data.' };
    }
    setState(INITIAL_SERPO_STATE);
    return {};
  };

  return {
    state,
    session,
    activeRoute,
    routeContextId,
    pendingApprovalCount,
    unresolvedAuditCount,
    openFindingsCount,
    outboxCount,
    unreadNotificationsCount,
    myNotifications,
    handleNavigate,
    handleAuthenticate,
    handleLogout,
    handleToggleNetwork,
    handleUpdateBudgetThreshold,
    handleAddBudgetAllocation,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleUpdateTicket,
    handleSubmitAttendance,
    handleRecordLocationAccess,
    handleIngestPings,
    handleUpdateBasecampLocation,
    handleSubmitFundRequest,
    handleDecideFundRequest,
    handleRecordCashLedger,
    handleFlushOfflineOutbox,
    handleResolveSyncAuditLog,
    handleProposeCorrection,
    handleMarkFalsePositive,
    handleCorrectionDecision,
    handleRunManualReconciliation,
    handleResetDemoData,
  };
}
