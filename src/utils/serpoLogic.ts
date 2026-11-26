import { SERPO_SCHEMA_VERSION } from '../config';
import {
  AppNotification,
  Area,
  Attendance,
  AttendanceLocation,
  AuthSession,
  Basecamp,
  Budget,
  CashLedger,
  CorrectionProposal,
  FundRequest,
  FundRequestApproval,
  FundRequestItem,
  LedgerDirection,
  LocationTrack,
  OfflineOutboxItem,
  PlatformMode,
  ReconciliationFinding,
  ReconciliationRun,
  Role,
  RoleCode,
  SerpoState,
  SyncAgeFlag,
  SyncAuditLog,
  SyncOutcome,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketStatusHistory,
  User,
  UserPlacement,
} from '../types/serpo';
import {
  formatFileSizeKb,
  MAX_FUND_DOC_SIZE_KB,
  validateFundDocumentSizeKb,
} from './fileUpload';

export { formatFileSizeKb, MAX_FUND_DOC_SIZE_KB };

export const MIN_CASH_LEDGER_AMOUNT = 1_000;
export const MIN_BUDGET_ALLOCATION_AMOUNT = 500_000;

let fallbackIdCounter = 0;

export function generateUniqueId(prefix = ''): string {
  const randomUuid =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : (() => {
          fallbackIdCounter += 1;
          return `id-${fallbackIdCounter.toString(36).padStart(8, '0')}`;
        })();
  return prefix ? `${prefix}-${randomUuid}` : randomUuid;
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

export function formatRupiah(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return amount < 0 ? `−Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatNumberId(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return amount < 0 ? `−${formatted}` : formatted;
}

export function formatJuta(amount: number, decimals = 1): string {
  const val = amount / 1_000_000;
  return val.toFixed(decimals).replace('.', ',');
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatTimeWita(iso: string | null): string {
  if (!iso) return '—';
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return iso;
  return `${match[1]}.${match[2]}`;
}

export function formatDateShortId(iso: string): string {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthIdx = Number(m) - 1;
  return `${Number(d)} ${months[monthIdx] ?? m} ${y}`;
}

export function formatAttendanceDayLabel(dateStr: string): { weekday: string; dateLabel: string } {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) {
    return { weekday: '', dateLabel: dateStr };
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return {
    weekday: weekdays[dt.getUTCDay()] ?? '',
    dateLabel: `${d} ${months[m - 1] ?? m}`,
  };
}

export function getAttendanceTypeLabel(attendanceType?: string): string {
  switch (attendanceType) {
    case 'DINAS_LUAR':
      return 'Dinas Luar';
    case 'LEMBUR':
      return 'Lembur';
    case 'SHIFT_PAGI':
      return 'Shift Pagi';
    default:
      return 'Reguler';
  }
}

export function formatRunTimestamp(iso: string): string {
  const datePart = iso.slice(0, 10);
  const [, m, d] = datePart.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthIdx = Number(m) - 1;
  return `${Number(d)} ${months[monthIdx] ?? m} ${formatTimeWita(iso)}`;
}

export function formatDurationMs(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 1;
  if (safeMs < 1000) {
    return `${Math.max(1, Math.round(safeMs))} ms`;
  }
  const totalSeconds = Math.round(safeMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds} dtk`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins} mnt ${secs} dtk`;
}

function shiftIsoByMs(iso: string, deltaMs: number): string {
  const parsedMs = new Date(iso).getTime();
  if (!Number.isFinite(parsedMs)) return iso;
  const offsetMatch = iso.match(/([+-])(\d{2}):(\d{2})$/);
  let offsetMinutes = 0;
  let suffix = 'Z';
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
    suffix = offsetMatch[0];
  } else if (!iso.endsWith('Z')) {
    suffix = '+08:00';
    offsetMinutes = 8 * 60;
  }
  const wallDate = new Date(parsedMs + deltaMs + offsetMinutes * 60_000);
  const yyyy = wallDate.getUTCFullYear();
  const mm = String(wallDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wallDate.getUTCDate()).padStart(2, '0');
  const hh = String(wallDate.getUTCHours()).padStart(2, '0');
  const min = String(wallDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(wallDate.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${suffix}`;
}

export function addDaysIso(iso: string, days: number): string {
  return shiftIsoByMs(iso, days * 86_400_000);
}

export function addMinutesIso(iso: string, minutes: number): string {
  return shiftIsoByMs(iso, minutes * 60_000);
}

export function isSessionExpired(
  session: Pick<AuthSession, 'expires_at' | 'ended_at'>,
  nowIso: string
): boolean {
  if (session.ended_at) return true;
  const expiresMs = new Date(session.expires_at).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs)) return true;
  return expiresMs <= nowMs;
}

export function restoreActiveUserId(stored: string | null, state: SerpoState): number | null {
  if (!stored) return null;
  const num = Number(stored);
  if (!Number.isInteger(num) || num <= 0) return null;
  const user = state.users.find((u) => u.id === num);
  if (!user || user.status !== 'ACTIVE') return null;
  const techProfile = state.technicianProfiles.find((tp) => tp.user_id === num);
  if (techProfile && techProfile.deactivated_at) return null;
  const hasValidSession = state.authSessions.some(
    (s) => s.user_id === num && !isSessionExpired(s, state.serverNowIso)
  );
  return hasValidSession ? num : null;
}

const SERPO_STATE_ARRAY_KEYS: readonly (keyof SerpoState)[] = [
  'roles',
  'users',
  'authProviders',
  'authSessions',
  'userTokens',
  'technicianProfiles',
  'areas',
  'attendanceLocations',
  'basecamps',
  'userPlacements',
  'budgets',
  'basecampCashBalances',
  'cashLedgers',
  'approvalFlows',
  'approvalFlowSteps',
  'fundRequests',
  'fundRequestItems',
  'fundRequestApprovals',
  'attachments',
  'tickets',
  'ticketStatusHistory',
  'attendances',
  'locationTracks',
  'syncAuditLogs',
  'offlineOutbox',
  'notifications',
  'locationAccessLogs',
  'findings',
  'corrections',
  'reconciliationRuns',
];

export function parseStoredSerpoState(raw: string | null, fallbackState: SerpoState): SerpoState {
  if (!raw) return fallbackState;
  try {
    const parsed = JSON.parse(raw) as Partial<SerpoState> | null;
    if (!parsed || typeof parsed !== 'object') return fallbackState;
    if (parsed.schemaVersion !== SERPO_SCHEMA_VERSION) return fallbackState;
    if (typeof parsed.currentDate !== 'string' || !parsed.currentDate) return fallbackState;
    if (
      typeof parsed.serverNowIso !== 'string' ||
      !Number.isFinite(new Date(parsed.serverNowIso).getTime())
    ) {
      return fallbackState;
    }
    if (typeof parsed.networkOnline !== 'boolean') return fallbackState;
    if (
      typeof parsed.trackingMaxToleranceMinutes !== 'number' ||
      !Number.isFinite(parsed.trackingMaxToleranceMinutes)
    ) {
      return fallbackState;
    }
    if (typeof parsed.offlineMaxRetry !== 'number' || !Number.isFinite(parsed.offlineMaxRetry)) {
      return fallbackState;
    }
    for (const key of SERPO_STATE_ARRAY_KEYS) {
      if (!Array.isArray(parsed[key])) {
        return fallbackState;
      }
    }
    return parsed as SerpoState;
  } catch {
    return fallbackState;
  }
}

export function generateSequentialLedgerRef(
  cashLedgers: CashLedger[],
  type: 'TOP_UP' | 'EXPENSE' | 'REFUND' | 'ADJUSTMENT',
  serverNowIso: string
): string {
  const yy = serverNowIso.slice(2, 4) || '26';
  const mm = serverNowIso.slice(5, 7) || '11';
  const yymm = `${yy}${mm}`;
  const prefix =
    type === 'EXPENSE' ? 'EXP' : type === 'REFUND' ? 'REF' : type === 'TOP_UP' ? 'TOP' : 'ADJ';
  const pattern = new RegExp(`^${prefix}-${yymm}-(\\d+)$`);
  let maxSeq = 0;
  for (const ledger of cashLedgers) {
    const match = ledger.reference_no.match(pattern);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return `${prefix}-${yymm}-${String(maxSeq + 1).padStart(4, '0')}`;
}

export function buildCsvContent(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}

// ---------------------------------------------------------------------------
// Relational Lookup Helpers (ERD joins)
// ---------------------------------------------------------------------------

export function getUserRole(state: SerpoState, user: User): Role | undefined {
  return state.roles.find((r) => r.id === user.role_id);
}

export function getCurrentPlacement(state: SerpoState, userId: number): UserPlacement | undefined {
  return state.userPlacements.find((p) => p.user_id === userId && p.is_current);
}

export function getUserBasecampAndArea(
  state: SerpoState,
  userId: number
): { placement: UserPlacement | null; basecamp: Basecamp | null; area: Area | null; attendanceLocation: AttendanceLocation | null } {
  const placement = getCurrentPlacement(state, userId) ?? null;
  const basecamp = placement ? state.basecamps.find((b) => b.id === placement.basecamp_id) ?? null : null;
  const area = basecamp ? state.areas.find((a) => a.id === basecamp.area_id) ?? null : null;
  const attendanceLocation = basecamp
    ? state.attendanceLocations.find((l) => l.attendance_location_id === basecamp.attendance_location_id) ?? null
    : null;
  return { placement, basecamp, area, attendanceLocation };
}

export function getBasecampBalance(state: SerpoState, basecampId: number): number {
  return state.basecampCashBalances.find((b) => b.basecamp_id === basecampId)?.current_balance ?? 0;
}

export function getActiveAreaBudget(state: SerpoState, areaId: number, dateStr = state.currentDate): Budget | undefined {
  return state.budgets.find(
    (b) => b.area_id === areaId && b.start_date <= dateStr && dateStr <= b.end_date
  );
}

export function getBudgetAbsorptionPct(realizedAmount: number, allocatedAmount: number): number {
  if (allocatedAmount <= 0) return 0;
  return Math.round((realizedAmount / allocatedAmount) * 1000) / 10;
}

export function getAreaBudgetStatus(budget: Budget): 'ALERT' | 'NORMAL' {
  const ratio = budget.allocated_amount > 0 ? (budget.realized_amount / budget.allocated_amount) * 100 : 0;
  // Strictly > alert_threshold per Diagram 7 ("Rasio > alert_threshold? (default 90%)")
  return ratio > budget.alert_threshold ? 'ALERT' : 'NORMAL';
}

// ---------------------------------------------------------------------------
// Diagram 1: Autentikasi — Login & Inisialisasi Sesi
// ---------------------------------------------------------------------------

export interface AuthLoginResult {
  statusCode: 200 | 401 | 403;
  error?: string;
  state: SerpoState;
  session?: AuthSession;
  user?: User;
  role?: Role;
  access_token?: string;
  placement?: UserPlacement | null;
  basecamp?: Basecamp | null;
  area?: Area | null;
  attendanceLocation?: AttendanceLocation | null;
}

export function authenticateUser(
  state: SerpoState,
  email: string,
  password: string,
  deviceName = 'Web Browser · Backoffice'
): AuthLoginResult {
  const normalizedEmail = email.trim().toLowerCase();
  const user = state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  const provider = user
    ? state.authProviders.find((ap) => ap.user_id === user.id && ap.provider === 'local')
    : undefined;

  // Generic 401 before checking inactive status so registered emails cannot be enumerated (Diagram 1 design note)
  if (!user || !provider || provider.password_hash !== password) {
    return {
      statusCode: 401,
      error: '401 Kredensial salah — periksa kembali email dan kata sandi Anda.',
      state,
    };
  }

  const techProfile = state.technicianProfiles.find((tp) => tp.user_id === user.id);
  const isTechnicianDeactivated = Boolean(techProfile && techProfile.deactivated_at);
  if (user.status !== 'ACTIVE' || isTechnicianDeactivated) {
    return {
      statusCode: 403,
      error: '403 Akun nonaktif — hubungi Admin Sistem untuk mengaktifkan kembali akun.',
      state,
    };
  }

  const role = getUserRole(state, user)!;
  const { placement, basecamp, area, attendanceLocation } = getUserBasecampAndArea(state, user.id);

  const nextSessionId = Math.max(0, ...state.authSessions.map((s) => s.id)) + 1;
  const newSession: AuthSession = {
    id: nextSessionId,
    user_id: user.id,
    refresh_token_hash: `sha256:${user.id}-${generateUniqueId('tok')}`,
    device_name: deviceName.trim() || 'Web Browser',
    created_at: state.serverNowIso,
    expires_at: addDaysIso(state.serverNowIso, 7),
    ended_at: null,
  };

  const nextState: SerpoState = {
    ...state,
    authSessions: [newSession, ...state.authSessions],
  };

  return {
    statusCode: 200,
    state: nextState,
    session: newSession,
    user,
    role,
    access_token: `jwt.${role.code.toLowerCase()}.${user.id}.${nextSessionId}`,
    placement,
    basecamp,
    area,
    attendanceLocation,
  };
}

// ---------------------------------------------------------------------------
// Diagram 2: Absensi Teknisi — Clock-in / Clock-out
// ---------------------------------------------------------------------------

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface SubmitAttendanceInput {
  userId: number;
  aksi: 'CHECK_IN' | 'CHECK_OUT';
  attendance_type?: 'REGULER' | 'DINAS_LUAR' | 'LEMBUR';
  lat: number;
  lng: number;
  accuracy: number;
  is_mock: boolean;
  client_uuid: string;
  selfie_path: string;
  selfie_sha256: string;
  selfie_size_kb: number;
  client_created_at?: string;
  forceOffline?: boolean;
}

export interface SubmitAttendanceResult {
  statusCode: 200 | 201 | 202 | 403 | 409 | 422;
  errorCode?: string;
  error?: string;
  queuedOffline?: boolean;
  attendance?: Attendance;
  distanceMeters?: number;
  state: SerpoState;
}

export function submitAttendance(
  state: SerpoState,
  input: SubmitAttendanceInput
): SubmitAttendanceResult {
  if (input.selfie_size_kb <= 0 || input.selfie_size_kb > 200 || !input.selfie_sha256.trim()) {
    return {
      statusCode: 422,
      errorCode: 'SELFIE_TIDAK_VALID',
      error: '422 SELFIE_TIDAK_VALID — Selfie wajib terkompres ≤ 200 KB dengan checksum SHA-256.',
      state,
    };
  }

  const resolvedType = input.attendance_type ?? 'REGULER';

  // Offline queueing branch (Diagram 2 -> Diagram 6)
  if (input.forceOffline || !state.networkOnline) {
    const user = state.users.find((u) => u.id === input.userId);
    const { basecamp } = getUserBasecampAndArea(state, input.userId);
    const aksiLabel =
      resolvedType === 'DINAS_LUAR'
        ? 'Dinas Luar'
        : resolvedType === 'LEMBUR'
        ? 'Lembur'
        : input.aksi === 'CHECK_IN'
        ? 'Absen Masuk'
        : 'Absen Pulang';
    const outboxItem: OfflineOutboxItem = {
      client_uuid: input.client_uuid,
      user_id: input.userId,
      entity_type: 'ATTENDANCE',
      action_label: `${aksiLabel} ${user?.full_name ?? input.userId} · ${basecamp?.name ?? 'Basecamp'}`,
      client_created_at: input.client_created_at ?? state.serverNowIso,
      status: 'PENDING',
      retry_count: 0,
      payload: {
        kind: 'ATTENDANCE',
        aksi: input.aksi,
        attendance_type: resolvedType,
        work_date: state.currentDate,
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy,
        is_mock: input.is_mock,
        selfie_path: input.selfie_path,
        selfie_sha256: input.selfie_sha256,
        selfie_size_kb: input.selfie_size_kb,
      },
    };
    return {
      statusCode: 202,
      queuedOffline: true,
      state: {
        ...state,
        offlineOutbox: [...state.offlineOutbox, outboxItem],
      },
    };
  }

  // Online validation on server
  const { placement, attendanceLocation } = getUserBasecampAndArea(state, input.userId);
  if (!placement || !attendanceLocation) {
    return {
      statusCode: 422,
      errorCode: 'PENEMPATAN_BELUM_ADA',
      error: '422 PENEMPATAN_BELUM_ADA — Pengguna belum memiliki penempatan basecamp aktif.',
      state,
    };
  }

  if (input.is_mock) {
    return {
      statusCode: 422,
      errorCode: 'MOCK_LOCATION',
      error: '422 MOCK_LOCATION — Lokasi palsu (fake GPS) terdeteksi dan ditolak oleh server.',
      state,
    };
  }

  const distanceMeters = haversineMeters(
    input.lat,
    input.lng,
    attendanceLocation.lat,
    attendanceLocation.lng
  );
  if (distanceMeters > attendanceLocation.radius) {
    return {
      statusCode: 422,
      errorCode: 'DI_LUAR_AREA',
      error: `422 DI_LUAR_AREA — Jarak ${distanceMeters} m melebihi batas geofence ${attendanceLocation.radius} m.`,
      distanceMeters,
      state,
    };
  }
  if (!Number.isFinite(input.accuracy) || input.accuracy <= 0 || input.accuracy > 50) {
    return {
      statusCode: 422,
      errorCode: 'AKURASI_BURUK',
      error: `422 AKURASI_BURUK — Akurasi GPS ${input.accuracy} m melebihi batas maksimal 50 m.`,
      distanceMeters,
      state,
    };
  }

  const existingToday = state.attendances.find(
    (a) => a.user_id === input.userId && a.work_date === state.currentDate
  );

  if (input.aksi === 'CHECK_IN') {
    if (existingToday) {
      return {
        statusCode: 409,
        errorCode: 'SUDAH_ABSEN',
        error: '409 SUDAH_ABSEN — Sudah terdapat data absensi untuk tanggal kerja hari ini.',
        state,
      };
    }

    const nextId = Math.max(0, ...state.attendances.map((a) => a.id)) + 1;
    const newAttendance: Attendance = {
      id: nextId,
      user_id: input.userId,
      work_date: state.currentDate,
      check_in_time: state.serverNowIso,
      check_in_lat: input.lat,
      check_in_lng: input.lng,
      check_in_accuracy: input.accuracy,
      check_in_is_mock: false,
      check_out_time: null,
      check_out_lat: null,
      check_out_lng: null,
      check_out_accuracy: null,
      check_out_is_mock: null,
      attendance_location_id: attendanceLocation.attendance_location_id,
      attendance_type: resolvedType,
      source: 'ONLINE',
      verification_status: 'VERIFIED',
    };
    const nextAttId = Math.max(0, ...state.attachments.map((at) => at.id)) + 1;

    return {
      statusCode: 201,
      attendance: newAttendance,
      distanceMeters,
      state: {
        ...state,
        attendances: [newAttendance, ...state.attendances],
        attachments: [
          ...state.attachments,
          {
            id: nextAttId,
            purpose: 'CHECKIN_SELFIE',
            ref_id: newAttendance.id,
            file_path: input.selfie_path,
            checksum_sha256: input.selfie_sha256,
            file_size_kb: input.selfie_size_kb,
          },
        ],
      },
    };
  }

  // CHECK_OUT
  if (!existingToday) {
    return {
      statusCode: 409,
      errorCode: 'BELUM_CHECK_IN',
      error: '409 BELUM_CHECK_IN — Tidak ada absensi masuk terbuka untuk hari ini.',
      state,
    };
  }
  if (existingToday.check_out_time !== null) {
    return {
      statusCode: 409,
      errorCode: 'SUDAH_CHECK_OUT',
      error: '409 SUDAH_CHECK_OUT — Absensi hari ini sudah ditutup (check-out tercatat).',
      state,
    };
  }

  const updatedAttendance: Attendance = {
    ...existingToday,
    check_out_time: state.serverNowIso,
    check_out_lat: input.lat,
    check_out_lng: input.lng,
    check_out_accuracy: input.accuracy,
    check_out_is_mock: false,
  };
  const nextAttId = Math.max(0, ...state.attachments.map((at) => at.id)) + 1;

  return {
    statusCode: 200,
    attendance: updatedAttendance,
    distanceMeters,
    state: {
      ...state,
      attendances: state.attendances.map((a) =>
        a.id === existingToday.id ? updatedAttendance : a
      ),
      attachments: [
        ...state.attachments,
        {
          id: nextAttId,
          purpose: 'CHECKOUT_SELFIE',
          ref_id: existingToday.id,
          file_path: input.selfie_path,
          checksum_sha256: input.selfie_sha256,
          file_size_kb: input.selfie_size_kb,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Diagram 3: Pengajuan Dana Operasional (Top-up Kas Basecamp)
// ---------------------------------------------------------------------------

export interface SubmitFundRequestInput {
  requesterId: number;
  basecampId: number;
  description: string;
  items: { item_name: string; quantity: number; unit: string; unit_price: number }[];
  doc_path: string;
  doc_sha256: string;
  doc_size_kb: number;
  client_uuid: string;
  client_created_at?: string;
  forceOffline?: boolean;
}

export interface SubmitFundRequestResult {
  statusCode: 200 | 201 | 202 | 422;
  errorCode?: string;
  error?: string;
  queuedOffline?: boolean;
  idempotentHit?: boolean;
  fundRequest?: FundRequest;
  state: SerpoState;
}

export function submitFundRequest(
  state: SerpoState,
  input: SubmitFundRequestInput
): SubmitFundRequestResult {
  if (!input.description.trim() || input.items.length === 0) {
    return {
      statusCode: 422,
      errorCode: 'FORM_TIDAK_VALID',
      error: '422 Keterangan dan minimal 1 item rincian wajib diisi.',
      state,
    };
  }

  const normalizedItems = input.items.map((item) => ({
    ...item,
    subtotal: Math.round(item.quantity * item.unit_price),
  }));
  const invalidItem = normalizedItems.find(
    (it) =>
      !it.item_name.trim() ||
      !Number.isFinite(it.quantity) ||
      !Number.isFinite(it.unit_price) ||
      it.quantity <= 0 ||
      it.unit_price <= 0 ||
      !it.unit.trim()
  );
  const totalAmount = normalizedItems.reduce((sum, it) => sum + it.subtotal, 0);
  if (invalidItem || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return {
      statusCode: 422,
      errorCode: 'ITEM_TIDAK_VALID',
      error: '422 Setiap item harus memiliki nama, qty > 0, satuan, dan harga satuan > 0.',
      state,
    };
  }

  if (!input.doc_path.trim() || !input.doc_sha256.trim()) {
    return {
      statusCode: 422,
      errorCode: 'LAMPIRAN_WAJIB',
      error: '422 Lampiran dokumen pendukung (maksimal 2 MB) wajib diunggah.',
      state,
    };
  }

  const docSizeValidation = validateFundDocumentSizeKb(input.doc_size_kb);
  if (!docSizeValidation.valid) {
    return {
      statusCode: 422,
      errorCode: 'LAMPIRAN_WAJIB',
      error: `422 ${docSizeValidation.error}`,
      state,
    };
  }

  // Offline queueing branch (Diagram 3 -> Diagram 6)
  if (input.forceOffline || !state.networkOnline) {
    const bc = state.basecamps.find((b) => b.id === input.basecampId);
    const outboxItem: OfflineOutboxItem = {
      client_uuid: input.client_uuid,
      user_id: input.requesterId,
      entity_type: 'FUND_REQUEST',
      action_label: `Pengajuan Dana ${bc?.name ?? 'Basecamp'} · ${formatRupiah(totalAmount)}`,
      client_created_at: input.client_created_at ?? state.serverNowIso,
      status: 'PENDING',
      retry_count: 0,
      payload: {
        kind: 'FUND_REQUEST',
        basecamp_id: input.basecampId,
        description: input.description.trim(),
        items: input.items,
        doc_path: input.doc_path,
        doc_sha256: input.doc_sha256,
        doc_size_kb: input.doc_size_kb,
      },
    };
    return {
      statusCode: 202,
      queuedOffline: true,
      state: {
        ...state,
        offlineOutbox: [...state.offlineOutbox, outboxItem],
      },
    };
  }

  // Idempotency UNIQUE(requester_id, client_uuid)
  const existing = state.fundRequests.find(
    (fr) => fr.requester_id === input.requesterId && fr.client_uuid === input.client_uuid
  );
  if (existing) {
    return {
      statusCode: 200,
      idempotentHit: true,
      fundRequest: existing,
      state,
    };
  }

  const basecamp = state.basecamps.find((b) => b.id === input.basecampId);
  if (!basecamp) {
    return {
      statusCode: 422,
      errorCode: 'BASECAMP_TIDAK_ADA',
      error: '422 Basecamp tidak ditemukan.',
      state,
    };
  }

  const activeBudget = getActiveAreaBudget(state, basecamp.area_id, state.currentDate);
  if (!activeBudget) {
    return {
      statusCode: 422,
      errorCode: 'TIDAK_ADA_BUDGET_AKTIF',
      error: '422 TIDAK_ADA_BUDGET_AKTIF — Belum ada periode Budgets aktif untuk area ini.',
      state,
    };
  }

  const remainingBudget = activeBudget.allocated_amount - activeBudget.realized_amount;
  if (totalAmount > remainingBudget) {
    return {
      statusCode: 422,
      errorCode: 'BUDGET_TIDAK_CUKUP',
      error: `422 BUDGET_TIDAK_CUKUP — Sisa budget area hanya ${formatRupiah(remainingBudget)} (pengajuan ${formatRupiah(totalAmount)}).`,
      state,
    };
  }

  const flow = state.approvalFlows[0];
  const steps = state.approvalFlowSteps
    .filter((s) => s.flow_id === flow.id)
    .sort((a, b) => a.step_order - b.step_order);

  const nextFrId = Math.max(0, ...state.fundRequests.map((r) => r.id)) + 1;
  const reqNo = `FR-2026-${String(418 + nextFrId).padStart(4, '0')}`;
  const newRequest: FundRequest = {
    id: nextFrId,
    request_no: reqNo,
    requester_id: input.requesterId,
    basecamp_id: basecamp.id,
    budget_id: activeBudget.id,
    flow_id: flow.id,
    status: 'PENDING',
    amount: totalAmount,
    client_uuid: input.client_uuid,
    description: input.description.trim(),
    created_at: state.serverNowIso,
  };

  let nextItemId = Math.max(0, ...state.fundRequestItems.map((i) => i.id)) + 1;
  const newItems: FundRequestItem[] = normalizedItems.map((it) => ({
    id: nextItemId++,
    fund_request_id: nextFrId,
    item_name: it.item_name.trim(),
    quantity: it.quantity,
    unit: it.unit.trim(),
    unit_price: it.unit_price,
    subtotal: it.subtotal,
  }));

  let nextAppId = Math.max(0, ...state.fundRequestApprovals.map((a) => a.id)) + 1;
  const newApprovals: FundRequestApproval[] = steps.map((step, idx) => ({
    id: nextAppId++,
    fund_request_id: nextFrId,
    flow_step_id: step.id,
    approver_user_id: null,
    step_order: step.step_order,
    status: idx === 0 ? 'PENDING' : 'WAITING',
    note: null,
    acted_at: null,
  }));

  const nextAttId = Math.max(0, ...state.attachments.map((at) => at.id)) + 1;
  const newAttachment = {
    id: nextAttId,
    purpose: 'REQUEST_DOCUMENT' as const,
    ref_id: nextFrId,
    file_path: input.doc_path,
    checksum_sha256: input.doc_sha256,
    file_size_kb: input.doc_size_kb,
  };

  const step1 = steps[0];
  const step1Approvers = findApproversForStep(state, step1.approver_role_id, step1.scope, basecamp.area_id);
  const requester = state.users.find((u) => u.id === input.requesterId);
  let nextNotifId = Math.max(0, ...state.notifications.map((n) => n.id)) + 1;
  const stepNotifs: AppNotification[] = step1Approvers
    .filter((u) => u.id !== input.requesterId)
    .map((u) => ({
      id: nextNotifId++,
      user_id: u.id,
      title: `Menunggu persetujuan langkah 1 (${reqNo})`,
      message: `${requester?.full_name ?? 'Pemohon'} mengajukan top-up kas ${basecamp.name} sebesar ${formatRupiah(totalAmount)}.`,
      type: 'FUND_APPROVAL',
      ref_table: 'Fund_Requests',
      ref_id: nextFrId,
      is_read: false,
      dedupe_key: `FR_STEP:${nextFrId}:1`,
      created_at: state.serverNowIso,
    }));

  return {
    statusCode: 201,
    fundRequest: newRequest,
    state: {
      ...state,
      fundRequests: [newRequest, ...state.fundRequests],
      fundRequestItems: [...state.fundRequestItems, ...newItems],
      fundRequestApprovals: [...state.fundRequestApprovals, ...newApprovals],
      attachments: [...state.attachments, newAttachment],
      notifications: insertDedupeNotifications(state.notifications, stepNotifs),
    },
  };
}

// ---------------------------------------------------------------------------
// Diagram 4: Persetujuan Dana Berjenjang (Multi-level Approval)
// ---------------------------------------------------------------------------

function findApproversForStep(
  state: SerpoState,
  approverRoleId: number,
  scope: 'AREA' | 'GLOBAL',
  areaId: number
): User[] {
  return state.users.filter((u) => {
    if (u.status !== 'ACTIVE' || u.role_id !== approverRoleId) return false;
    if (scope === 'GLOBAL') return true;
    const { area } = getUserBasecampAndArea(state, u.id);
    return area?.id === areaId;
  });
}

function insertDedupeNotifications(
  existing: AppNotification[],
  incoming: AppNotification[]
): AppNotification[] {
  const result = [...existing];
  for (const notif of incoming) {
    const exists = result.some(
      (n) => n.user_id === notif.user_id && n.dedupe_key === notif.dedupe_key
    );
    if (!exists) {
      result.unshift(notif);
    }
  }
  return result;
}

export function getActivePendingStep(
  state: SerpoState,
  fundRequestId: number
): FundRequestApproval | undefined {
  return state.fundRequestApprovals.find(
    (a) => a.fund_request_id === fundRequestId && a.status === 'PENDING'
  );
}

export function canUserActOnFundRequest(
  state: SerpoState,
  fundRequestId: number,
  actorUserId: number
): { allowed: boolean; code?: 403 | 409; error?: string; step?: FundRequestApproval } {
  const req = state.fundRequests.find((r) => r.id === fundRequestId);
  const actor = state.users.find((u) => u.id === actorUserId);
  if (!req || !actor) {
    return { allowed: false, code: 403, error: '403 TIDAK_BERHAK' };
  }
  const activeStep = getActivePendingStep(state, fundRequestId);
  if (!activeStep) {
    return {
      allowed: false,
      code: 409,
      error: '409 SUDAH_DIPROSES — Tidak ada langkah PENDING pada pengajuan ini.',
    };
  }
  const flowStep = state.approvalFlowSteps.find((s) => s.id === activeStep.flow_step_id);
  const bc = state.basecamps.find((b) => b.id === req.basecamp_id);
  const actorArea = getUserBasecampAndArea(state, actor.id).area;
  const scopeOk = !flowStep || flowStep.scope === 'GLOBAL' || actorArea?.id === bc?.area_id;

  if (
    !flowStep ||
    actor.role_id !== flowStep.approver_role_id ||
    actor.id === req.requester_id ||
    !scopeOk
  ) {
    return {
      allowed: false,
      code: 403,
      error: '403 TIDAK_BERHAK — Role, cakupan area, atau pemohon tidak memenuhi syarat langkah ini.',
    };
  }
  return { allowed: true, step: activeStep };
}

export function getPendingApprovalsForUser(state: SerpoState, actorUserId: number): FundRequest[] {
  return state.fundRequests.filter((fr) => canUserActOnFundRequest(state, fr.id, actorUserId).allowed);
}

export interface FundDecisionResult {
  statusCode: 200 | 403 | 404 | 409 | 422;
  errorCode?: string;
  error?: string;
  budgetAlertTriggered?: boolean;
  state: SerpoState;
}

export function decideFundRequest(
  state: SerpoState,
  fundRequestId: number,
  actorUserId: number,
  decision: 'SETUJUI' | 'TOLAK',
  note?: string
): FundDecisionResult {
  const req = state.fundRequests.find((r) => r.id === fundRequestId);
  if (!req) {
    return { statusCode: 404, errorCode: 'TIDAK_DITEMUKAN', error: '404 Pengajuan dana tidak ditemukan.', state };
  }

  const perm = canUserActOnFundRequest(state, fundRequestId, actorUserId);
  if (!perm.allowed || !perm.step) {
    return {
      statusCode: perm.code ?? 403,
      errorCode: perm.code === 409 ? 'SUDAH_DIPROSES' : 'TIDAK_BERHAK',
      error: perm.error,
      state,
    };
  }

  const activeStep = perm.step;
  const cleanNote = note?.trim() ?? '';

  if (decision === 'TOLAK') {
    if (!cleanNote) {
      return {
        statusCode: 422,
        errorCode: 'CATATAN_WAJIB',
        error: '422 Alasan penolakan (note) wajib diisi saat menolak pengajuan dana.',
        state,
      };
    }
    const updatedApprovals = state.fundRequestApprovals.map((a) => {
      if (a.id === activeStep.id) {
        return {
          ...a,
          approver_user_id: actorUserId,
          status: 'REJECTED' as const,
          note: cleanNote,
          acted_at: state.serverNowIso,
        };
      }
      if (a.fund_request_id === fundRequestId && a.status === 'WAITING') {
        return { ...a, status: 'CANCELLED' as const };
      }
      return a;
    });

    const nextNotifId = Math.max(0, ...state.notifications.map((n) => n.id)) + 1;
    const rejectNotif: AppNotification = {
      id: nextNotifId,
      user_id: req.requester_id,
      title: `Pengajuan ${req.request_no} ditolak`,
      message: `Alasan penolakan: ${cleanNote}`,
      type: 'FUND_RESULT',
      ref_table: 'Fund_Requests',
      ref_id: req.id,
      is_read: false,
      dedupe_key: `FR_RESULT:${req.id}:REJECTED`,
      created_at: state.serverNowIso,
    };

    return {
      statusCode: 200,
      state: {
        ...state,
        fundRequests: state.fundRequests.map((r) =>
          r.id === fundRequestId ? { ...r, status: 'REJECTED' } : r
        ),
        fundRequestApprovals: updatedApprovals,
        notifications: insertDedupeNotifications(state.notifications, [rejectNotif]),
      },
    };
  }

  // SETUJUI branch
  const nextStep = state.fundRequestApprovals.find(
    (a) => a.fund_request_id === fundRequestId && a.step_order === activeStep.step_order + 1
  );

  if (nextStep) {
    const updatedApprovals = state.fundRequestApprovals.map((a) => {
      if (a.id === activeStep.id) {
        return {
          ...a,
          approver_user_id: actorUserId,
          status: 'APPROVED' as const,
          note: cleanNote || 'Disetujui ke langkah berikutnya',
          acted_at: state.serverNowIso,
        };
      }
      if (a.id === nextStep.id) {
        return { ...a, status: 'PENDING' as const };
      }
      return a;
    });

    const flowStep = state.approvalFlowSteps.find((s) => s.id === nextStep.flow_step_id);
    const bc = state.basecamps.find((b) => b.id === req.basecamp_id);
    const nextApprovers = flowStep
      ? findApproversForStep(state, flowStep.approver_role_id, flowStep.scope, bc?.area_id ?? 1)
      : [];
    let nextNotifId = Math.max(0, ...state.notifications.map((n) => n.id)) + 1;
    const stepNotifs: AppNotification[] = nextApprovers
      .filter((u) => u.id !== req.requester_id)
      .map((u) => ({
        id: nextNotifId++,
        user_id: u.id,
        title: `Menunggu persetujuan langkah ${nextStep.step_order} (${req.request_no})`,
        message: `Top-up kas ${bc?.name ?? 'Basecamp'} sebesar ${formatRupiah(req.amount)} siap diputuskan.`,
        type: 'FUND_APPROVAL',
        ref_table: 'Fund_Requests',
        ref_id: req.id,
        is_read: false,
        dedupe_key: `FR_STEP:${req.id}:${nextStep.step_order}`,
        created_at: state.serverNowIso,
      }));

    return {
      statusCode: 200,
      state: {
        ...state,
        fundRequests: state.fundRequests.map((r) =>
          r.id === fundRequestId ? { ...r, status: 'IN_PROGRESS' } : r
        ),
        fundRequestApprovals: updatedApprovals,
        notifications: insertDedupeNotifications(state.notifications, stepNotifs),
      },
    };
  }

  // FINAL STEP: Check unresolved offline audit flag first (Diagram 4)
  const unresolvedAudit = state.syncAuditLogs.find(
    (log) =>
      log.entity_type === 'FUND_REQUEST' &&
      log.entity_id === req.id &&
      log.outcome === 'ACCEPTED_FLAGGED' &&
      log.resolution_status === 'UNRESOLVED'
  );
  if (unresolvedAudit) {
    return {
      statusCode: 409,
      errorCode: 'FLAG_AUDIT_BELUM_DISELESAIKAN',
      error:
        '409 FLAG_AUDIT_BELUM_DISELESAIKAN — Pengajuan berasal dari sinkronisasi offline ber-flag. Selesaikan resolusi di Antrean Audit sebelum approval final.',
      state,
    };
  }

  // Final atomic transaction: HARD budget check -> Cash_Ledgers TOP_UP -> Basecamp_Cash_Balances -> Budgets.realized_amount
  const budget = state.budgets.find((b) => b.id === req.budget_id);
  if (!budget || budget.allocated_amount - budget.realized_amount < req.amount) {
    const remaining = budget ? budget.allocated_amount - budget.realized_amount : 0;
    return {
      statusCode: 409,
      errorCode: 'BUDGET_TIDAK_CUKUP',
      error: `409 BUDGET_TIDAK_CUKUP (ROLLBACK) — Sisa budget area ${formatRupiah(remaining)} tidak mencukupi untuk mencairkan ${formatRupiah(req.amount)}.`,
      state,
    };
  }

  const balanceBefore = getBasecampBalance(state, req.basecamp_id);
  const balanceAfter = balanceBefore + req.amount;
  const bc = state.basecamps.find((b) => b.id === req.basecamp_id);
  const nextLedgerId = Math.max(0, ...state.cashLedgers.map((l) => l.id)) + 1;

  const newLedger: CashLedger = {
    id: nextLedgerId,
    basecamp_id: req.basecamp_id,
    fund_request_id: req.id,
    transaction_type: 'TOP_UP',
    direction: 'IN',
    amount: req.amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_no: req.request_no,
    description: `Top-up kas Basecamp ${bc?.name ?? req.basecamp_id} (${req.request_no})`,
    created_by: actorUserId,
    created_at: state.serverNowIso,
  };

  const newRealized = budget.realized_amount + req.amount;
  const updatedBudgets = state.budgets.map((b) =>
    b.id === budget.id ? { ...b, realized_amount: newRealized } : b
  );
  const updatedBalances = state.basecampCashBalances.map((cb) =>
    cb.basecamp_id === req.basecamp_id ? { ...cb, current_balance: balanceAfter } : cb
  );
  const updatedApprovals = state.fundRequestApprovals.map((a) =>
    a.id === activeStep.id
      ? {
          ...a,
          approver_user_id: actorUserId,
          status: 'APPROVED' as const,
          note: cleanNote || 'Disetujui final & kas basecamp ditambahkan',
          acted_at: state.serverNowIso,
        }
      : a
  );

  let nextNotifId = Math.max(0, ...state.notifications.map((n) => n.id)) + 1;
  const newNotifications: AppNotification[] = [
    {
      id: nextNotifId++,
      user_id: req.requester_id,
      title: `Pengajuan ${req.request_no} disetujui`,
      message: `Top-up ${formatRupiah(req.amount)} ke kas ${bc?.name ?? 'Basecamp'} telah dicatat di Cash_Ledgers.`,
      type: 'FUND_RESULT',
      ref_table: 'Fund_Requests',
      ref_id: req.id,
      is_read: false,
      dedupe_key: `FR_RESULT:${req.id}:APPROVED`,
      created_at: state.serverNowIso,
    },
  ];

  // Diagram 7: Trigger Budget Alert ONLY here when Budgets.realized_amount changes after COMMIT
  let budgetAlertTriggered = false;
  const ratioPct = budget.allocated_amount > 0 ? (newRealized / budget.allocated_amount) * 100 : 0;
  if (ratioPct > budget.alert_threshold) {
    const areaObj = state.areas.find((a) => a.id === budget.area_id);
    const dedupeKey = `BUDGET_ALERT:${budget.id}:${budget.alert_threshold}`;
    const recipients = state.users.filter((u) => {
      if (u.status !== 'ACTIVE') return false;
      const role = getUserRole(state, u);
      if (role?.code === 'MANAGEMENT') return true;
      if (role?.code === 'KOORDINATOR') {
        const userArea = getUserBasecampAndArea(state, u.id).area;
        return userArea?.id === budget.area_id;
      }
      return false;
    });

    for (const recipient of recipients) {
      newNotifications.push({
        id: nextNotifId++,
        user_id: recipient.id,
        title: `Peringatan Budget Area ${areaObj?.name ?? budget.area_id} (${ratioPct.toFixed(1)}%)`,
        message: `Realisasi anggaran ${budget.period_label} mencapai ${formatRupiah(newRealized)} dari alokasi ${formatRupiah(budget.allocated_amount)} (ambang ${budget.alert_threshold}%).`,
        type: 'BUDGET_ALERT',
        ref_table: 'Budgets',
        ref_id: budget.id,
        is_read: false,
        dedupe_key: dedupeKey,
        created_at: state.serverNowIso,
      });
    }
    budgetAlertTriggered = true;
  }

  return {
    statusCode: 200,
    budgetAlertTriggered,
    state: {
      ...state,
      fundRequests: state.fundRequests.map((r) =>
        r.id === fundRequestId ? { ...r, status: 'APPROVED' } : r
      ),
      fundRequestApprovals: updatedApprovals,
      cashLedgers: [newLedger, ...state.cashLedgers],
      basecampCashBalances: updatedBalances,
      budgets: updatedBudgets,
      notifications: insertDedupeNotifications(state.notifications, newNotifications),
    },
  };
}

// ---------------------------------------------------------------------------
// Diagram 5: Pelacakan Lokasi Latar Belakang (Live Tracking)
// ---------------------------------------------------------------------------

export interface LocationPingInput {
  ping_id: string;
  user_id: number;
  attendance_id: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  battery_level: number;
  is_mock: boolean;
  fix_at: string;
  recorded_at: string;
}

export interface IngestPingsResult {
  accepted_ids: string[];
  rejected_ids: { ping_id: string; reason: string }[];
  state: SerpoState;
}

export function ingestLocationPings(
  state: SerpoState,
  pings: LocationPingInput[]
): IngestPingsResult {
  const accepted_ids: string[] = [];
  const rejected_ids: { ping_id: string; reason: string }[] = [];
  const nextTracks = [...state.locationTracks];
  let nextTrackId = Math.max(0, ...nextTracks.map((t) => t.id)) + 1;

  const serverNowMs = new Date(state.serverNowIso).getTime();
  const toleranceMs = state.trackingMaxToleranceMinutes * 60_000;

  for (const ping of pings) {
    const att = state.attendances.find(
      (a) => a.id === ping.attendance_id && a.user_id === ping.user_id
    );
    if (!att) {
      rejected_ids.push({ ping_id: ping.ping_id, reason: 'attendance_id tidak dimiliki user' });
      continue;
    }

    if (
      Number.isNaN(ping.latitude) ||
      Number.isNaN(ping.longitude) ||
      ping.latitude < -90 ||
      ping.latitude > 90 ||
      ping.longitude < -180 ||
      ping.longitude > 180
    ) {
      rejected_ids.push({ ping_id: ping.ping_id, reason: 'Koordinat GPS tidak valid' });
      continue;
    }

    const recMs = new Date(ping.recorded_at).getTime();
    if (Number.isNaN(recMs) || recMs > serverNowMs) {
      rejected_ids.push({ ping_id: ping.ping_id, reason: 'recorded_at berada di masa depan' });
      continue;
    }

    if (att.check_out_time) {
      const checkOutMs = new Date(att.check_out_time).getTime();
      if (recMs > checkOutMs + toleranceMs) {
        rejected_ids.push({
          ping_id: ping.ping_id,
          reason: `Melewati check_out_time + toleransi (${state.trackingMaxToleranceMinutes} mnt)`,
        });
        continue;
      }
    }

    // Idempotency UNIQUE(user_id, recorded_at) -> ON CONFLICT DO NOTHING, still counts as accepted
    const duplicate = nextTracks.some(
      (t) => t.user_id === ping.user_id && t.recorded_at === ping.recorded_at
    );
    if (!duplicate) {
      nextTracks.push({
        id: nextTrackId++,
        user_id: ping.user_id,
        attendance_id: ping.attendance_id,
        latitude: ping.latitude,
        longitude: ping.longitude,
        accuracy: ping.accuracy,
        battery_level: Math.max(0, Math.min(100, Math.round(ping.battery_level))),
        is_mock: ping.is_mock,
        fix_at: ping.fix_at,
        recorded_at: ping.recorded_at,
        received_at: state.serverNowIso,
      });
    }
    accepted_ids.push(ping.ping_id);
  }

  return {
    accepted_ids,
    rejected_ids,
    state: {
      ...state,
      locationTracks: nextTracks,
    },
  };
}

export function getLatestTrackForUser(
  state: SerpoState,
  userId: number
): LocationTrack | undefined {
  return [...state.locationTracks]
    .filter((t) => t.user_id === userId)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
}

// ---------------------------------------------------------------------------
// Diagram 6: Sinkronisasi Data Offline (Offline Syncing) & Sync_Audit_Logs
// ---------------------------------------------------------------------------

export function classifySyncAge(
  clientCreatedAt: string,
  serverReceivedAt: string
): { age_seconds: number; age_flag: SyncAgeFlag } {
  const clientMs = new Date(clientCreatedAt).getTime();
  const serverMs = new Date(serverReceivedAt).getTime();
  const age_seconds = Math.round((serverMs - clientMs) / 1000);
  if (age_seconds < 0) {
    return { age_seconds, age_flag: 'CLOCK_ANOMALY' };
  }
  const ageHours = age_seconds / 3600;
  if (ageHours < 24) return { age_seconds, age_flag: 'NORMAL' };
  if (ageHours <= 72) return { age_seconds, age_flag: 'PRIORITY' };
  return { age_seconds, age_flag: 'LATE' };
}

export interface SyncProcessResult {
  outcome: SyncOutcome;
  auditLog: SyncAuditLog;
  state: SerpoState;
}

export function syncOfflineItemToServer(
  state: SerpoState,
  item: OfflineOutboxItem
): SyncProcessResult {
  // Idempotency UNIQUE(user_id, client_uuid)
  const existingAudit = state.syncAuditLogs.find(
    (l) => l.user_id === item.user_id && l.client_uuid === item.client_uuid
  );
  if (existingAudit) {
    return {
      outcome: existingAudit.outcome,
      auditLog: existingAudit,
      state: {
        ...state,
        offlineOutbox: state.offlineOutbox.map((o) =>
          o.client_uuid === item.client_uuid
            ? { ...o, status: 'SYNCED', server_outcome: existingAudit.outcome }
            : o
        ),
      },
    };
  }

  const { age_seconds, age_flag } = classifySyncAge(item.client_created_at, state.serverNowIso);
  const flag_reasons: string[] = [];
  if (age_flag === 'PRIORITY') flag_reasons.push('Sinkronisasi tertunda 24–72 jam (PRIORITY)');
  if (age_flag === 'LATE') flag_reasons.push('Sinkronisasi tertunda > 72 jam (LATE)');
  if (age_flag === 'CLOCK_ANOMALY') flag_reasons.push('Jam perangkat lebih maju dari waktu server (CLOCK_ANOMALY)');

  let nextState = { ...state };
  let entityId: number | null = null;
  let rejectReason: string | null = null;

  if (item.payload.kind === 'ATTENDANCE') {
    const p = item.payload;
    const { attendanceLocation } = getUserBasecampAndArea(nextState, item.user_id);
    if (!attendanceLocation) {
      rejectReason = 'PENEMPATAN_BELUM_ADA: Pengguna tidak memiliki penempatan basecamp aktif';
    } else {
      const existingDay = nextState.attendances.find(
        (a) => a.user_id === item.user_id && a.work_date === p.work_date
      );
      if (p.aksi === 'CHECK_IN' && existingDay) {
        rejectReason = `Duplikat hari kerja (${p.work_date}): absensi masuk sudah tercatat`;
      } else if (p.aksi === 'CHECK_OUT' && (!existingDay || existingDay.check_out_time !== null)) {
        rejectReason = `Check-out offline invalid untuk ${p.work_date}`;
      } else {
        const dist = haversineMeters(p.lat, p.lng, attendanceLocation.lat, attendanceLocation.lng);
        if (p.is_mock) flag_reasons.push('Lokasi palsu (is_mock = true) saat offline');
        if (dist > attendanceLocation.radius) flag_reasons.push(`Di luar radius (${dist} m > ${attendanceLocation.radius} m)`);
        if (p.accuracy > 50) flag_reasons.push(`Akurasi GPS rendah (${p.accuracy} m)`);

        const isFlagged = flag_reasons.length > 0;
        if (p.aksi === 'CHECK_IN') {
          const newId = Math.max(0, ...nextState.attendances.map((a) => a.id)) + 1;
          entityId = newId;
          const newAtt: Attendance = {
            id: newId,
            user_id: item.user_id,
            work_date: p.work_date,
            check_in_time: item.client_created_at,
            check_in_lat: p.lat,
            check_in_lng: p.lng,
            check_in_accuracy: p.accuracy,
            check_in_is_mock: p.is_mock,
            check_out_time: null,
            check_out_lat: null,
            check_out_lng: null,
            check_out_accuracy: null,
            check_out_is_mock: null,
            attendance_location_id: attendanceLocation.attendance_location_id,
            attendance_type: p.attendance_type ?? 'REGULER',
            source: 'OFFLINE',
            verification_status: isFlagged ? 'FLAGGED' : 'VERIFIED',
          };
          const nextAttId = Math.max(0, ...nextState.attachments.map((at) => at.id)) + 1;
          nextState = {
            ...nextState,
            attendances: [newAtt, ...nextState.attendances],
            attachments: [
              ...nextState.attachments,
              {
                id: nextAttId,
                purpose: 'CHECKIN_SELFIE',
                ref_id: newId,
                file_path: p.selfie_path,
                checksum_sha256: p.selfie_sha256,
                file_size_kb: p.selfie_size_kb,
              },
            ],
          };
        } else if (existingDay) {
          entityId = existingDay.id;
          const nextAttId = Math.max(0, ...nextState.attachments.map((at) => at.id)) + 1;
          nextState = {
            ...nextState,
            attendances: nextState.attendances.map((a) =>
              a.id === existingDay.id
                ? {
                    ...a,
                    check_out_time: item.client_created_at,
                    check_out_lat: p.lat,
                    check_out_lng: p.lng,
                    check_out_accuracy: p.accuracy,
                    check_out_is_mock: p.is_mock,
                    verification_status: isFlagged ? 'FLAGGED' : a.verification_status,
                  }
                : a
            ),
            attachments: [
              ...nextState.attachments,
              {
                id: nextAttId,
                purpose: 'CHECKOUT_SELFIE',
                ref_id: existingDay.id,
                file_path: p.selfie_path,
                checksum_sha256: p.selfie_sha256,
                file_size_kb: p.selfie_size_kb,
              },
            ],
          };
        }
      }
    }
  } else {
    // FUND_REQUEST offline sync (creates entity even if LATE/CLOCK_ANOMALY unless budget missing/insufficient)
    const p = item.payload;
    const res = submitFundRequest(
      { ...nextState, networkOnline: true },
      {
        requesterId: item.user_id,
        basecampId: p.basecamp_id,
        description: p.description,
        items: p.items,
        doc_path: p.doc_path,
        doc_sha256: p.doc_sha256,
        doc_size_kb: p.doc_size_kb,
        client_uuid: item.client_uuid,
      }
    );
    if (res.error) {
      rejectReason = res.error;
    } else if (res.fundRequest) {
      entityId = res.fundRequest.id;
      nextState = { ...res.state, networkOnline: state.networkOnline };
    }
  }

  const outcome: SyncOutcome = rejectReason
    ? 'REJECTED'
    : flag_reasons.length > 0
    ? 'ACCEPTED_FLAGGED'
    : 'ACCEPTED';

  const nextLogId = Math.max(0, ...nextState.syncAuditLogs.map((l) => l.id)) + 1;
  const auditLog: SyncAuditLog = {
    id: nextLogId,
    user_id: item.user_id,
    client_uuid: item.client_uuid,
    entity_type: item.entity_type,
    entity_id: entityId,
    client_created_at: item.client_created_at,
    server_received_at: state.serverNowIso,
    age_seconds,
    age_flag,
    flag_reasons,
    outcome,
    reject_reason: rejectReason,
    resolution_status: outcome === 'ACCEPTED_FLAGGED' ? 'UNRESOLVED' : null,
    resolution_note: null,
    resolved_by: null,
    resolved_at: null,
    payload_summary: item.action_label,
  };

  let nextNotifId = Math.max(0, ...nextState.notifications.map((n) => n.id)) + 1;
  const syncNotifs: AppNotification[] = [];
  if (outcome === 'ACCEPTED_FLAGGED') {
    const reviewers = nextState.users.filter((u) => {
      const role = getUserRole(nextState, u);
      return u.status === 'ACTIVE' && (role?.code === 'MANAGEMENT' || role?.code === 'FINANCE');
    });
    for (const r of reviewers) {
      syncNotifs.push({
        id: nextNotifId++,
        user_id: r.id,
        title: `Sync offline ber-flag (${age_flag})`,
        message: `${item.action_label}: ${flag_reasons.join('; ')}`,
        type: 'SYNC_FLAGGED',
        ref_table: 'Sync_Audit_Logs',
        ref_id: nextLogId,
        is_read: false,
        dedupe_key: `SYNC_FLAGGED:${nextLogId}`,
        created_at: state.serverNowIso,
      });
    }
  }

  return {
    outcome,
    auditLog,
    state: {
      ...nextState,
      syncAuditLogs: [auditLog, ...nextState.syncAuditLogs],
      notifications: insertDedupeNotifications(nextState.notifications, syncNotifs),
      offlineOutbox: nextState.offlineOutbox.map((o) =>
        o.client_uuid === item.client_uuid
          ? {
              ...o,
              status: 'SYNCED',
              server_outcome: outcome,
              last_error: rejectReason ?? undefined,
            }
          : o
      ),
    },
  };
}

export function flushOfflineOutboxFIFO(state: SerpoState): {
  processed: number;
  failed: number;
  state: SerpoState;
} {
  const candidates = [...state.offlineOutbox]
    .filter((o) => o.status === 'PENDING' || o.status === 'FAILED_RETRY')
    .sort((a, b) => new Date(a.client_created_at).getTime() - new Date(b.client_created_at).getTime());

  if (candidates.length === 0) {
    return { processed: 0, failed: 0, state };
  }

  // If still offline, simulate retry_count increment + FAILED_RETRY / FAILED_NEEDS_ATTENTION (Diagram 6)
  if (!state.networkOnline) {
    const updatedOutbox = state.offlineOutbox.map((o) => {
      if (o.status !== 'PENDING' && o.status !== 'FAILED_RETRY') return o;
      const nextRetry = o.retry_count + 1;
      return {
        ...o,
        retry_count: nextRetry,
        status:
          nextRetry > state.offlineMaxRetry
            ? ('FAILED_NEEDS_ATTENTION' as const)
            : ('FAILED_RETRY' as const),
        last_error: 'Koneksi ke backend gagal (timeout / offline)',
      };
    });
    return {
      processed: 0,
      failed: candidates.length,
      state: { ...state, offlineOutbox: updatedOutbox },
    };
  }

  let current = state;
  let processed = 0;
  for (const item of candidates) {
    const res = syncOfflineItemToServer(current, item);
    current = res.state;
    processed += 1;
  }
  return { processed, failed: 0, state: current };
}

export function resolveSyncAuditLog(
  state: SerpoState,
  auditLogId: number,
  resolution: 'CONFIRMED' | 'REJECTED',
  resolverUserId: number,
  note: string
): SerpoState {
  const target = state.syncAuditLogs.find((l) => l.id === auditLogId);
  if (!target) return state;

  const updatedLogs = state.syncAuditLogs.map((l) =>
    l.id === auditLogId
      ? {
          ...l,
          resolution_status: resolution,
          resolution_note: note.trim() || (resolution === 'CONFIRMED' ? 'Dikonfirmasi valid' : 'Dinyatakan pelanggaran'),
          resolved_by: resolverUserId,
          resolved_at: state.serverNowIso,
        }
      : l
  );

  let updatedAttendances = state.attendances;
  if (target.entity_type === 'ATTENDANCE' && target.entity_id !== null) {
    updatedAttendances = state.attendances.map((a) =>
      a.id === target.entity_id
        ? {
            ...a,
            verification_status: resolution === 'CONFIRMED' ? 'VERIFIED' : 'FLAGGED',
          }
        : a
    );
  }

  return {
    ...state,
    syncAuditLogs: updatedLogs,
    attendances: updatedAttendances,
  };
}

// ---------------------------------------------------------------------------
// Diagram 7: Dashboard, Notifikasi & Rekonsiliasi Budgets vs Cash_Ledgers
// ---------------------------------------------------------------------------

export function reconcileBudgetsWithLedgers(state: SerpoState): {
  budget_id: number;
  area_name: string;
  stored_realized: number;
  ledger_topup_sum: number;
  diff: number;
  matched: boolean;
}[] {
  return state.budgets.map((b) => {
    const area = state.areas.find((a) => a.id === b.area_id);
    const areaBasecampIds = new Set(
      state.basecamps.filter((bc) => bc.area_id === b.area_id).map((bc) => bc.id)
    );
    const ledgerTopUpSum = state.cashLedgers
      .filter((l) => {
        if (!areaBasecampIds.has(l.basecamp_id)) return false;
        if (l.transaction_type !== 'TOP_UP') return false;
        const ledgerDate = l.created_at.slice(0, 10);
        return b.start_date <= ledgerDate && ledgerDate <= b.end_date;
      })
      .reduce((sum, l) => sum + l.amount, 0);

    return {
      budget_id: b.id,
      area_name: area?.name ?? `Area ${b.area_id}`,
      stored_realized: b.realized_amount,
      ledger_topup_sum: ledgerTopUpSum,
      diff: b.realized_amount - ledgerTopUpSum,
      matched: b.realized_amount === ledgerTopUpSum,
    };
  });
}

export function markNotificationRead(state: SerpoState, notificationId: number): SerpoState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    ),
  };
}

export function markAllNotificationsRead(state: SerpoState, userId: number): SerpoState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.user_id === userId ? { ...n, is_read: true } : n
    ),
  };
}

// ---------------------------------------------------------------------------
// Tickets & Reconciliation Corrections (ERD Ticket_Status_History + Segregation)
// ---------------------------------------------------------------------------

const ALLOWED_TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['OPEN', 'ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: [],
  CANCELLED: [],
};

export function updateTicketWithHistory(
  state: SerpoState,
  ticketId: number,
  actorUserId: number,
  patch: { status?: TicketStatus; assigned_to?: number | null; priority?: TicketPriority; note?: string }
): { state: SerpoState; error?: string } {
  const existing = state.tickets.find((t) => t.id === ticketId);
  if (!existing) {
    return { state, error: 'Tiket tidak ditemukan.' };
  }

  if (existing.status === 'RESOLVED' || existing.status === 'CANCELLED') {
    return {
      state,
      error: `Tiket berstatus ${existing.status} sudah final dan tidak dapat diubah lagi.`,
    };
  }

  const nextStatus = patch.status ?? existing.status;
  if (!ALLOWED_TICKET_TRANSITIONS[existing.status].includes(nextStatus)) {
    return {
      state,
      error: `Transisi status tidak valid: ${existing.status} → ${nextStatus}. Urutan wajib: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED (atau CANCELLED sebelum RESOLVED).`,
    };
  }

  const nextAssigned = patch.assigned_to !== undefined ? patch.assigned_to : existing.assigned_to;
  const nextPriority = patch.priority ?? existing.priority;
  const statusChanged = nextStatus !== existing.status;
  const assignedChanged = nextAssigned !== existing.assigned_to;
  const priorityChanged = nextPriority !== existing.priority;
  const trimmedNote = patch.note?.trim() ?? '';

  const changeParts: string[] = [];
  if (trimmedNote) changeParts.push(trimmedNote);
  if (assignedChanged) {
    const prevName = existing.assigned_to
      ? state.users.find((u) => u.id === existing.assigned_to)?.full_name ?? `#${existing.assigned_to}`
      : 'Belum ditugaskan';
    const nextName = nextAssigned
      ? state.users.find((u) => u.id === nextAssigned)?.full_name ?? `#${nextAssigned}`
      : 'Belum ditugaskan';
    changeParts.push(`Teknisi: ${prevName} → ${nextName}`);
  }
  if (priorityChanged) {
    changeParts.push(`Prioritas: ${existing.priority} → ${nextPriority}`);
  }

  let nextHistory: TicketStatusHistory[] = state.ticketStatusHistory;
  if (statusChanged || assignedChanged || priorityChanged || trimmedNote.length > 0) {
    const nextHistId = Math.max(0, ...nextHistory.map((h) => h.id)) + 1;
    nextHistory = [
      ...nextHistory,
      {
        id: nextHistId,
        ticket_id: ticketId,
        from_status: existing.status,
        to_status: nextStatus,
        changed_by: actorUserId,
        changed_at: state.serverNowIso,
        note: changeParts.length > 0 ? changeParts.join(' · ') : undefined,
      },
    ];
  }

  return {
    state: {
      ...state,
      tickets: state.tickets.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: nextStatus,
              assigned_to: nextAssigned,
              priority: nextPriority,
            }
          : t
      ),
      ticketStatusHistory: nextHistory,
    },
  };
}

// ---------------------------------------------------------------------------
// Budgets & Cash_Ledgers Validated Mutations
// ---------------------------------------------------------------------------

export function addBudgetAllocation(
  state: SerpoState,
  budgetId: number,
  extraAmount: number
): { state: SerpoState; error?: string } {
  if (!Number.isFinite(extraAmount) || extraAmount <= 0) {
    return {
      state,
      error: 'Tambahan alokasi anggaran harus berupa angka positif yang valid.',
    };
  }
  if (extraAmount < MIN_BUDGET_ALLOCATION_AMOUNT) {
    return {
      state,
      error: `Tambahan alokasi anggaran minimal ${formatRupiah(MIN_BUDGET_ALLOCATION_AMOUNT)}.`,
    };
  }
  const target = state.budgets.find((b) => b.id === budgetId);
  if (!target) {
    return { state, error: 'Data anggaran area tidak ditemukan.' };
  }
  return {
    state: {
      ...state,
      budgets: state.budgets.map((b) =>
        b.id === budgetId ? { ...b, allocated_amount: b.allocated_amount + extraAmount } : b
      ),
    },
  };
}

export function updateBudgetThreshold(
  state: SerpoState,
  budgetId: number,
  thresholdPct: number
): { state: SerpoState; error?: string } {
  if (!Number.isFinite(thresholdPct) || thresholdPct < 1 || thresholdPct > 100) {
    return {
      state,
      error: 'Ambang alert anggaran harus berupa angka antara 1% hingga 100%.',
    };
  }
  const target = state.budgets.find((b) => b.id === budgetId);
  if (!target) {
    return { state, error: 'Data anggaran area tidak ditemukan.' };
  }
  return {
    state: {
      ...state,
      budgets: state.budgets.map((b) =>
        b.id === budgetId ? { ...b, alert_threshold: thresholdPct } : b
      ),
    },
  };
}

export function recordCashLedgerMutation(
  state: SerpoState,
  actorUserId: number,
  payload: {
    basecampId: number;
    transactionType: 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
    amount: number;
    description: string;
    referenceNo?: string;
  }
): { state: SerpoState; error?: string } {
  if (payload.transactionType === 'ADJUSTMENT') {
    return {
      state,
      error:
        'Mutasi ADJUSTMENT tidak boleh ditulis langsung ke Buku Kas. Ajukan melalui Usulan Koreksi (persetujuan Management).',
    };
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return {
      state,
      error: 'Nominal mutasi kas harus berupa angka yang valid dan lebih dari Rp 0.',
    };
  }
  if (payload.amount < MIN_CASH_LEDGER_AMOUNT) {
    return {
      state,
      error: `Nominal mutasi kas minimal ${formatRupiah(MIN_CASH_LEDGER_AMOUNT)}.`,
    };
  }
  const cleanDesc = payload.description.trim();
  if (!cleanDesc) {
    return { state, error: 'Keterangan mutasi kas wajib diisi.' };
  }
  const bc = state.basecamps.find((b) => b.id === payload.basecampId);
  if (!bc) {
    return { state, error: 'Basecamp tujuan tidak ditemukan.' };
  }

  const direction: LedgerDirection = payload.transactionType === 'REFUND' ? 'IN' : 'OUT';
  const balBefore = getBasecampBalance(state, payload.basecampId);
  if (direction === 'OUT' && payload.amount > balBefore) {
    return {
      state,
      error: `Saldo kas basecamp tidak mencukupi (tersedia ${formatRupiah(balBefore)}).`,
    };
  }
  const balAfter = direction === 'OUT' ? balBefore - payload.amount : balBefore + payload.amount;
  const nextId = Math.max(0, ...state.cashLedgers.map((l) => l.id)) + 1;
  const referenceNo =
    payload.referenceNo?.trim() ||
    generateSequentialLedgerRef(state.cashLedgers, payload.transactionType, state.serverNowIso);

  const newLedger: CashLedger = {
    id: nextId,
    basecamp_id: payload.basecampId,
    fund_request_id: null,
    transaction_type: payload.transactionType,
    direction,
    amount: payload.amount,
    balance_before: balBefore,
    balance_after: balAfter,
    reference_no: referenceNo,
    description: cleanDesc,
    created_by: actorUserId,
    created_at: state.serverNowIso,
  };

  return {
    state: {
      ...state,
      cashLedgers: [newLedger, ...state.cashLedgers],
      basecampCashBalances: state.basecampCashBalances.map((cb) =>
        cb.basecamp_id === payload.basecampId ? { ...cb, current_balance: balAfter } : cb
      ),
    },
  };
}

export function proposeCorrection(
  state: SerpoState,
  proposer: { id: number; fullName: string; roleName: string },
  payload: {
    findingId: string;
    type: 'REPAIR' | 'ADJUSTMENT';
    basecampId?: number;
    cashDelta: number;
    realizationDelta: number;
    reason: string;
  }
): { state: SerpoState; proposal?: CorrectionProposal; error?: string } {
  const cleanReason = payload.reason.trim();
  if (!cleanReason) {
    return { state, error: 'Alasan usulan koreksi wajib diisi.' };
  }
  if (!Number.isFinite(payload.cashDelta) || !Number.isFinite(payload.realizationDelta)) {
    return { state, error: 'Nominal koreksi harus berupa angka yang valid.' };
  }
  if (payload.cashDelta === 0 && payload.realizationDelta === 0) {
    return { state, error: 'Nominal dampak koreksi harus lebih dari Rp 0.' };
  }
  if (payload.cashDelta !== 0 && Math.abs(payload.cashDelta) < MIN_CASH_LEDGER_AMOUNT) {
    return {
      state,
      error: `Nominal koreksi kas minimal ${formatRupiah(MIN_CASH_LEDGER_AMOUNT)}.`,
    };
  }
  if (payload.realizationDelta !== 0 && Math.abs(payload.realizationDelta) < MIN_CASH_LEDGER_AMOUNT) {
    return {
      state,
      error: `Nominal penyesuaian realisasi minimal ${formatRupiah(MIN_CASH_LEDGER_AMOUNT)}.`,
    };
  }

  const finding = state.findings.find((f) => f.id === payload.findingId);
  const targetBasecampId = finding?.basecamp_id ?? payload.basecampId;
  if (!targetBasecampId || !state.basecamps.some((b) => b.id === targetBasecampId)) {
    return { state, error: 'Temuan rekonsiliasi atau basecamp tujuan tidak ditemukan.' };
  }

  if (payload.cashDelta < 0) {
    const balBefore = getBasecampBalance(state, targetBasecampId);
    if (balBefore + payload.cashDelta < 0) {
      return {
        state,
        error: `Saldo kas basecamp tidak boleh menjadi negatif (tersedia ${formatRupiah(balBefore)}).`,
      };
    }
  }

  if (payload.realizationDelta < 0) {
    const bc = state.basecamps.find((b) => b.id === targetBasecampId);
    const budget = bc
      ? state.budgets.find((b) => b.area_id === bc.area_id)
      : undefined;
    if (budget && budget.realized_amount + payload.realizationDelta < 0) {
      return {
        state,
        error: `Realisasi anggaran tidak boleh menjadi negatif (saat ini ${formatRupiah(budget.realized_amount)}).`,
      };
    }
  }

  const impactLabel =
    payload.cashDelta !== 0
      ? `Saldo ${payload.cashDelta >= 0 ? '+' : '−'}${formatNumberId(Math.abs(payload.cashDelta))}`
      : `Realisasi ${payload.realizationDelta >= 0 ? '+' : '−'}${formatNumberId(Math.abs(payload.realizationDelta))}`;

  const runLabel = `${formatDateShortId(state.serverNowIso)}, ${formatTimeWita(state.serverNowIso)}`;
  const proposal: CorrectionProposal = {
    id: generateUniqueId('COR'),
    findingId: finding ? finding.id : payload.findingId,
    type: payload.type,
    basecamp_id: targetBasecampId,
    impactLabel,
    cashDelta: payload.cashDelta,
    realizationDelta: payload.realizationDelta,
    proposer_user_id: proposer.id,
    proposerName: proposer.fullName,
    proposerRole: proposer.roleName,
    waitingLabel: 'Baru saja',
    reason: cleanReason,
    status: 'Menunggu Management',
  };

  return {
    proposal,
    state: {
      ...state,
      findings: finding
        ? state.findings.map((f) =>
            f.id === finding.id
              ? {
                  ...f,
                  status: 'Koreksi diusulkan',
                  detectionHistory: [
                    { runLabel, note: `Koreksi diusulkan oleh ${proposer.fullName}` },
                    ...f.detectionHistory,
                  ],
                }
              : f
          )
        : state.findings,
      corrections: [proposal, ...state.corrections],
    },
  };
}

export function canApproveCorrection(
  correction: CorrectionProposal,
  approverUserId: number,
  approverRoleCode: RoleCode
): { allowed: boolean; reason?: string } {
  if (approverRoleCode !== 'MANAGEMENT') {
    return { allowed: false, reason: 'Hanya Management yang dapat menyetujui usulan koreksi.' };
  }
  if (correction.proposer_user_id === approverUserId) {
    return {
      allowed: false,
      reason: 'Pemisahan tugas: penyetuju tidak boleh sama dengan pengusul koreksi.',
    };
  }
  return { allowed: true };
}

export function applyCorrectionDecision(
  state: SerpoState,
  correctionId: string,
  action: 'approve' | 'reject',
  approverUserId: number,
  approverName: string,
  approverRoleCode: RoleCode,
  note?: string
): { state: SerpoState; error?: string } {
  const target = state.corrections.find((c) => c.id === correctionId);
  if (!target) return { state, error: 'Usulan koreksi tidak ditemukan.' };
  if (target.status !== 'Menunggu Management') {
    return { state, error: 'Usulan koreksi ini sudah diputuskan.' };
  }
  if (action === 'reject' && (!note || !note.trim())) {
    return { state, error: 'Catatan wajib diisi jika menolak usulan koreksi.' };
  }

  const check = canApproveCorrection(target, approverUserId, approverRoleCode);
  if (!check.allowed) {
    return { state, error: check.reason };
  }

  if (action === 'approve') {
    const balBefore = getBasecampBalance(state, target.basecamp_id);
    if (target.cashDelta < 0 && balBefore + target.cashDelta < 0) {
      return {
        state,
        error: `Persetujuan ditolak: saldo kas basecamp tidak mencukupi (tersedia ${formatRupiah(balBefore)}).`,
      };
    }
    const bc = state.basecamps.find((b) => b.id === target.basecamp_id);
    if (target.realizationDelta < 0 && bc) {
      const areaBudget = state.budgets.find((b) => b.area_id === bc.area_id);
      if (areaBudget && areaBudget.realized_amount + target.realizationDelta < 0) {
        return {
          state,
          error: `Persetujuan ditolak: realisasi anggaran tidak boleh menjadi negatif.`,
        };
      }
    }
  }

  const nextStatus: CorrectionProposal['status'] = action === 'approve' ? 'Disetujui' : 'Ditolak';
  const updatedCorrections = state.corrections.map((c) =>
    c.id === correctionId
      ? {
          ...c,
          status: nextStatus,
          decisionBy: approverName,
          decisionNote: note?.trim() || (action === 'approve' ? 'Koreksi disetujui Management' : ''),
        }
      : c
  );

  let updatedBalances = state.basecampCashBalances;
  let updatedBudgets = state.budgets;
  let updatedLedgers = state.cashLedgers;
  let updatedFindings = state.findings;

  if (action === 'approve') {
    const bc = state.basecamps.find((b) => b.id === target.basecamp_id);
    const balBefore = getBasecampBalance(state, target.basecamp_id);
    const balAfter = balBefore + target.cashDelta;
    if (target.cashDelta !== 0) {
      updatedBalances = state.basecampCashBalances.map((cb) =>
        cb.basecamp_id === target.basecamp_id ? { ...cb, current_balance: balAfter } : cb
      );
      const nextLedgerId = Math.max(0, ...state.cashLedgers.map((l) => l.id)) + 1;
      updatedLedgers = [
        {
          id: nextLedgerId,
          basecamp_id: target.basecamp_id,
          fund_request_id: null,
          transaction_type: 'ADJUSTMENT',
          direction: target.cashDelta >= 0 ? 'IN' : 'OUT',
          amount: Math.abs(target.cashDelta),
          balance_before: balBefore,
          balance_after: balAfter,
          reference_no: target.id,
          description: `Koreksi ${target.type} (${target.findingId}): ${target.reason}`,
          created_by: approverUserId,
          created_at: state.serverNowIso,
        },
        ...state.cashLedgers,
      ];
    }
    if (target.realizationDelta !== 0 && bc) {
      updatedBudgets = state.budgets.map((b) =>
        b.area_id === bc.area_id
          ? { ...b, realized_amount: b.realized_amount + target.realizationDelta }
          : b
      );
    }
    const runLabel = `Koreksi ${formatDateShortId(state.serverNowIso)}, ${formatTimeWita(state.serverNowIso)}`;
    updatedFindings = state.findings.map((f) =>
      f.id === target.findingId
        ? {
            ...f,
            status: 'Selesai',
            detectionHistory: [
              { runLabel, note: `Disetujui oleh ${approverName}` },
              ...f.detectionHistory,
            ],
          }
        : f
    );
  } else {
    updatedFindings = state.findings.map((f) =>
      f.id === target.findingId ? { ...f, status: 'Terbuka' } : f
    );
  }

  return {
    state: {
      ...state,
      corrections: updatedCorrections,
      basecampCashBalances: updatedBalances,
      budgets: updatedBudgets,
      cashLedgers: updatedLedgers,
      findings: updatedFindings,
    },
  };
}

export function runManualReconciliation(
  state: SerpoState,
  triggeredBy: string,
  elapsedMs = 1
): { state: SerpoState; run: ReconciliationRun; newFindings: ReconciliationFinding[] } {
  const reconRows = reconcileBudgetsWithLedgers(state);
  const startedAt = formatRunTimestamp(state.serverNowIso);
  const firstDetectedAt = `${formatDateShortId(state.serverNowIso)}, ${formatTimeWita(state.serverNowIso)} WITA`;
  const duration = formatDurationMs(elapsedMs);

  let nextFindings = [...state.findings];
  const createdFindings: ReconciliationFinding[] = [];
  const mismatchedAreas: string[] = [];

  for (const row of reconRows) {
    if (row.matched) continue;
    mismatchedAreas.push(`${row.area_name} (${formatRupiah(row.diff)})`);
    const budget = state.budgets.find((b) => b.id === row.budget_id);
    const areaBasecamp =
      (budget ? state.basecamps.find((bc) => bc.area_id === budget.area_id) : undefined) ??
      state.basecamps[0];

    const existingActiveIdx = nextFindings.findIndex(
      (f) =>
        f.budget_id === row.budget_id &&
        (f.status === 'Terbuka' || f.status === 'Koreksi diusulkan')
    );

    if (existingActiveIdx >= 0) {
      const existing = nextFindings[existingActiveIdx];
      nextFindings[existingActiveIdx] = {
        ...existing,
        discrepancyAmount: row.diff,
        expectedAmount: row.ledger_topup_sum,
        actualAmount: row.stored_realized,
        occurrences: existing.occurrences + 1,
        detectionHistory: [
          {
            runLabel: `Run ${startedAt}`,
            note: `Masih terdeteksi · selisih ${formatRupiah(row.diff)}`,
          },
          ...existing.detectionHistory,
        ],
      };
    } else if (areaBasecamp) {
      const newFinding: ReconciliationFinding = {
        id: generateUniqueId('F'),
        severity: Math.abs(row.diff) >= 1_000_000 ? 'Tinggi' : 'Sedang',
        checkType: 'Budgets.realized_amount vs SUM(Cash_Ledgers TOP_UP)',
        basecamp_id: areaBasecamp.id,
        budget_id: row.budget_id,
        discrepancyAmount: row.diff,
        expectedAmount: row.ledger_topup_sum,
        actualAmount: row.stored_realized,
        occurrences: 1,
        status: 'Terbuka',
        ageLabel: 'Baru saja',
        firstDetected: firstDetectedAt,
        relatedMutationId: `BUDGET-${row.budget_id}`,
        relatedMutationSummary: `${row.area_name} · selisih ${formatRupiah(row.diff)}`,
        hypothesis:
          'Budgets.realized_amount tidak cocok dengan SUM(Cash_Ledgers TOP_UP) pada periode aktif',
        detectionHistory: [
          {
            runLabel: `Run ${startedAt}`,
            note: `Pertama kali terdeteksi · selisih ${formatRupiah(row.diff)}`,
          },
        ],
      };
      nextFindings = [newFinding, ...nextFindings];
      createdFindings.push(newFinding);
    }
  }

  const matchedCount = reconRows.filter((r) => r.matched).length;
  const notes =
    mismatchedAreas.length === 0
      ? `Rekonsiliasi Budgets.realized_amount vs SUM(Cash_Ledgers TOP_UP) cocok 100% di ${matchedCount}/${reconRows.length} area (${state.basecamps.length} basecamp).`
      : `Terdeteksi ${mismatchedAreas.length} selisih (${mismatchedAreas.join('; ')}), ${createdFindings.length} temuan baru dibuat di ${reconRows.length} area.`;

  const run: ReconciliationRun = {
    id: generateUniqueId('RUN'),
    startedAt,
    trigger: 'Manual',
    triggeredBy,
    duration,
    status: 'Selesai',
    newFindings: createdFindings.length,
    notes,
  };

  return {
    run,
    newFindings: createdFindings,
    state: {
      ...state,
      findings: nextFindings,
      reconciliationRuns: [run, ...state.reconciliationRuns],
    },
  };
}

export interface DashboardTicketKpis {
  totalTickets: number;
  openCount: number;
  assignedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  slaCompliancePct: number;
  urgentIssuesCount: number;
  breachedCount: number;
}

export function computeDashboardTicketKpis(tickets: Ticket[]): DashboardTicketKpis {
  const activeSet = tickets.filter((t) => t.status !== 'CANCELLED');
  const totalTickets = activeSet.length;
  const openCount = activeSet.filter((t) => t.status === 'OPEN').length;
  const assignedCount = activeSet.filter((t) => t.status === 'ASSIGNED').length;
  const inProgressCount = activeSet.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = activeSet.filter((t) => t.status === 'RESOLVED').length;
  const breachedCount = activeSet.filter((t) => t.sla_breached).length;
  const compliantCount = activeSet.filter((t) => !t.sla_breached).length;
  const slaCompliancePct =
    totalTickets === 0 ? 100 : Math.round((compliantCount / totalTickets) * 1000) / 10;
  const urgentIssuesCount = activeSet.filter(
    (t) =>
      t.status !== 'RESOLVED' &&
      (t.priority === 'CRITICAL' || t.priority === 'HIGH' || t.sla_breached)
  ).length;

  return {
    totalTickets,
    openCount,
    assignedCount,
    inProgressCount,
    resolvedCount,
    slaCompliancePct,
    urgentIssuesCount,
    breachedCount,
  };
}

export interface TicketChartDatum {
  label: string;
  standardCount: number;
  urgentCount: number;
  totalCount: number;
}

export function computeTicketChartByBasecamp(state: SerpoState): TicketChartDatum[] {
  return state.basecamps
    .map((bc) => {
      const bcTickets = state.tickets.filter(
        (t) => t.basecamp_id === bc.id && t.status !== 'CANCELLED'
      );
      const urgentCount = bcTickets.filter(
        (t) =>
          t.status !== 'RESOLVED' &&
          (t.priority === 'CRITICAL' || t.priority === 'HIGH' || t.sla_breached)
      ).length;
      const standardCount = Math.max(0, bcTickets.length - urgentCount);
      return {
        label: bc.name,
        standardCount,
        urgentCount,
        totalCount: bcTickets.length,
      };
    })
    .filter((d) => d.totalCount > 0);
}

export function canLoginToPlatform(
  roleCode: RoleCode,
  platform: PlatformMode
): { allowed: boolean; error?: string } {
  if (platform === 'backoffice' && roleCode === 'TEKNISI') {
    return {
      allowed: false,
      error: 'Akun Teknisi harus masuk melalui Aplikasi Teknisi (Mobile).',
    };
  }
  if (platform === 'teknisi' && roleCode !== 'TEKNISI') {
    return {
      allowed: false,
      error: 'Akun Backoffice hanya dapat masuk melalui Web Backoffice (Desktop).',
    };
  }
  return { allowed: true };
}

export function getUserStorageKeyForPlatform(platform: PlatformMode): string {
  return platform === 'teknisi'
    ? 'sim_serpo_teknisi_user_v2'
    : 'sim_serpo_backoffice_user_v2';
}

export function resolvePortalRedirectPath(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const app = params.get('app');
  const query = search.startsWith('?') ? search : `?${search}`;
  if (app === 'teknisi') {
    return `/teknisi.html${query}`;
  }
  if (app === 'backoffice') {
    return `/backoffice.html${query}`;
  }
  return null;
}

export function parseCoordinateInput(raw: string): { lat: number; lng: number } | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  // Match @lat,lng | search/lat,+lng | q=lat,lng | !3dlat!4dlng | plain "lat, lng"
  const atMatch = cleaned.match(/@(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  const searchMatch = cleaned.match(/\/search\/(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  const queryMatch = cleaned.match(/[?&](?:q|ll|center)=(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  const dataMatch = cleaned.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const plainMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*\+?(-?\d+(?:\.\d+)?)$/);

  const match = searchMatch ?? atMatch ?? queryMatch ?? dataMatch ?? plainMatch;
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export function updateBasecampLocation(
  state: SerpoState,
  basecampId: number,
  payload: { lat: number; lng: number; radius?: number; name?: string }
): { state: SerpoState; location?: AttendanceLocation; error?: string } {
  const basecamp = state.basecamps.find((b) => b.id === basecampId);
  if (!basecamp) {
    return { state, error: 'Basecamp tidak ditemukan.' };
  }
  const existingLoc = state.attendanceLocations.find(
    (l) => l.attendance_location_id === basecamp.attendance_location_id
  );
  if (!existingLoc) {
    return { state, error: 'Titik absensi basecamp tidak ditemukan.' };
  }
  if (!Number.isFinite(payload.lat) || payload.lat < -90 || payload.lat > 90) {
    return { state, error: 'Nilai lintang (latitude) harus antara -90 dan 90.' };
  }
  if (!Number.isFinite(payload.lng) || payload.lng < -180 || payload.lng > 180) {
    return { state, error: 'Nilai bujur (longitude) harus antara -180 dan 180.' };
  }
  const nextRadius =
    payload.radius !== undefined ? Math.round(payload.radius) : existingLoc.radius;
  if (!Number.isFinite(nextRadius) || nextRadius < 50 || nextRadius > 2000) {
    return { state, error: 'Radius titik absen harus antara 50 m hingga 2.000 m.' };
  }
  const nextName = payload.name?.trim() ? payload.name.trim() : existingLoc.name;

  const updatedLoc: AttendanceLocation = {
    ...existingLoc,
    name: nextName,
    lat: Number(payload.lat.toFixed(6)),
    lng: Number(payload.lng.toFixed(6)),
    radius: nextRadius,
  };

  return {
    location: updatedLoc,
    state: {
      ...state,
      attendanceLocations: state.attendanceLocations.map((loc) =>
        loc.attendance_location_id === existingLoc.attendance_location_id ? updatedLoc : loc
      ),
    },
  };
}
