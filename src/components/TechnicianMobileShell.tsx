import React, { useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Clock,
  Flag,
  LayoutGrid,
  LogOut,
  MapPin,
  Smartphone,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ActiveSessionContext, AppNotification, RouteId } from '../types/serpo';
import { DEMO_MODE } from '../config';
import { canAccessRoute } from '../utils/permissions';
import { useDialogFocusTrap } from './Modal';
import { VisdatLogo } from './VisdatLogo';

interface TechnicianMobileShellProps {
  session: ActiveSessionContext;
  activeRoute: RouteId;
  routeTitle: string;
  outboxCount: number;
  unreadNotificationsCount: number;
  notifications: AppNotification[];
  networkOnline: boolean;
  onToggleNetwork: () => void;
  onNavigate: (route: RouteId) => void;
  onMarkNotificationRead: (notificationId: number) => void;
  onMarkAllNotificationsRead: (userId: number) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const TechnicianMobileShell: React.FC<TechnicianMobileShellProps> = ({
  session,
  activeRoute,
  routeTitle,
  outboxCount,
  unreadNotificationsCount,
  notifications,
  networkOnline,
  onToggleNetwork,
  onNavigate,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onLogout,
  children,
}) => {
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const notifDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogFocusTrap({
    isOpen: notifPopoverOpen,
    containerRef: notifDialogRef,
    onClose: () => setNotifPopoverOpen(false),
  });

  const userInitials = session.user.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="min-h-screen bg-[#F1F5F9] md:py-5 md:px-4 flex flex-col items-center justify-center">
      {/* Desktop-only subtle context strip above the Android app frame */}
      <div className="hidden md:flex w-full max-w-[400px] items-center justify-between gap-2 mb-2.5 px-1 text-xs">
        <div className="inline-flex items-center gap-1.5 font-semibold text-[#0A4B8F]">
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Aplikasi Teknisi · Android Mobile</span>
        </div>
        <span className="text-[11px] font-mono text-[#64748B]">390×844</span>
      </div>

      {/* Standalone Android App Container (full-bleed on mobile, crisp device frame on desktop) */}
      <div className="w-full md:max-w-[400px] min-h-screen md:min-h-0 md:h-[844px] bg-[#F8FAFC] md:rounded-[28px] md:border md:border-[#CBD5E1] md:shadow-xl flex flex-col overflow-hidden relative">
        {/* Android App Top Header Bar */}
        <header className="h-14 shrink-0 bg-white border-b border-[#E2E8F0] px-3 flex items-center justify-between gap-1.5 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4B8F]"
              aria-label="Beranda Aplikasi Teknisi"
            >
              <VisdatLogo compact className="h-6 w-auto" />
            </button>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#0A4B8F] leading-none truncate">
                Aplikasi Teknisi
              </span>
              <span className="block text-xs font-bold text-[#0F172A] truncate mt-0.5">
                {routeTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Compact Online / Offline Sync Mode Toggle (DEMO_MODE only) */}
            {DEMO_MODE && (
              <button
                type="button"
                onClick={onToggleNetwork}
                className={`h-8 px-2 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                  networkOnline
                    ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0A4B8F]'
                    : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                }`}
                aria-label={networkOnline ? 'Status online, ketuk untuk simulasi offline' : 'Mode offline, ketuk untuk pulihkan online'}
              >
                {networkOnline ? (
                  <Wifi className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <WifiOff className="w-3 h-3" aria-hidden="true" />
                )}
                <span className="hidden min-[360px]:inline">{networkOnline ? 'Online' : 'Offline'}</span>
              </button>
            )}

            {/* Notification Bell + Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifPopoverOpen((v) => !v)}
                className="relative w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0F172A]"
                aria-label="Notifikasi"
                aria-expanded={notifPopoverOpen}
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#E61E25] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notifPopoverOpen && (
                <div
                  ref={notifDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Daftar notifikasi"
                  tabIndex={-1}
                  className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-[#E2E8F0] shadow-lg p-3 z-50 space-y-2 focus:outline-none"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-bold text-[#0F172A]">
                      Notifikasi ({unreadNotificationsCount})
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onMarkAllNotificationsRead(session.user.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0A4B8F] hover:underline"
                        >
                          <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Tandai dibaca</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifPopoverOpen(false)}
                        className="text-[11px] font-semibold text-[#475569] hover:text-[#0F172A]"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#94A3B8] py-3 text-center">
                      Tidak ada notifikasi aktif.
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-2">
                      {notifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-lg border text-xs ${
                            n.is_read
                              ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'
                              : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0F172A]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate">{n.title}</span>
                            {!n.is_read && (
                              <button
                                type="button"
                                onClick={() => onMarkNotificationRead(n.id)}
                                className="text-[11px] font-semibold text-[#0A4B8F] hover:underline shrink-0"
                              >
                                Dibaca
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-[#475569] mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Avatar Trigger */}
            {canAccessRoute(session.role.code, 'profil_pengaturan') && (
              <button
                type="button"
                onClick={() => {
                  setNotifPopoverOpen(false);
                  onNavigate('profil_pengaturan');
                }}
                aria-label={`Profil ${session.user.full_name}`}
                className="w-8 h-8 rounded-lg bg-[#0A4B8F] text-white text-[11px] font-bold flex items-center justify-center shrink-0"
              >
                {userInitials}
              </button>
            )}

            {/* Reachable Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              aria-label="Keluar dari akun"
              className="h-8 px-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#E61E25] hover:bg-[#FEE2E2] text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Scrollable Mobile Workspace */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-20 md:pb-4">
          {children}
        </main>

        {/* Fixed Android Bottom Navigation Bar */}
        {(() => {
          const allNavItems: {
            id: RouteId;
            label: string;
            icon: typeof LayoutGrid;
            badge?: number;
          }[] = [
            { id: 'dashboard', label: 'Tugas', icon: LayoutGrid },
            { id: 'rekap_kehadiran', label: 'Absensi', icon: Clock },
            { id: 'peta_langsung', label: 'Lokasi', icon: MapPin },
            { id: 'antrean_audit', label: 'Antrean', icon: Flag, badge: outboxCount },
            { id: 'profil_pengaturan', label: 'Profil', icon: User },
          ];
          const navItems = allNavItems.filter((item) =>
            canAccessRoute(session.role.code, item.id)
          );
          const gridColsMap: Record<number, string> = {
            1: 'grid-cols-1',
            2: 'grid-cols-2',
            3: 'grid-cols-3',
            4: 'grid-cols-4',
            5: 'grid-cols-5',
          };
          const colsClass = gridColsMap[navItems.length] ?? 'grid-cols-5';
          return (
            <nav
              aria-label="Navigasi bawah teknisi"
              className={`fixed bottom-0 left-0 right-0 md:static h-16 shrink-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] grid ${colsClass} items-center px-1`}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setNotifPopoverOpen(false);
                      onNavigate(item.id);
                    }}
                    className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors ${
                      active ? 'text-[#0A4B8F]' : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="absolute top-1 right-3 px-1 min-w-[16px] h-4 rounded-full bg-[#E61E25] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          );
        })()}
      </div>
    </div>
  );
};
