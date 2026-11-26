import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { ROUTE_BREADCRUMB_MAP, useSerpoStore } from '../../hooks/useSerpoStore';
import { canAccessRoute } from '../../utils/permissions';
import { TeknisiLoginView } from '../../components/TeknisiLoginView';
import { TechnicianMobileShell } from '../../components/TechnicianMobileShell';
import { MapsQuotaBanner } from '../../components/MapsQuotaBanner';
import { DashboardView } from '../../views/DashboardView';
import { TicketsViews } from '../../views/TicketsViews';
import { LocationViews } from '../../views/LocationViews';
import { AttendanceViews } from '../../views/AttendanceViews';
import { AuditViews } from '../../views/AuditViews';
import { ProfileView } from '../../views/ProfileView';

export function TeknisiApp() {
  const store = useSerpoStore('teknisi');

  if (!store.session) {
    return (
      <>
        <MapsQuotaBanner />
        <TeknisiLoginView onAuthenticate={store.handleAuthenticate} />
      </>
    );
  }

  const session = store.session;

  const renderRoute = () => {
    if (!canAccessRoute(session.role.code, store.activeRoute)) {
      return (
        <section
          aria-label="Akses ditolak"
          className="bg-white rounded-xl border border-[#E2E8F0] p-6 my-6 text-center space-y-3"
        >
          <div className="w-11 h-11 rounded-full bg-[#FEF2F2] text-[#E61E25] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-[#0F172A]">Akses ditolak</h1>
            <p className="text-xs text-[#475569]">
              Halaman ini tidak tersedia untuk akun Teknisi lapangan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => store.handleNavigate('dashboard')}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors"
          >
            Kembali ke Tugas
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
        return (
          <TicketsViews
            mode="tiket"
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
      case 'antrean_audit':
        return (
          <AuditViews
            mode="antrean_audit"
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
            onLogout={store.handleLogout}
          />
        );
      default:
        return null;
    }
  };

  const routeTitle =
    store.activeRoute === 'dashboard'
      ? 'Tugas & Shift'
      : ROUTE_BREADCRUMB_MAP[store.activeRoute];

  return (
    <>
      <MapsQuotaBanner />
      <TechnicianMobileShell
        session={session}
        activeRoute={store.activeRoute}
        routeTitle={routeTitle}
        outboxCount={store.outboxCount}
        unreadNotificationsCount={store.unreadNotificationsCount}
        notifications={store.myNotifications}
        networkOnline={store.state.networkOnline}
        onToggleNetwork={store.handleToggleNetwork}
        onNavigate={(route) => store.handleNavigate(route)}
        onMarkNotificationRead={store.handleMarkNotificationRead}
        onMarkAllNotificationsRead={store.handleMarkAllNotificationsRead}
        onLogout={store.handleLogout}
      >
        {renderRoute()}
      </TechnicianMobileShell>
    </>
  );
}
