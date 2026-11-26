import React, { useRef, useState } from 'react';
import { Bell, CheckCheck, Menu, ShieldAlert } from 'lucide-react';
import { ROUTE_BREADCRUMB_MAP, useSerpoStore } from '../../hooks/useSerpoStore';
import { canAccessRoute } from '../../utils/permissions';
import { BackofficeLoginView } from '../../components/BackofficeLoginView';
import { useDialogFocusTrap } from '../../components/Modal';
import { Sidebar } from '../../components/Sidebar';
import { MapsQuotaBanner } from '../../components/MapsQuotaBanner';
import { DashboardView } from '../../views/DashboardView';
import { TicketsViews } from '../../views/TicketsViews';
import { LocationViews } from '../../views/LocationViews';
import { AttendanceViews } from '../../views/AttendanceViews';
import { FinanceViews } from '../../views/FinanceViews';
import { AuditViews } from '../../views/AuditViews';
import { ProfileView } from '../../views/ProfileView';

export function BackofficeApp() {
  const store = useSerpoStore('backoffice');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const notifDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogFocusTrap({
    isOpen: notifPopoverOpen,
    containerRef: notifDialogRef,
    onClose: () => setNotifPopoverOpen(false),
  });

  if (!store.session) {
    return (
      <>
        <MapsQuotaBanner />
        <BackofficeLoginView onAuthenticate={store.handleAuthenticate} />
      </>
    );
  }

  const session = store.session;

  const onLogout = () => {
    setNotifPopoverOpen(false);
    setMobileMenuOpen(false);
    store.handleLogout();
  };

  const renderRoute = () => {
    if (!canAccessRoute(session.role.code, store.activeRoute)) {
      return (
        <section
          aria-label="Akses ditolak"
          className="bg-white rounded-xl border border-[#E2E8F0] p-8 max-w-lg mx-auto my-8 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#E61E25] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-[#0F172A]">Akses ditolak</h1>
            <p className="text-xs text-[#475569]">
              Peran <strong>{session.role.name}</strong> tidak memiliki izin untuk membuka halaman ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => store.handleNavigate('dashboard')}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </section>
      );
    }

    switch (store.activeRoute) {
      case 'dashboard':
        return (
          <DashboardView
            state={store.state}
            session={session}
            onNavigate={store.handleNavigate}
            onUpdateBudgetThreshold={store.handleUpdateBudgetThreshold}
            onMarkNotificationRead={store.handleMarkNotificationRead}
            onMarkAllNotificationsRead={store.handleMarkAllNotificationsRead}
            onUpdateTicket={store.handleUpdateTicket}
            onSubmitAttendance={store.handleSubmitAttendance}
          />
        );
      case 'tiket':
      case 'rekap_tiket':
        return (
          <TicketsViews
            mode={store.activeRoute}
            state={store.state}
            session={session}
            onUpdateTicket={store.handleUpdateTicket}
          />
        );
      case 'peta_langsung':
      case 'jejak_teknisi':
        return (
          <LocationViews
            mode={store.activeRoute}
            state={store.state}
            session={session}
            contextId={store.routeContextId}
            onNavigate={store.handleNavigate}
            onRecordLocationAccess={store.handleRecordLocationAccess}
            onIngestPings={store.handleIngestPings}
            onUpdateBasecampLocation={store.handleUpdateBasecampLocation}
          />
        );
      case 'rekap_kehadiran':
      case 'riwayat_absensi':
        return (
          <AttendanceViews
            mode={store.activeRoute}
            state={store.state}
            session={session}
            onSubmitAttendance={store.handleSubmitAttendance}
          />
        );
      case 'dana_pengajuan':
      case 'antrean_persetujuan':
      case 'riwayat_keputusan':
      case 'anggaran_area':
      case 'saldo_kas':
      case 'kas_basecamp':
      case 'buku_kas':
        return (
          <FinanceViews
            mode={store.activeRoute}
            state={store.state}
            session={session}
            contextId={store.routeContextId}
            onNavigate={store.handleNavigate}
            onSubmitFundRequest={store.handleSubmitFundRequest}
            onDecideFundRequest={store.handleDecideFundRequest}
            onRecordCashLedger={store.handleRecordCashLedger}
            onAddBudgetAllocation={store.handleAddBudgetAllocation}
            onProposeCorrection={store.handleProposeCorrection}
          />
        );
      case 'antrean_audit':
      case 'temuan_rekonsiliasi':
      case 'detail_temuan':
      case 'usulan_koreksi':
      case 'persetujuan_koreksi':
      case 'riwayat_run':
        return (
          <AuditViews
            mode={store.activeRoute}
            state={store.state}
            session={session}
            contextId={store.routeContextId}
            onNavigate={store.handleNavigate}
            onFlushOfflineOutbox={store.handleFlushOfflineOutbox}
            onResolveSyncAuditLog={store.handleResolveSyncAuditLog}
            onProposeCorrection={store.handleProposeCorrection}
            onMarkFalsePositive={store.handleMarkFalsePositive}
            onCorrectionDecision={store.handleCorrectionDecision}
            onRunManualReconciliation={store.handleRunManualReconciliation}
          />
        );
      case 'profil_pengaturan':
        return (
          <ProfileView
            session={session}
            state={store.state}
            onUpdateBudgetThreshold={store.handleUpdateBudgetThreshold}
            onResetDemoData={store.handleResetDemoData}
            onLogout={onLogout}
          />
        );
      default:
        return null;
    }
  };

  const userInitials = session.user.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <>
      <MapsQuotaBanner />
      <div className="min-h-screen bg-[#E2E8F0]/50 flex justify-center">
      <div className="w-full max-w-[1440px] min-h-screen bg-[#F8FAFC] flex shadow-xs">
        <Sidebar
          session={session}
          activeRoute={store.activeRoute}
          onNavigate={(route) => store.handleNavigate(route)}
          pendingApprovalCount={store.pendingApprovalCount}
          unresolvedAuditCount={store.unresolvedAuditCount}
          openFindingsCount={store.openFindingsCount}
          outboxCount={store.outboxCount}
          unreadNotificationsCount={store.unreadNotificationsCount}
          networkOnline={store.state.networkOnline}
          onToggleNetwork={store.handleToggleNetwork}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onLogout={onLogout}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Header Bar (Web Backoffice Desktop, <= 56px height) */}
          <header className="h-14 flex items-center justify-between gap-4 px-4 sm:px-8 bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#0F172A] hover:bg-[#F1F5F9]"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="font-display-italic text-[#0A4B8F] font-bold hidden sm:inline whitespace-nowrap">
                  SIM SERPO BACKOFFICE
                </span>
                <span className="text-[#CBD5E1] hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="font-semibold text-[#0F172A] truncate">
                  {ROUTE_BREADCRUMB_MAP[store.activeRoute]}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Notification Bell + Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifPopoverOpen((v) => !v)}
                  className="relative min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                  aria-label="Notifikasi"
                  aria-expanded={notifPopoverOpen}
                >
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  {store.unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E61E25] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {store.unreadNotificationsCount}
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
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-[#E2E8F0] shadow-lg p-3.5 z-50 space-y-2.5 focus:outline-none"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                      <span className="text-xs font-bold text-[#0F172A]">
                        Notifikasi ({store.unreadNotificationsCount} belum dibaca)
                      </span>
                      <div className="flex items-center gap-2.5">
                        {store.unreadNotificationsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => store.handleMarkAllNotificationsRead(session.user.id)}
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

                    {store.myNotifications.length === 0 ? (
                      <p className="text-xs text-[#94A3B8] py-4 text-center">
                        Tidak ada notifikasi aktif.
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {store.myNotifications.slice(0, 5).map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-lg border text-xs ${
                              n.is_read
                                ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'
                                : n.type === 'BUDGET_ALERT'
                                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#0F172A]'
                                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0F172A]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold truncate">{n.title}</span>
                              {!n.is_read && (
                                <button
                                  type="button"
                                  onClick={() => store.handleMarkNotificationRead(n.id)}
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

              {/* User Profile Trigger */}
              <button
                type="button"
                onClick={() => {
                  setNotifPopoverOpen(false);
                  store.handleNavigate('profil_pengaturan');
                }}
                className="min-h-[40px] inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors"
              >
                <span className="w-7 h-7 rounded-md bg-[#0A4B8F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {userInitials}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-xs font-semibold text-[#0F172A]">
                    {session.user.full_name}
                  </span>
                  <span className="block text-[10px] text-[#475569]">{session.role.name}</span>
                </span>
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-8 sm:py-6 overflow-x-hidden">
            {renderRoute()}
          </main>
        </div>
      </div>
    </div>
    </>
  );
}
