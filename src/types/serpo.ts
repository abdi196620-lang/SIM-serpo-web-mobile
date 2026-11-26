export type RoleCode =
  | 'TEKNISI'
  | 'KOORDINATOR'
  | 'MANAJER_AREA'
  | 'FINANCE'
  | 'MANAGEMENT'
  | 'ADMIN';

export type PlatformMode = 'backoffice' | 'teknisi';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface Role {
  id: number;
  code: RoleCode;
  name: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  status: UserStatus;
  role_id: number;
}

export interface AuthProvider {
  id: number;
  user_id: number;
  provider: 'local';
  provider_uid: string;
  password_hash: string; // demo plain/hashed credential token for local check
}

export interface AuthSession {
  id: number;
  user_id: number;
  refresh_token_hash: string;
  device_name: string;
  expires_at: string;
  created_at: string;
  ended_at?: string | null;
}

export interface UserToken {
  id: number;
  user_id: number;
  token_hash: string;
  purpose: 'PASSWORD_RESET' | 'EMAIL_VERIFY';
  expires_at: string;
}

export interface TechnicianProfile {
  user_id: number;
  employee_no: string;
  position: string;
  activated_at: string;
  deactivated_at: string | null;
}

export interface Area {
  id: number;
  code: string;
  name: string;
}

export interface AttendanceLocation {
  attendance_location_id: number;
  name: string;
  radius: number; // meters
  lat: number;
  lng: number;
  type: 'BASECAMP' | 'FIELD_HUB';
}

export interface Basecamp {
  id: number;
  area_id: number;
  code: string;
  name: string;
  attendance_location_id: number;
}

export interface UserPlacement {
  id: number;
  user_id: number;
  basecamp_id: number;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
}

export interface Budget {
  id: number;
  area_id: number;
  period_label: string;
  allocated_amount: number;
  start_date: string;
  end_date: string;
  realized_amount: number; // DERIVED/MAINTAINED = sum of Cash_Ledgers TOP_UP per budget/area
  alert_threshold: number; // default 90.00
}

export interface BasecampCashBalance {
  basecamp_id: number;
  current_balance: number;
}

export type LedgerTransactionType = 'TOP_UP' | 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
export type LedgerDirection = 'IN' | 'OUT';

export interface CashLedger {
  id: number;
  basecamp_id: number;
  fund_request_id: number | null;
  transaction_type: LedgerTransactionType;
  direction: LedgerDirection;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_no: string;
  description: string;
  created_by: number;
  created_at: string;
}

export interface ApprovalFlow {
  id: number;
  code: string;
  name: string;
}

export interface ApprovalFlowStep {
  id: number;
  flow_id: number;
  step_order: number;
  approver_role_id: number;
  scope: 'AREA' | 'GLOBAL';
}

export type FundRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
export type ApprovalStepStatus = 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface FundRequest {
  id: number;
  request_no: string;
  requester_id: number;
  basecamp_id: number;
  budget_id: number;
  flow_id: number;
  status: FundRequestStatus;
  amount: number;
  client_uuid: string;
  description: string;
  created_at: string;
}

export interface FundRequestItem {
  id: number;
  fund_request_id: number;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

export interface FundRequestApproval {
  id: number;
  fund_request_id: number;
  flow_step_id: number;
  approver_user_id: number | null;
  step_order: number;
  status: ApprovalStepStatus;
  note: string | null;
  acted_at: string | null;
}

export type AttachmentPurpose = 'CHECKIN_SELFIE' | 'CHECKOUT_SELFIE' | 'REQUEST_DOCUMENT';

export interface Attachment {
  id: number;
  purpose: AttachmentPurpose;
  ref_id: number; // attendance_id or fund_request_id
  file_path: string;
  checksum_sha256: string;
  file_size_kb: number;
}

export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Ticket {
  id: number;
  ticket_no: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: number | null;
  basecamp_id: number;
  description: string;
  created_at: string;
  age_hours: number;
  sla_breached: boolean;
}

export interface TicketStatusHistory {
  id: number;
  ticket_id: number;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  changed_by: number;
  changed_at: string;
  note?: string;
}

export type AttendanceSource = 'ONLINE' | 'OFFLINE';
export type VerificationStatus = 'VERIFIED' | 'FLAGGED';

export interface Attendance {
  id: number;
  user_id: number;
  work_date: string; // YYYY-MM-DD UNIQUE(user_id, work_date)
  check_in_time: string;
  check_in_lat: number;
  check_in_lng: number;
  check_in_accuracy: number;
  check_in_is_mock: boolean;
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_accuracy: number | null;
  check_out_is_mock: boolean | null;
  attendance_location_id: number;
  attendance_type: string;
  source: AttendanceSource;
  verification_status: VerificationStatus;
}

export interface LocationTrack {
  id: number;
  user_id: number;
  attendance_id: number; // NOT NULL
  latitude: number;
  longitude: number;
  accuracy: number;
  battery_level: number;
  is_mock: boolean;
  fix_at: string;
  recorded_at: string;
  received_at: string;
}

export type SyncAgeFlag = 'NORMAL' | 'PRIORITY' | 'LATE' | 'CLOCK_ANOMALY';
export type SyncOutcome = 'ACCEPTED' | 'ACCEPTED_FLAGGED' | 'REJECTED';
export type AuditResolutionStatus = 'UNRESOLVED' | 'CONFIRMED' | 'REJECTED';

export interface SyncAuditLog {
  id: number;
  user_id: number;
  client_uuid: string;
  entity_type: 'ATTENDANCE' | 'FUND_REQUEST';
  entity_id: number | null;
  client_created_at: string;
  server_received_at: string;
  age_seconds: number;
  age_flag: SyncAgeFlag;
  flag_reasons: string[];
  outcome: SyncOutcome;
  reject_reason: string | null;
  resolution_status: AuditResolutionStatus | null;
  resolution_note: string | null;
  resolved_by: number | null;
  resolved_at: string | null;
  payload_summary: string;
}

export type OutboxStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED_RETRY'
  | 'FAILED_NEEDS_ATTENTION';

export interface OfflineOutboxItem {
  client_uuid: string;
  user_id: number;
  entity_type: 'ATTENDANCE' | 'FUND_REQUEST';
  action_label: string;
  client_created_at: string;
  status: OutboxStatus;
  retry_count: number;
  last_error?: string;
  server_outcome?: SyncOutcome;
  payload:
    | {
        kind: 'ATTENDANCE';
        aksi: 'CHECK_IN' | 'CHECK_OUT';
        attendance_type?: 'REGULER' | 'DINAS_LUAR' | 'LEMBUR';
        work_date: string;
        lat: number;
        lng: number;
        accuracy: number;
        is_mock: boolean;
        selfie_path: string;
        selfie_sha256: string;
        selfie_size_kb: number;
      }
    | {
        kind: 'FUND_REQUEST';
        basecamp_id: number;
        description: string;
        items: { item_name: string; quantity: number; unit: string; unit_price: number }[];
        doc_path: string;
        doc_sha256: string;
        doc_size_kb: number;
      };
}

export type NotificationType =
  | 'BUDGET_ALERT'
  | 'SYNC_FLAGGED'
  | 'FUND_APPROVAL'
  | 'FUND_RESULT';

export interface AppNotification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: NotificationType;
  ref_table: string;
  ref_id: number;
  is_read: boolean;
  dedupe_key: string;
  created_at: string;
}

export interface LocationAccessLog {
  id: string;
  viewer_user_id: number;
  viewer_name: string;
  viewer_role: string;
  technician_user_id: number;
  technician_name: string;
  date: string;
  accessed_at: string;
}

export interface ReconciliationFinding {
  id: string;
  severity: 'Tinggi' | 'Sedang' | 'Rendah';
  checkType: string;
  basecamp_id: number;
  budget_id?: number;
  discrepancyAmount: number;
  expectedAmount: number;
  actualAmount: number;
  occurrences: number;
  status: 'Terbuka' | 'Koreksi diusulkan' | 'Selesai' | 'False positive';
  ageLabel: string;
  firstDetected: string;
  relatedMutationId: string;
  relatedMutationSummary: string;
  hypothesis: string;
  detectionHistory: { runLabel: string; note: string }[];
  falsePositiveReason?: string;
}

export interface CorrectionProposal {
  id: string;
  findingId: string;
  type: 'REPAIR' | 'ADJUSTMENT';
  basecamp_id: number;
  impactLabel: string;
  cashDelta: number;
  realizationDelta: number;
  proposer_user_id: number;
  proposerName: string;
  proposerRole: string;
  waitingLabel: string;
  reason: string;
  status: 'Menunggu Management' | 'Disetujui' | 'Ditolak';
  decisionBy?: string;
  decisionNote?: string;
}

export interface ReconciliationRun {
  id: string;
  startedAt: string;
  trigger: 'Terjadwal' | 'Manual';
  triggeredBy?: string;
  duration: string;
  status: 'Selesai' | 'Gagal';
  newFindings: number;
  notes: string;
}

export interface ActiveSessionContext {
  session: AuthSession;
  user: User;
  role: Role;
  placement: UserPlacement | null;
  basecamp: Basecamp | null;
  area: Area | null;
  attendanceLocation: AttendanceLocation | null;
  technicianProfile: TechnicianProfile | null;
  access_token: string;
}

export type RouteId =
  | 'dashboard'
  | 'tiket'
  | 'rekap_tiket'
  | 'rekap_kehadiran'
  | 'riwayat_absensi'
  | 'peta_langsung'
  | 'jejak_teknisi'
  | 'anggaran_area'
  | 'saldo_kas'
  | 'kas_basecamp'
  | 'dana_pengajuan'
  | 'antrean_persetujuan'
  | 'riwayat_keputusan'
  | 'buku_kas'
  | 'antrean_audit'
  | 'temuan_rekonsiliasi'
  | 'detail_temuan'
  | 'usulan_koreksi'
  | 'persetujuan_koreksi'
  | 'riwayat_run'
  | 'profil_pengaturan';

export interface SerpoState {
  schemaVersion: number;
  currentDate: string; // e.g. '2026-11-08'
  serverNowIso: string; // simulated server clock '2026-11-08T09:41:00+08:00'
  networkOnline: boolean;
  roles: Role[];
  users: User[];
  authProviders: AuthProvider[];
  authSessions: AuthSession[];
  userTokens: UserToken[];
  technicianProfiles: TechnicianProfile[];
  areas: Area[];
  attendanceLocations: AttendanceLocation[];
  basecamps: Basecamp[];
  userPlacements: UserPlacement[];
  budgets: Budget[];
  basecampCashBalances: BasecampCashBalance[];
  cashLedgers: CashLedger[];
  approvalFlows: ApprovalFlow[];
  approvalFlowSteps: ApprovalFlowStep[];
  fundRequests: FundRequest[];
  fundRequestItems: FundRequestItem[];
  fundRequestApprovals: FundRequestApproval[];
  attachments: Attachment[];
  tickets: Ticket[];
  ticketStatusHistory: TicketStatusHistory[];
  attendances: Attendance[];
  locationTracks: LocationTrack[];
  syncAuditLogs: SyncAuditLog[];
  offlineOutbox: OfflineOutboxItem[];
  notifications: AppNotification[];
  locationAccessLogs: LocationAccessLog[];
  findings: ReconciliationFinding[];
  corrections: CorrectionProposal[];
  reconciliationRuns: ReconciliationRun[];
  trackingMaxToleranceMinutes: number;
  offlineMaxRetry: number;
}
