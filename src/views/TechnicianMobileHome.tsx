import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Play,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { ActiveSessionContext, RouteId, SerpoState, TicketPriority, TicketStatus } from '../types/serpo';
import {
  formatTimeWita,
  getLatestTrackForUser,
  haversineMeters,
  SubmitAttendanceInput,
  SubmitAttendanceResult,
} from '../utils/serpoLogic';
import { AttendanceConfirmModal } from '../components/AttendanceConfirmModal';
import { TicketPriorityBadge, TicketStatusBadge } from '../components/StatusText';

interface TechnicianMobileHomeProps {
  state: SerpoState;
  session: ActiveSessionContext;
  onNavigate: (route: RouteId) => void;
  onUpdateTicket: (
    ticketId: number,
    patch: { status?: TicketStatus; assigned_to?: number | null; note?: string }
  ) => { error?: string };
  onSubmitAttendance: (input: SubmitAttendanceInput) => SubmitAttendanceResult;
}

export const TechnicianMobileHome: React.FC<TechnicianMobileHomeProps> = ({
  state,
  session,
  onNavigate,
  onUpdateTicket,
  onSubmitAttendance,
}) => {
  const [taskFilter, setTaskFilter] = useState<'SEMUA' | 'PRIORITAS' | 'AKTIF' | 'SELESAI'>('SEMUA');
  const [shiftFeedback, setShiftFeedback] = useState<{ tone: 'green' | 'amber' | 'red'; text: string } | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const todayAttendance = useMemo(
    () =>
      state.attendances.find(
        (a) => a.user_id === session.user.id && a.work_date === state.currentDate
      ) ?? null,
    [state.attendances, session.user.id, state.currentDate]
  );

  const isShiftOpen = Boolean(todayAttendance && todayAttendance.check_out_time === null);
  const isShiftCompleted = Boolean(todayAttendance && todayAttendance.check_out_time !== null);

  const latestTrack = getLatestTrackForUser(state, session.user.id);
  const loc = session.attendanceLocation;
  const currentDistMeters =
    loc && todayAttendance
      ? haversineMeters(
          todayAttendance.check_in_lat,
          todayAttendance.check_in_lng,
          loc.lat,
          loc.lng
        )
      : loc && latestTrack
      ? haversineMeters(latestTrack.latitude, latestTrack.longitude, loc.lat, loc.lng)
      : null;

  const myTickets = useMemo(() => {
    const basecampTickets = state.tickets.filter(
      (t) =>
        t.assigned_to === session.user.id ||
        (session.basecamp && t.basecamp_id === session.basecamp.id && t.status !== 'CANCELLED')
    );
    const priorityRank: Record<TicketPriority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return [...basecampTickets].sort((a, b) => {
      const aMine = a.assigned_to === session.user.id ? 0 : 1;
      const bMine = b.assigned_to === session.user.id ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return priorityRank[a.priority] - priorityRank[b.priority];
    });
  }, [state.tickets, session.user.id, session.basecamp]);

  const filteredTasks = useMemo(() => {
    return myTickets.filter((t) => {
      if (taskFilter === 'PRIORITAS') {
        return (t.priority === 'CRITICAL' || t.priority === 'HIGH' || t.sla_breached) && t.status !== 'RESOLVED';
      }
      if (taskFilter === 'AKTIF') {
        return t.status === 'OPEN' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS';
      }
      if (taskFilter === 'SELESAI') {
        return t.status === 'RESOLVED';
      }
      return true;
    });
  }, [myTickets, taskFilter]);

  const urgentTaskCount = myTickets.filter(
    (t) => t.status !== 'RESOLVED' && (t.priority === 'CRITICAL' || t.priority === 'HIGH' || t.sla_breached)
  ).length;
  const activeTaskCount = myTickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CANCELLED').length;
  const resolvedTaskCount = myTickets.filter((t) => t.status === 'RESOLVED').length;

  const handleQuickAttendance = () => {
    setShiftFeedback(null);
    setConfirmModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Technician Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[#0A4B8F] uppercase tracking-wider">
            Aplikasi Teknisi · {session.basecamp?.name ?? 'Lapangan'}
          </p>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#0F172A] mt-0.5">
            Halo, {session.user.full_name}
          </h1>
          <p className="text-xs text-[#475569]">
            {session.technicianProfile?.employee_no ?? 'Teknisi Lapangan'} · {session.area?.name ?? 'Sulawesi Barat'}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('rekap_kehadiran')}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
          >
            <Camera className="w-3.5 h-3.5 text-[#0A4B8F]" aria-hidden="true" />
            <span>Selfie Absensi</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('peta_langsung')}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pelacakan Langsung</span>
          </button>
        </div>
      </div>

      {/* Main 2-column grid on desktop, crisp stacked Android Home layout on 390px mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Top Column: Active Shift Status Card */}
        <section className="lg:col-span-4 space-y-4">
          <div className="relative overflow-hidden bg-[#0A4B8F] text-white rounded-xl p-5 border border-[#083C73]">
            {/* Geometric V-accent line */}
            <svg
              viewBox="0 0 360 140"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="210,0 360,0 360,140 280,140" fill="#062E59" />
              <polyline points="230,0 295,110 360,0" fill="none" stroke="#E61E25" strokeWidth="4" />
            </svg>

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    Status Shift Aktif
                  </span>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    {isShiftOpen
                      ? 'Shift Berjalan (Online)'
                      : isShiftCompleted
                      ? 'Shift Hari Ini Selesai'
                      : 'Belum Absen Masuk'}
                  </h2>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                    isShiftOpen
                      ? 'bg-[#10B981] text-white'
                      : isShiftCompleted
                      ? 'bg-white/20 text-white'
                      : 'bg-[#E61E25] text-white'
                  }`}
                >
                  {isShiftOpen ? 'Aktif' : isShiftCompleted ? 'Selesai' : 'Belum Tugas'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15 text-xs">
                <div>
                  <span className="text-white/75 block">Absen Masuk</span>
                  <span className="font-mono font-semibold text-sm text-white tabular-nums">
                    {todayAttendance ? `${formatTimeWita(todayAttendance.check_in_time)} WITA` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-white/75 block">Jarak dari titik absen</span>
                  <span className="font-mono font-semibold text-sm text-white tabular-nums">
                    {currentDistMeters !== null ? `${currentDistMeters} m` : `radius ${loc?.radius ?? 200} m`}
                  </span>
                </div>
              </div>

              {todayAttendance?.verification_status === 'FLAGGED' && (
                <div className="px-3 py-2 rounded-lg bg-white/10 border border-[#F59E0B]/45 text-amber-100 text-[11px] font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#FBBF24] shrink-0" aria-hidden="true" />
                  <span>Absen masuk perlu tinjauan (di luar radius {loc?.radius ?? 200} m).</span>
                </div>
              )}

              {!isShiftCompleted && (
                <button
                  type="button"
                  onClick={handleQuickAttendance}
                  className="w-full min-h-[44px] rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-colors bg-white text-[#0A4B8F] hover:bg-[#EFF6FF]"
                >
                  <Clock
                    className={`w-4 h-4 ${isShiftOpen ? 'text-[#E61E25]' : 'text-[#0A4B8F]'}`}
                    aria-hidden="true"
                  />
                  <span>{isShiftOpen ? 'Absen Pulang Sekarang' : 'Absen Masuk Sekarang'}</span>
                </button>
              )}
            </div>
          </div>

          {shiftFeedback && (
            <div
              role="status"
              className={`p-3 rounded-xl border text-xs font-medium ${
                shiftFeedback.tone === 'green'
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
                  : shiftFeedback.tone === 'amber'
                  ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#E61E25]'
              }`}
            >
              {shiftFeedback.text}
            </div>
          )}

          {/* Compact Technician Metric Strip */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
              <span className="text-[11px] text-[#475569] block">Tugas Aktif</span>
              <span className="text-xl font-bold text-[#0F172A] tabular-nums mt-1 block">
                {activeTaskCount}
              </span>
            </div>
            <div className="bg-white rounded-xl border border-[#FECACA] p-3">
              <span className="text-[11px] text-[#E61E25] font-semibold block">Mendesak</span>
              <span className="text-xl font-bold text-[#E61E25] tabular-nums mt-1 block">
                {urgentTaskCount}
              </span>
            </div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
              <span className="text-[11px] text-[#475569] block">Selesai</span>
              <span className="text-xl font-bold text-[#10B981] tabular-nums mt-1 block">
                {resolvedTaskCount}
              </span>
            </div>
          </div>
        </section>

        {/* Right/Bottom Column: Field Task Cards with Priority Tags & Quick Actions */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Daftar Tugas Lapangan</h2>
              <p className="text-xs text-[#475569]">
                Tiket gangguan ODP & pemeliharaan yang ditugaskan ke Anda atau Basecamp {session.basecamp?.name ?? ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tiket')}
              className="text-xs font-semibold text-[#0A4B8F] hover:underline whitespace-nowrap"
            >
              Semua tiket →
            </button>
          </div>

          {/* Filter Chips: single-row with horizontal scroll on narrow mobile */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1"
            role="tablist"
            aria-label="Filter tugas teknisi"
          >
            {[
              { id: 'SEMUA', label: `Semua (${myTickets.length})` },
              { id: 'PRIORITAS', label: `Prioritas Tinggi (${urgentTaskCount})` },
              { id: 'AKTIF', label: `Aktif (${activeTaskCount})` },
              { id: 'SELESAI', label: `Selesai (${resolvedTaskCount})` },
            ].map((tab) => {
              const active = taskFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTaskFilter(tab.id as typeof taskFilter)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0A4B8F] text-white'
                      : 'bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {taskError && (
            <div
              role="alert"
              className="p-3 rounded-xl border bg-[#FEF2F2] border-[#FECACA] text-[#E61E25] text-xs font-medium"
            >
              {taskError}
            </div>
          )}

          {/* Task Cards */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
              <Wrench className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#0F172A]">Tidak ada tugas pada filter ini</p>
              <p className="text-xs text-[#475569] mt-1">
                Pilih filter lain atau buka daftar lengkap tiket operasional.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((ticket) => {
                const bc = state.basecamps.find((b) => b.id === ticket.basecamp_id);
                const assignee = state.users.find((u) => u.id === ticket.assigned_to);
                const isUrgent =
                  ticket.status !== 'RESOLVED' &&
                  (ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH' || ticket.sla_breached);
                return (
                  <article
                    key={ticket.id}
                    className={`bg-white rounded-xl border p-4 transition-colors ${
                      isUrgent ? 'border-[#FECACA]' : 'border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#0A4B8F]">
                          {ticket.ticket_no}
                        </span>
                        <TicketPriorityBadge
                          priority={ticket.priority}
                          slaBreached={ticket.sla_breached}
                        />
                      </div>
                      <TicketStatusBadge status={ticket.status} />
                    </div>

                    <h3 className="text-sm font-bold text-[#0F172A] mt-2 leading-snug">
                      {ticket.title}
                    </h3>
                    <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                      {ticket.description}
                    </p>

                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
                          <span>{bc?.name}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">Umur {ticket.age_hours} jam</span>
                        {assignee && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{assignee.id === session.user.id ? 'Ditugaskan ke Anda' : assignee.full_name}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {ticket.assigned_to === session.user.id &&
                          (ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextStatus: TicketStatus =
                                  ticket.status === 'OPEN' ? 'ASSIGNED' : 'IN_PROGRESS';
                                const res = onUpdateTicket(ticket.id, {
                                  status: nextStatus,
                                  note:
                                    ticket.status === 'OPEN'
                                      ? `Tugas diterima oleh ${session.user.full_name}`
                                      : `Dikerjakan di lapangan oleh ${session.user.full_name}`,
                                });
                                if (res.error) setTaskError(res.error);
                                else setTaskError(null);
                              }}
                              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {ticket.status === 'OPEN' ? 'Terima Tugas' : 'Mulai Kerjakan'}
                              </span>
                            </button>
                          )}
                        {ticket.assigned_to === session.user.id &&
                          ticket.status === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = onUpdateTicket(ticket.id, {
                                  status: 'RESOLVED',
                                  note: `Diselesaikan oleh ${session.user.full_name}`,
                                });
                                if (res.error) setTaskError(res.error);
                                else setTaskError(null);
                              }}
                              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Selesaikan</span>
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => onNavigate('tiket')}
                          className="min-h-[40px] px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AttendanceConfirmModal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        selection={isShiftOpen ? 'CHECK_OUT' : 'CHECK_IN'}
        state={state}
        session={session}
        onSubmitAttendance={onSubmitAttendance}
        onSuccessFeedback={setShiftFeedback}
      />
    </div>
  );
};
