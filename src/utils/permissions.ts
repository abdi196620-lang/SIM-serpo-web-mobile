import { DEMO_MODE } from '../config';
import { RoleCode, RouteId, Ticket, TicketPriority, TicketStatus } from '../types/serpo';

export type PermissionAction =
  | 'ticket.update'
  | 'ledger.expense'
  | 'ledger.refund'
  | 'ledger.adjustment'
  | 'budget.addAllocation'
  | 'budget.setThreshold'
  | 'recon.runManual'
  | 'finding.markFalsePositive'
  | 'correction.propose'
  | 'demo.reset';

export const ROLE_ALLOWED_ROUTES: Record<RoleCode, readonly RouteId[]> = {
  MANAGEMENT: [
    'dashboard',
    'tiket',
    'rekap_tiket',
    'rekap_kehadiran',
    'peta_langsung',
    'jejak_teknisi',
    'anggaran_area',
    'saldo_kas',
    'kas_basecamp',
    'buku_kas',
    'dana_pengajuan',
    'antrean_audit',
    'temuan_rekonsiliasi',
    'detail_temuan',
    'persetujuan_koreksi',
    'riwayat_run',
    'profil_pengaturan',
  ],
  FINANCE: [
    'dashboard',
    'antrean_persetujuan',
    'riwayat_keputusan',
    'dana_pengajuan',
    'buku_kas',
    'anggaran_area',
    'saldo_kas',
    'kas_basecamp',
    'antrean_audit',
    'temuan_rekonsiliasi',
    'detail_temuan',
    'usulan_koreksi',
    'riwayat_run',
    'profil_pengaturan',
  ],
  MANAJER_AREA: [
    'dashboard',
    'antrean_persetujuan',
    'riwayat_keputusan',
    'rekap_kehadiran',
    'tiket',
    'rekap_tiket',
    'peta_langsung',
    'jejak_teknisi',
    'anggaran_area',
    'saldo_kas',
    'kas_basecamp',
    'buku_kas',
    'dana_pengajuan',
    'profil_pengaturan',
  ],
  KOORDINATOR: [
    'dashboard',
    'dana_pengajuan',
    'saldo_kas',
    'kas_basecamp',
    'buku_kas',
    'rekap_kehadiran',
    'peta_langsung',
    'tiket',
    'antrean_audit',
    'profil_pengaturan',
  ],
  TEKNISI: [
    'dashboard',
    'tiket',
    'rekap_kehadiran',
    'peta_langsung',
    'jejak_teknisi',
    'antrean_audit',
    'profil_pengaturan',
  ],
  ADMIN: ['dashboard', 'profil_pengaturan'],
};

const KNOWN_ROLES = new Set<string>(Object.keys(ROLE_ALLOWED_ROUTES));

export function getAllowedRoutes(roleCode: RoleCode | string): readonly RouteId[] {
  if (!KNOWN_ROLES.has(roleCode)) {
    return [];
  }
  return ROLE_ALLOWED_ROUTES[roleCode as RoleCode];
}

export function canAccessRoute(roleCode: RoleCode | string, route: RouteId): boolean {
  return getAllowedRoutes(roleCode).includes(route);
}

export function can(
  roleCode: RoleCode | string,
  action: PermissionAction,
  demoMode: boolean = DEMO_MODE
): boolean {
  switch (action) {
    case 'ticket.update':
      return (
        roleCode === 'KOORDINATOR' ||
        roleCode === 'MANAJER_AREA' ||
        roleCode === 'MANAGEMENT'
      );
    case 'ledger.expense':
      return roleCode === 'FINANCE' || roleCode === 'KOORDINATOR';
    case 'ledger.refund':
    case 'ledger.adjustment':
      return roleCode === 'FINANCE';
    case 'budget.addAllocation':
    case 'budget.setThreshold':
      return roleCode === 'FINANCE' || roleCode === 'MANAGEMENT';
    case 'recon.runManual':
    case 'finding.markFalsePositive':
    case 'correction.propose':
      return roleCode === 'FINANCE';
    case 'demo.reset':
      return Boolean(demoMode) && roleCode === 'MANAGEMENT';
    default:
      return false;
  }
}

export function canUpdateTicket(
  roleCode: RoleCode | string,
  actorUserId: number,
  ticket: Pick<Ticket, 'assigned_to' | 'priority'>,
  patch: {
    status?: TicketStatus;
    assigned_to?: number | null;
    priority?: TicketPriority;
    note?: string;
  }
): { allowed: boolean; reason?: string } {
  if (can(roleCode, 'ticket.update')) {
    return { allowed: true };
  }
  if (roleCode === 'TEKNISI') {
    if (ticket.assigned_to !== actorUserId) {
      return {
        allowed: false,
        reason: 'Akses ditolak: Teknisi hanya boleh mengubah status tiket yang ditugaskan kepadanya.',
      };
    }
    if (patch.assigned_to !== undefined && patch.assigned_to !== ticket.assigned_to) {
      return {
        allowed: false,
        reason: 'Akses ditolak: Teknisi tidak berhak mengubah penugasan teknisi pada tiket.',
      };
    }
    if (patch.priority !== undefined && patch.priority !== ticket.priority) {
      return {
        allowed: false,
        reason: 'Akses ditolak: Teknisi tidak berhak mengubah prioritas tiket.',
      };
    }
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Akses ditolak: peran Anda tidak memiliki izin untuk memperbarui tiket.',
  };
}

export function canRecordCashLedger(
  roleCode: RoleCode | string,
  transactionType: 'EXPENSE' | 'REFUND' | 'ADJUSTMENT',
  targetBasecampId: number,
  userBasecampId: number | null
): { allowed: boolean; reason?: string } {
  if (transactionType === 'EXPENSE') {
    if (!can(roleCode, 'ledger.expense')) {
      return {
        allowed: false,
        reason: 'Akses ditolak: hanya Finance atau Koordinator yang dapat mencatat mutasi EXPENSE.',
      };
    }
    if (roleCode === 'KOORDINATOR' && userBasecampId !== targetBasecampId) {
      return {
        allowed: false,
        reason: 'Akses ditolak: Koordinator hanya dapat mencatat mutasi EXPENSE untuk basecamp sendiri.',
      };
    }
    return { allowed: true };
  }

  if (transactionType === 'REFUND') {
    if (!can(roleCode, 'ledger.refund')) {
      return {
        allowed: false,
        reason: 'Akses ditolak: hanya Finance yang dapat mencatat mutasi REFUND.',
      };
    }
    return { allowed: true };
  }

  if (!can(roleCode, 'ledger.adjustment')) {
    return {
      allowed: false,
      reason: 'Akses ditolak: hanya Finance yang dapat mencatat mutasi ADJUSTMENT.',
    };
  }
  return { allowed: true };
}

export function canSubmitAttendance(
  roleCode: RoleCode | string,
  actorUserId: number,
  targetUserId: number
): { allowed: boolean; reason?: string } {
  if (roleCode !== 'TEKNISI') {
    return {
      allowed: false,
      reason: 'Akses ditolak: absensi hanya dilakukan melalui akun Teknisi masing-masing.',
    };
  }
  if (actorUserId !== targetUserId) {
    return {
      allowed: false,
      reason: 'Akses ditolak: absensi hanya dapat dilakukan untuk akun yang sedang masuk.',
    };
  }
  return { allowed: true };
}

export function canUpdateBasecampLocation(
  roleCode: RoleCode | string,
  targetBasecampId: number,
  userBasecampId: number | null
): { allowed: boolean; reason?: string } {
  if (roleCode === 'MANAGEMENT' || roleCode === 'MANAJER_AREA') {
    return { allowed: true };
  }
  if (roleCode === 'KOORDINATOR') {
    if (userBasecampId !== targetBasecampId) {
      return {
        allowed: false,
        reason: 'Akses ditolak: Koordinator hanya dapat mengubah lokasi basecamp sendiri.',
      };
    }
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Akses ditolak: hanya Koordinator, Manajer Area, atau Management yang dapat mengatur lokasi basecamp.',
  };
}

