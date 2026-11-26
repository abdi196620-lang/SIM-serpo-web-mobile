import React from 'react';
import {
  LayoutGrid,
  Ticket,
  BarChart3,
  Clock,
  MapPin,
  Route,
  Wallet,
  Banknote,
  FileSpreadsheet,
  BookOpen,
  Flag,
  Scale,
  CheckSquare,
  History,
  CheckCircle2,
  UserCheck,
  Wifi,
  WifiOff,
  LogOut,
  X,
} from 'lucide-react';
import { ActiveSessionContext, RoleCode, RouteId } from '../types/serpo';
import { DEMO_MODE } from '../config';
import { canAccessRoute } from '../utils/permissions';
import { VisdatLogo } from './VisdatLogo';

interface NavItem {
  id: RouteId;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  urgentBadge?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  session: ActiveSessionContext;
  activeRoute: RouteId;
  onNavigate: (route: RouteId) => void;
  pendingApprovalCount: number;
  unresolvedAuditCount: number;
  openFindingsCount: number;
  outboxCount: number;
  unreadNotificationsCount: number;
  networkOnline: boolean;
  onToggleNetwork: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  session,
  activeRoute,
  onNavigate,
  pendingApprovalCount,
  unresolvedAuditCount,
  openFindingsCount,
  outboxCount,
  unreadNotificationsCount,
  networkOnline,
  onToggleNetwork,
  mobileOpen,
  onCloseMobile,
  onLogout,
}) => {
  const iconCls = 'w-4 h-4 shrink-0';
  const roleCode = session.role.code;

  const getGroupsForRole = (code: RoleCode): NavGroup[] => {
    if (code === 'MANAGEMENT') {
      return [
        {
          title: 'RINGKASAN',
          items: [
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: <LayoutGrid className={iconCls} />,
              badgeCount: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
              urgentBadge: unreadNotificationsCount > 0,
            },
          ],
        },
        {
          title: 'OPERASIONAL',
          items: [
            { id: 'tiket', label: 'Tiket', icon: <Ticket className={iconCls} /> },
            { id: 'rekap_tiket', label: 'Rekap tiket', icon: <BarChart3 className={iconCls} /> },
          ],
        },
        {
          title: 'ABSENSI & PELACAKAN',
          items: [
            { id: 'rekap_kehadiran', label: 'Absensi teknisi', icon: <Clock className={iconCls} /> },
            { id: 'peta_langsung', label: 'Pelacakan langsung', icon: <MapPin className={iconCls} /> },
            { id: 'jejak_teknisi', label: 'Jejak teknisi', icon: <Route className={iconCls} /> },
          ],
        },
        {
          title: 'ANGGARAN & KAS',
          items: [
            { id: 'anggaran_area', label: 'Anggaran area', icon: <Wallet className={iconCls} /> },
            { id: 'saldo_kas', label: 'Saldo kas basecamp', icon: <Banknote className={iconCls} /> },
            { id: 'buku_kas', label: 'Buku kas', icon: <BookOpen className={iconCls} /> },
            { id: 'dana_pengajuan', label: 'Pengajuan dana', icon: <FileSpreadsheet className={iconCls} /> },
          ],
        },
        {
          title: 'AUDIT & REKONSILIASI',
          items: [
            {
              id: 'antrean_audit',
              label: 'Audit & antrean offline',
              icon: <Flag className={iconCls} />,
              badgeCount: unresolvedAuditCount + outboxCount > 0 ? unresolvedAuditCount + outboxCount : undefined,
              urgentBadge: unresolvedAuditCount > 0,
            },
            {
              id: 'temuan_rekonsiliasi',
              label: 'Temuan rekonsiliasi',
              icon: <Scale className={iconCls} />,
              badgeCount: openFindingsCount > 0 ? openFindingsCount : undefined,
              urgentBadge: openFindingsCount > 0,
            },
            { id: 'persetujuan_koreksi', label: 'Persetujuan koreksi', icon: <CheckSquare className={iconCls} /> },
            { id: 'riwayat_run', label: 'Riwayat pemeriksaan', icon: <History className={iconCls} /> },
          ],
        },
      ];
    }

    if (code === 'FINANCE') {
      return [
        {
          title: 'RINGKASAN',
          items: [
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: <LayoutGrid className={iconCls} />,
              badgeCount: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
              urgentBadge: unreadNotificationsCount > 0,
            },
          ],
        },
        {
          title: 'DANA & PERSETUJUAN',
          items: [
            {
              id: 'antrean_persetujuan',
              label: 'Antrean persetujuan',
              icon: <CheckCircle2 className={iconCls} />,
              badgeCount: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
            },
            { id: 'riwayat_keputusan', label: 'Riwayat keputusan', icon: <UserCheck className={iconCls} /> },
            { id: 'dana_pengajuan', label: 'Semua pengajuan', icon: <FileSpreadsheet className={iconCls} /> },
            { id: 'buku_kas', label: 'Buku kas', icon: <BookOpen className={iconCls} /> },
          ],
        },
        {
          title: 'ANGGARAN & KAS',
          items: [
            { id: 'anggaran_area', label: 'Anggaran area', icon: <Wallet className={iconCls} /> },
            { id: 'saldo_kas', label: 'Saldo kas basecamp', icon: <Banknote className={iconCls} /> },
          ],
        },
        {
          title: 'AUDIT & REKONSILIASI',
          items: [
            {
              id: 'antrean_audit',
              label: 'Audit & antrean offline',
              icon: <Flag className={iconCls} />,
              badgeCount: unresolvedAuditCount + outboxCount > 0 ? unresolvedAuditCount + outboxCount : undefined,
              urgentBadge: unresolvedAuditCount > 0,
            },
            { id: 'temuan_rekonsiliasi', label: 'Temuan rekonsiliasi', icon: <Scale className={iconCls} /> },
            { id: 'usulan_koreksi', label: 'Usulan koreksi', icon: <CheckSquare className={iconCls} /> },
            { id: 'riwayat_run', label: 'Riwayat pemeriksaan', icon: <History className={iconCls} /> },
          ],
        },
      ];
    }

    if (code === 'MANAJER_AREA') {
      return [
        {
          title: 'RINGKASAN',
          items: [
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: <LayoutGrid className={iconCls} />,
              badgeCount: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
              urgentBadge: unreadNotificationsCount > 0,
            },
          ],
        },
        {
          title: 'PERSETUJUAN & TIM',
          items: [
            {
              id: 'antrean_persetujuan',
              label: 'Antrean persetujuan',
              icon: <CheckCircle2 className={iconCls} />,
              badgeCount: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
            },
            { id: 'riwayat_keputusan', label: 'Riwayat keputusan', icon: <UserCheck className={iconCls} /> },
            { id: 'rekap_kehadiran', label: 'Absensi teknisi', icon: <Clock className={iconCls} /> },
          ],
        },
        {
          title: 'OPERASIONAL & LOKASI',
          items: [
            { id: 'tiket', label: 'Tiket', icon: <Ticket className={iconCls} /> },
            { id: 'rekap_tiket', label: 'Rekap tiket', icon: <BarChart3 className={iconCls} /> },
            { id: 'peta_langsung', label: 'Pelacakan langsung', icon: <MapPin className={iconCls} /> },
            { id: 'jejak_teknisi', label: 'Jejak teknisi', icon: <Route className={iconCls} /> },
          ],
        },
        {
          title: 'ANGGARAN & KAS',
          items: [
            { id: 'anggaran_area', label: 'Anggaran area', icon: <Wallet className={iconCls} /> },
            { id: 'saldo_kas', label: 'Saldo kas basecamp', icon: <Banknote className={iconCls} /> },
            { id: 'buku_kas', label: 'Buku kas', icon: <BookOpen className={iconCls} /> },
            { id: 'dana_pengajuan', label: 'Pengajuan dana', icon: <FileSpreadsheet className={iconCls} /> },
          ],
        },
      ];
    }

    if (code === 'KOORDINATOR') {
      return [
        {
          title: 'RINGKASAN',
          items: [
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: <LayoutGrid className={iconCls} />,
              badgeCount: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
              urgentBadge: unreadNotificationsCount > 0,
            },
          ],
        },
        {
          title: 'DANA & KAS BASECAMP',
          items: [
            { id: 'dana_pengajuan', label: 'Pengajuan dana', icon: <FileSpreadsheet className={iconCls} /> },
            { id: 'saldo_kas', label: 'Saldo kas basecamp', icon: <Banknote className={iconCls} /> },
            { id: 'buku_kas', label: 'Buku kas', icon: <BookOpen className={iconCls} /> },
          ],
        },
        {
          title: 'LAPANGAN & SINKRONISASI',
          items: [
            { id: 'rekap_kehadiran', label: 'Absensi teknisi', icon: <Clock className={iconCls} /> },
            { id: 'peta_langsung', label: 'Pelacakan langsung', icon: <MapPin className={iconCls} /> },
            { id: 'tiket', label: 'Tiket', icon: <Ticket className={iconCls} /> },
            {
              id: 'antrean_audit',
              label: 'Antrean & sinkronisasi',
              icon: <Flag className={iconCls} />,
              badgeCount: outboxCount > 0 ? outboxCount : undefined,
            },
          ],
        },
      ];
    }

    if (code === 'ADMIN') {
      return [
        {
          title: 'RINGKASAN',
          items: [
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: <LayoutGrid className={iconCls} />,
              badgeCount: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
              urgentBadge: unreadNotificationsCount > 0,
            },
          ],
        },
      ];
    }

    return [];
  };

  const groups = getGroupsForRole(roleCode)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(roleCode, item.id)),
    }))
    .filter((group) => group.items.length > 0);

  const isRouteActive = (itemId: RouteId) => {
    if (activeRoute === itemId) return true;
    if (itemId === 'temuan_rekonsiliasi' && activeRoute === 'detail_temuan') return true;
    if (itemId === 'saldo_kas' && activeRoute === 'kas_basecamp') return true;
    return false;
  };

  const scopeText = session.basecamp
    ? `${session.basecamp.name} · ${session.area?.name ?? ''}`
    : session.area?.name ?? 'Semua area';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E2E8F0] w-[260px]">
      {/* Brand header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => {
            onNavigate('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4B8F] rounded-lg"
        >
          <VisdatLogo className="h-8 w-auto" />
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-[#475569] hover:bg-[#F1F5F9]"
          aria-label="Tutup menu navigasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Network Online / Offline Toggle (Diagram 6 support, DEMO_MODE only) */}
      {DEMO_MODE && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onToggleNetwork}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              networkOnline
                ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0A4B8F]'
                : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {networkOnline ? (
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{networkOnline ? 'Koneksi Online' : 'Mode Offline'}</span>
            </span>
            <span className="text-[11px] underline">
              {networkOnline ? 'Simulasi putus' : 'Pulihkan'}
            </span>
          </button>
        </div>
      )}

      {/* Scrollable navigation groups */}
      <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 mb-1.5 text-[11px] font-semibold tracking-wider text-[#94A3B8] uppercase">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isRouteActive(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        onCloseMobile();
                      }}
                      className={`relative w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4B8F] ${
                        active
                          ? 'bg-[#EFF6FF] text-[#0A4B8F] font-semibold'
                          : 'text-[#475569] font-medium hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#0A4B8F]"
                          aria-hidden="true"
                        />
                      )}
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={active ? 'text-[#0A4B8F]' : 'text-[#94A3B8]'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                            item.urgentBadge
                              ? 'bg-[#E61E25] text-white'
                              : 'bg-[#0A4B8F] text-white'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom user profile & logout */}
      <div className="p-3 border-t border-[#E2E8F0] space-y-2">
        <button
          type="button"
          onClick={() => {
            onNavigate('profil_pengaturan');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4B8F] ${
            activeRoute === 'profil_pengaturan' ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
          }`}
        >
          <span className="w-8 h-8 rounded-lg bg-[#0A4B8F] text-white flex items-center justify-center text-xs font-bold shrink-0">
            {session.user.full_name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <span className="block text-xs font-semibold text-[#0F172A] truncate">
              {session.user.full_name}
            </span>
            <span className="block text-[11px] text-[#475569] truncate">
              {session.role.name} · {scopeText}
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onLogout();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#E61E25] hover:bg-[#FEE2E2] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E61E25]"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0F172A]/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
