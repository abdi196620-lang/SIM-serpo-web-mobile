import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
  Ticket as TicketIcon,
  Users,
  X,
} from 'lucide-react';
import {
  ActiveSessionContext,
  RouteId,
  SerpoState,
  TicketPriority,
  TicketStatus,
} from '../types/serpo';
import {
  computeDashboardTicketKpis,
  computeTicketChartByBasecamp,
  formatJuta,
  formatPercent,
  formatRupiah,
  formatTimeWita,
  getAreaBudgetStatus,
  getBasecampBalance,
  getBudgetAbsorptionPct,
  getLatestTrackForUser,
  getPendingApprovalsForUser,
} from '../utils/serpoLogic';
import { Modal } from '../components/Modal';
import {
  BudgetMeter,
  downloadCsv,
  getTicketStatusLabel,
  PageHeader,
  StatusLabel,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '../components/StatusText';
import { TechnicianMobileHome } from './TechnicianMobileHome';
import { SubmitAttendanceInput, SubmitAttendanceResult } from '../utils/serpoLogic';
import { can } from '../utils/permissions';

interface DashboardViewProps {
  state: SerpoState;
  session: ActiveSessionContext;
  onNavigate: (route: RouteId, contextId?: string) => void;
  onUpdateBudgetThreshold: (budgetId: number, thresholdPct: number) => { error?: string };
  onMarkNotificationRead: (notificationId: number) => void;
  onMarkAllNotificationsRead: (userId: number) => void;
  onUpdateTicket: (
    ticketId: number,
    patch: { status?: TicketStatus; assigned_to?: number | null; note?: string }
  ) => { error?: string };
  onSubmitAttendance: (input: SubmitAttendanceInput) => SubmitAttendanceResult;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  session,
  onNavigate,
  onUpdateBudgetThreshold,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onUpdateTicket,
  onSubmitAttendance,
}) => {
  const [selectedAreaId, setSelectedAreaId] = useState<number | 'all'>('all');
  const [thresholdModalBudgetId, setThresholdModalBudgetId] = useState<number | null>(null);
  const [draftThreshold, setDraftThreshold] = useState<string>('90');
  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'ALL' | 'URGENT' | TicketStatus>('ALL');
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [ticketActionError, setTicketActionError] = useState<string | null>(null);

  const canEditBudget = can(session.role.code, 'budget.setThreshold');
  const canUpdateAnyTicket = can(session.role.code, 'ticket.update');

  const visibleBudgets = useMemo(
    () =>
      selectedAreaId === 'all'
        ? state.budgets
        : state.budgets.filter((b) => b.area_id === selectedAreaId),
    [state.budgets, selectedAreaId]
  );

  const visibleBasecamps = useMemo(
    () =>
      selectedAreaId === 'all'
        ? state.basecamps
        : state.basecamps.filter((bc) => bc.area_id === selectedAreaId),
    [state.basecamps, selectedAreaId]
  );

  const totalAllocated = visibleBudgets.reduce((s, b) => s + b.allocated_amount, 0);
  const totalRealized = visibleBudgets.reduce((s, b) => s + b.realized_amount, 0);
  const overallAbsorptionPct = getBudgetAbsorptionPct(totalRealized, totalAllocated);
  const alertBudgets = visibleBudgets.filter((b) => getAreaBudgetStatus(b) === 'ALERT');

  const todayAttendances = state.attendances.filter((a) => a.work_date === state.currentDate);
  const openAttendanceCount = todayAttendances.filter((a) => a.check_out_time === null).length;
  const activeUsers = state.users.filter((u) => u.status === 'ACTIVE');
  const techActiveCount = activeUsers.filter((u) => u.role_id === 1).length;

  const visibleTicketPool = useMemo(() => {
    const bcIds = new Set(visibleBasecamps.map((b) => b.id));
    return state.tickets.filter((t) => bcIds.has(t.basecamp_id));
  }, [state.tickets, visibleBasecamps]);

  const ticketKpis = useMemo(
    () => computeDashboardTicketKpis(visibleTicketPool),
    [visibleTicketPool]
  );

  const chartSeries = useMemo(() => computeTicketChartByBasecamp(state), [state]);
  const maxChartTotal = Math.max(1, ...chartSeries.map((c) => c.totalCount));

  const filteredTableTickets = useMemo(() => {
    const q = ticketQuery.trim().toLowerCase();
    return visibleTicketPool.filter((t) => {
      if (ticketFilter === 'URGENT') {
        const isUrgent =
          t.status !== 'RESOLVED' &&
          (t.priority === 'CRITICAL' || t.priority === 'HIGH' || t.sla_breached);
        if (!isUrgent) return false;
      } else if (ticketFilter !== 'ALL' && t.status !== ticketFilter) {
        return false;
      }
      if (!q) return true;
      const bc = state.basecamps.find((b) => b.id === t.basecamp_id)?.name ?? '';
      const assignee = state.users.find((u) => u.id === t.assigned_to)?.full_name ?? '';
      return (
        t.ticket_no.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        bc.toLowerCase().includes(q) ||
        assignee.toLowerCase().includes(q)
      );
    });
  }, [visibleTicketPool, ticketFilter, ticketQuery, state.basecamps, state.users]);

  const myNotifications = useMemo(
    () =>
      state.notifications
        .filter((n) => n.user_id === session.user.id)
        .sort((a, b) => (a.is_read === b.is_read ? 0 : a.is_read ? 1 : -1)),
    [state.notifications, session.user.id]
  );
  const unreadCount = myNotifications.filter((n) => !n.is_read).length;

  const handleExport = () => {
    downloadCsv(
      'sim-serpo-anggaran-area.csv',
      ['Area', 'Periode', 'Alokasi (Rp)', 'Realisasi (Rp)', 'Serapan (%)', 'Ambang Peringatan (%)', 'Status'],
      visibleBudgets.map((b) => {
        const area = state.areas.find((a) => a.id === b.area_id);
        return [
          area?.name ?? b.area_id,
          b.period_label,
          b.allocated_amount,
          b.realized_amount,
          formatPercent(getBudgetAbsorptionPct(b.realized_amount, b.allocated_amount)),
          formatPercent(b.alert_threshold, 0),
          getAreaBudgetStatus(b) === 'ALERT' ? 'Waspada' : 'Normal',
        ];
      })
    );
  };

  const myPendingApprovals = getPendingApprovalsForUser(state, session.user.id);

  // Technician gets dedicated field home with Active Shift Status + Priority Task Cards
  if (session.role.code === 'TEKNISI') {
    return (
      <TechnicianMobileHome
        state={state}
        session={session}
        onNavigate={onNavigate}
        onUpdateTicket={onUpdateTicket}
        onSubmitAttendance={onSubmitAttendance}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Operasional"
        subtitle="Pantauan operasional lapangan, SLA tiket, teknisi aktif, dan anggaran area VISDAT TEKNIK UTAMA"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {myPendingApprovals.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('antrean_persetujuan')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <span>Persetujuan Tertunda ({myPendingApprovals.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9] transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#0A4B8F]" aria-hidden="true" />
              <span>Ekspor Anggaran</span>
            </button>
          </div>
        }
      />

      {/* Area Alert Banner */}
      {alertBudgets.map((b) => {
        const area = state.areas.find((a) => a.id === b.area_id);
        const pct = getBudgetAbsorptionPct(b.realized_amount, b.allocated_amount);
        return (
          <div
            key={b.id}
            role="alert"
            className="px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#E61E25] flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>Peringatan Anggaran · {area?.name}:</strong> Serapan{' '}
                <span className="font-mono font-bold">{formatPercent(pct)}</span> ({formatRupiah(b.realized_amount)} /{' '}
                {formatRupiah(b.allocated_amount)}) telah melewati ambang{' '}
                <span className="font-mono">{formatPercent(b.alert_threshold, 0)}</span>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('anggaran_area')}
              className="font-semibold underline whitespace-nowrap"
            >
              Tinjau anggaran area
            </button>
          </div>
        );
      })}

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#475569]">Area Wilayah</span>
          <select
            value={selectedAreaId}
            onChange={(e) =>
              setSelectedAreaId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="all">Semua area ({state.areas.length})</option>
            {state.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#475569]">Periode berjalan</span>
          <span className="font-semibold text-[#0F172A]">November 2026</span>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#475569]">Personel aktif</span>
          <span className="font-semibold text-[#0F172A] tabular-nums">
            {activeUsers.length} akun ({techActiveCount} Teknisi)
          </span>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('tiket')}
          className="bg-white rounded-xl border border-[#E2E8F0] p-5 text-left hover:border-[#0A4B8F]/60 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#475569]">Total Tiket</span>
            <span className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#0A4B8F] flex items-center justify-center shrink-0">
              <TicketIcon className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#0F172A] tabular-nums">
            {ticketKpis.totalTickets}
          </p>
          <p className="mt-1.5 text-xs text-[#475569] tabular-nums">
            {ticketKpis.openCount} {getTicketStatusLabel('OPEN')} · {ticketKpis.assignedCount}{' '}
            {getTicketStatusLabel('ASSIGNED')} · {ticketKpis.inProgressCount}{' '}
            {getTicketStatusLabel('IN_PROGRESS')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('rekap_kehadiran')}
          className="bg-white rounded-xl border border-[#E2E8F0] p-5 text-left hover:border-[#0A4B8F]/60 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#475569]">Teknisi Aktif di Lapangan</span>
            <span className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#0A4B8F] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#0F172A] tabular-nums">
              {openAttendanceCount}
            </span>
            <span className="text-sm font-medium text-[#94A3B8] tabular-nums">
              / {techActiveCount} teknisi
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#475569] tabular-nums">
            {state.locationTracks.length} pembaruan lokasi · absensi aktif
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('rekap_tiket')}
          className="bg-white rounded-xl border border-[#E2E8F0] p-5 text-left hover:border-[#10B981]/60 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#475569]">Kepatuhan SLA</span>
            <span className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#047857] tabular-nums">
            {formatPercent(ticketKpis.slaCompliancePct)}
          </p>
          <p className="mt-1.5 text-xs text-[#475569] tabular-nums">
            {ticketKpis.resolvedCount} tiket {getTicketStatusLabel('RESOLVED').toLowerCase()} · {ticketKpis.breachedCount} melewati SLA
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTicketFilter((prev) => (prev === 'URGENT' ? 'ALL' : 'URGENT'))}
          className={`rounded-xl border p-5 text-left transition-colors ${
            ticketFilter === 'URGENT'
              ? 'bg-[#FEF2F2] border-[#E61E25] ring-1 ring-[#E61E25]'
              : 'bg-white border-[#FECACA] hover:border-[#E61E25]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#E61E25]">Isu Mendesak</span>
            <span className="w-8 h-8 rounded-lg bg-[#E61E25] text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#E61E25] tabular-nums">
            {ticketKpis.urgentIssuesCount}
          </p>
          <p className="mt-1.5 text-xs font-medium text-[#E61E25]/85">
            Prioritas Kritis / Tinggi / Lewat SLA · Klik untuk filter
          </p>
        </button>
      </div>

      {/* Middle Row: Data Visualization Chart (#0A4B8F & #E61E25) + Budgets Serapan Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Clean SVG Data Visualization Chart using #0A4B8F and #E61E25 */}
        <section className="xl:col-span-7 bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Distribusi Beban Tiket & Isu Mendesak per Basecamp
              </h2>
              <p className="text-xs text-[#475569] mt-0.5">
                Perbandingan volume tiket reguler dan isu kritis serta pelanggaran SLA per basecamp
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#475569]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0A4B8F]" aria-hidden="true" />
                <span>Tiket Reguler</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#E61E25]" aria-hidden="true" />
                <span>Mendesak / Lewat SLA</span>
              </span>
            </div>
          </div>

          <div className="relative w-full overflow-x-auto">
            {(() => {
              const chartWidth = Math.max(600, chartSeries.length * 86 + 60);
              const plotWidth = chartWidth - 68;
              const groupWidth = plotWidth / Math.max(1, chartSeries.length);
              return (
                <svg
                  viewBox={`0 0 ${chartWidth} 230`}
                  className="w-full h-[220px]"
                  style={{ minWidth: `${chartWidth}px` }}
                  role="img"
                  aria-label="Grafik batang beban tiket reguler dan urgent per basecamp"
                >
                  {/* Horizontal Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 185 - ratio * 150;
                    const val = Math.round(ratio * maxChartTotal * 10) / 10;
                    return (
                      <g key={idx}>
                        <line
                          x1="38"
                          y1={y}
                          x2={chartWidth - 15}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray={ratio === 0 ? undefined : '3 3'}
                        />
                        <text
                          x="28"
                          y={y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="#94A3B8"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {Number.isInteger(val) ? val : ''}
                        </text>
                      </g>
                    );
                  })}

                  {/* Grouped Bars per Basecamp */}
                  {chartSeries.map((d, i) => {
                    const cx = 48 + i * groupWidth + groupWidth / 2;
                    const stdHeight = (d.standardCount / maxChartTotal) * 150;
                    const urgHeight = (d.urgentCount / maxChartTotal) * 150;
                    const isHovered = hoveredChartIdx === i;

                return (
                  <g
                    key={d.label}
                    onMouseEnter={() => setHoveredChartIdx(i)}
                    onMouseLeave={() => setHoveredChartIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <rect
                        x={cx - 32}
                        y={28}
                        width={64}
                        height={157}
                        rx="6"
                        fill="#F8FAFC"
                      />
                    )}
                    {/* Standard Tickets Bar (#0A4B8F) */}
                    <rect
                      x={cx - 22}
                      y={185 - (d.standardCount > 0 ? Math.max(4, stdHeight) : 0)}
                      width={20}
                      height={d.standardCount > 0 ? Math.max(4, stdHeight) : 0}
                      rx="4"
                      fill="#0A4B8F"
                    />
                    {/* Urgent / Breached Bar (#E61E25) */}
                    <rect
                      x={cx + 2}
                      y={185 - (d.urgentCount > 0 ? Math.max(4, urgHeight) : 0)}
                      width={20}
                      height={d.urgentCount > 0 ? Math.max(4, urgHeight) : 0}
                      rx="4"
                      fill="#E61E25"
                    />
                    {/* Value labels */}
                    {d.standardCount > 0 && (
                      <text
                        x={cx - 12}
                        y={185 - Math.max(4, stdHeight) - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill="#0A4B8F"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {d.standardCount}
                      </text>
                    )}
                    {d.urgentCount > 0 && (
                      <text
                        x={cx + 12}
                        y={185 - Math.max(4, urgHeight) - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#E61E25"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {d.urgentCount}
                      </text>
                    )}
                    {/* X-axis label */}
                    <text
                      x={cx}
                      y={205}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isHovered ? '700' : '500'}
                      fill={isHovered ? '#0F172A' : '#475569'}
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
              );
            })()}
          </div>

          <div className="mt-2 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
            <span>
              {hoveredChartIdx !== null && chartSeries[hoveredChartIdx]
                ? `${chartSeries[hoveredChartIdx].label}: ${chartSeries[hoveredChartIdx].totalCount} total tiket (${chartSeries[hoveredChartIdx].urgentCount} mendesak)`
                : 'Arahkan kursor ke batang grafik untuk detail per basecamp'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('rekap_tiket')}
              className="font-semibold text-[#0A4B8F] hover:underline"
            >
              Rekap tiket lengkap →
            </button>
          </div>
        </section>

        {/* Area Budgets Summary Card */}
        <section className="xl:col-span-5 bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#475569]">
                  Realisasi Anggaran Area
                </p>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-base font-semibold text-[#475569]">Rp</span>
                  <span className="text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">
                    {formatJuta(totalRealized, 2)}
                  </span>
                  <span className="text-base font-semibold text-[#475569]">juta</span>
                </div>
                <p className="mt-1 text-xs text-[#475569] tabular-nums">
                  {formatPercent(overallAbsorptionPct)} dari alokasi Rp {formatJuta(totalAllocated, 1)} juta · Sisa Rp{' '}
                  {formatJuta(totalAllocated - totalRealized, 2)} juta
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('anggaran_area')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A4B8F] hover:underline whitespace-nowrap"
              >
                <span>Detail</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3 pt-4 border-t border-[#E2E8F0]">
              {visibleBudgets.map((b) => {
                const area = state.areas.find((a) => a.id === b.area_id);
                const pct = getBudgetAbsorptionPct(b.realized_amount, b.allocated_amount);
                const status = getAreaBudgetStatus(b);
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-semibold text-[#0F172A]">{area?.name}</span>
                        {status === 'ALERT' ? (
                          <StatusLabel tone="red" icon="error" label="Waspada" />
                        ) : (
                          <StatusLabel tone="green" icon="check" label="Normal" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-[#475569] tabular-nums">
                          {formatRupiah(b.realized_amount)} / {formatRupiah(b.allocated_amount)}
                        </span>
                        {canEditBudget && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftThreshold(String(b.alert_threshold));
                              setThresholdError(null);
                              setThresholdModalBudgetId(b.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0A4B8F] hover:underline"
                          >
                            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                            <span>Ubah</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <BudgetMeter
                      pct={pct}
                      warningThresholdPct={b.alert_threshold}
                      status={status === 'ALERT' ? 'Melebihi budget' : pct >= 80 ? 'Waspada' : 'Aman'}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#475569]">
            <span>Saldo kas: Rp {formatJuta(visibleBasecamps.reduce((s, bc) => s + getBasecampBalance(state, bc.id), 0), 2)} jt</span>
            <button
              type="button"
              onClick={() => onNavigate('buku_kas')}
              className="font-semibold text-[#0A4B8F] hover:underline"
            >
              Buku Kas →
            </button>
          </div>
        </section>
      </div>

      {/* Interactive Ticket Status Table */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Status Tiket Operasional</h2>
            <p className="text-xs text-[#475569]">
              Pantau tiket gangguan jaringan, filter urgensi SLA, dan perbarui status secara langsung
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={ticketQuery}
                onChange={(e) => setTicketQuery(e.target.value)}
                placeholder="Cari tiket / basecamp / teknisi..."
                aria-label="Cari tiket operasional"
                className="h-9 pl-8 pr-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A4B8F] focus:bg-white w-56"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'URGENT', label: 'Mendesak' },
                  { id: 'OPEN', label: getTicketStatusLabel('OPEN') },
                  { id: 'IN_PROGRESS', label: getTicketStatusLabel('IN_PROGRESS') },
                  { id: 'RESOLVED', label: getTicketStatusLabel('RESOLVED') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTicketFilter(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    ticketFilter === tab.id
                      ? tab.id === 'URGENT'
                        ? 'bg-[#E61E25] text-white'
                        : 'bg-[#0A4B8F] text-white'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {ticketActionError && (
          <div
            role="alert"
            className="mx-5 mt-3 px-3.5 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#E61E25]"
          >
            {ticketActionError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#475569]">
                <th className="py-2.5 px-5">No. Tiket</th>
                <th className="py-2.5 px-4">Gangguan / Pekerjaan</th>
                <th className="py-2.5 px-4">Basecamp</th>
                <th className="py-2.5 px-4">Teknisi</th>
                <th className="py-2.5 px-4">Prioritas</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {filteredTableTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                    Tidak ada tiket yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredTableTickets.slice(0, 8).map((t) => {
                  const bc = state.basecamps.find((b) => b.id === t.basecamp_id);
                  const tech = state.users.find((u) => u.id === t.assigned_to);
                  return (
                    <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-5 font-mono font-semibold text-[#0A4B8F] whitespace-nowrap">
                        {t.ticket_no}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-semibold text-[#0F172A] block truncate">{t.title}</span>
                        <span className="text-[11px] text-[#94A3B8] tabular-nums">
                          Umur {t.age_hours} jam
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#475569] whitespace-nowrap">{bc?.name}</td>
                      <td className="py-3 px-4 text-[#0F172A] whitespace-nowrap">
                        {tech ? tech.full_name : <span className="text-[#94A3B8]">Belum ditugaskan</span>}
                      </td>
                      <td className="py-3 px-4">
                        <TicketPriorityBadge priority={t.priority} slaBreached={t.sla_breached} />
                      </td>
                      <td className="py-3 px-4">
                        <TicketStatusBadge status={t.status} />
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {canUpdateAnyTicket &&
                            t.status !== 'RESOLVED' &&
                            t.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextStatus: TicketStatus =
                                    t.status === 'OPEN'
                                      ? 'ASSIGNED'
                                      : t.status === 'ASSIGNED'
                                      ? 'IN_PROGRESS'
                                      : 'RESOLVED';
                                  const res = onUpdateTicket(t.id, {
                                    status: nextStatus,
                                    note:
                                      t.status === 'OPEN'
                                        ? 'Ditugaskan dari ringkasan dashboard'
                                        : t.status === 'ASSIGNED'
                                        ? 'Diproses oleh tim operasional'
                                        : 'Diselesaikan dari ringkasan dashboard',
                                  });
                                  if (res.error) setTicketActionError(res.error);
                                  else setTicketActionError(null);
                                }}
                                className="font-semibold text-[#0A4B8F] hover:underline"
                              >
                                {t.status === 'OPEN'
                                  ? 'Tugaskan'
                                  : t.status === 'ASSIGNED'
                                  ? 'Proses'
                                  : 'Selesaikan'}
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => onNavigate('tiket')}
                            className="font-semibold text-[#475569] hover:text-[#0F172A] hover:underline"
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom 2-column row: Notifications + Basecamp Cash & Latest Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Notifications (D7) */}
        <section className="lg:col-span-6 bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#0A4B8F]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#0F172A]">Notifikasi ({session.role.name})</h2>
                <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-xs font-bold text-[#0F172A] tabular-nums">
                  {unreadCount} belum dibaca
                </span>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkAllNotificationsRead(session.user.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A4B8F] hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tandai semua dibaca</span>
                </button>
              )}
            </div>

            {myNotifications.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-6 text-center">
                Belum ada notifikasi untuk akun {session.user.full_name}.
              </p>
            ) : (
              <div className="space-y-2.5">
                {myNotifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                      n.is_read
                        ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'
                        : n.type === 'BUDGET_ALERT'
                        ? 'bg-[#FEF2F2] border-[#FECACA] text-[#0F172A]'
                        : 'bg-[#EFF6FF]/60 border-[#BFDBFE] text-[#0F172A]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusLabel
                          tone={
                            n.type === 'BUDGET_ALERT'
                              ? 'red'
                              : n.type === 'SYNC_FLAGGED'
                              ? 'amber'
                              : 'green'
                          }
                          label={
                            n.type === 'BUDGET_ALERT'
                              ? 'Peringatan Anggaran'
                              : n.type === 'SYNC_FLAGGED'
                              ? 'Perlu Tinjauan'
                              : 'Informasi'
                          }
                        />
                        <span className="font-semibold">{n.title}</span>
                      </div>
                      <p className="text-[#475569]">{n.message}</p>
                      <span className="block text-[11px] font-mono text-[#94A3B8]">
                        {formatTimeWita(n.created_at)} WITA
                      </span>
                    </div>
                    {!n.is_read ? (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] text-[11px] font-semibold text-[#0A4B8F] hover:bg-[#EFF6FF] shrink-0"
                      >
                        Dibaca
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8] shrink-0">Dibaca</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Basecamp Cash Balances & Latest Location Tracks */}
        <section className="lg:col-span-6 bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-[#0F172A]">
                Saldo Basecamp & posisi terbaru teknisi
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('peta_langsung')}
                className="text-xs font-semibold text-[#0A4B8F] hover:underline"
              >
                Buka peta
              </button>
            </div>
            <div className="divide-y divide-[#E2E8F0] text-xs">
              {visibleBasecamps.slice(0, 5).map((bc) => {
                const bal = getBasecampBalance(state, bc.id);
                const area = state.areas.find((a) => a.id === bc.area_id);
                const techAtBc = state.userPlacements.find(
                  (p) => p.is_current && p.basecamp_id === bc.id
                );
                const techTrack = techAtBc ? getLatestTrackForUser(state, techAtBc.user_id) : undefined;
                const techUser = techAtBc ? state.users.find((u) => u.id === techAtBc.user_id) : undefined;
                return (
                  <div key={bc.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-[#0F172A]">{bc.name}</span>
                      <span className="text-[#94A3B8]"> · {area?.name}</span>
                      {techTrack && techUser && (
                        <span className="block text-[11px] text-[#475569] tabular-nums">
                          {techUser.full_name} · pembaruan {formatTimeWita(techTrack.recorded_at)} · baterai{' '}
                          {formatPercent(techTrack.battery_level, 0)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        bal < 1_000_000 ? 'text-[#E61E25]' : 'text-[#0F172A]'
                      }`}
                    >
                      {formatRupiah(bal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigate('saldo_kas')}
              className="font-semibold text-[#0A4B8F] hover:underline"
            >
              Lihat semua saldo kas ({state.basecamps.length} basecamp)
            </button>
            <button
              type="button"
              onClick={() => onNavigate('buku_kas')}
              className="font-semibold text-[#475569] hover:text-[#0F172A] hover:underline"
            >
              Buku Kas
            </button>
          </div>
        </section>
      </div>

      {/* Threshold Modal */}
      <Modal
        open={thresholdModalBudgetId !== null}
        onClose={() => {
          setThresholdError(null);
          setThresholdModalBudgetId(null);
        }}
        ariaLabelledBy="threshold-modal-title"
        maxWidthClass="max-w-md"
        backdropClassName="bg-[#0F172A]/45"
      >
        <div className="flex items-center justify-between">
          <h3 id="threshold-modal-title" className="text-base font-bold text-[#0F172A]">
            Ubah Ambang Peringatan Anggaran (%)
          </h3>
          <button
            type="button"
            onClick={() => {
              setThresholdError(null);
              setThresholdModalBudgetId(null);
            }}
            className="p-1 rounded-md text-[#475569] hover:bg-[#F1F5F9]"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#475569]">
          Standar ambang adalah 90%. Area ditandai Waspada bila serapan melebihi batas ini.
        </p>
        <input
          type="number"
          min={50}
          max={100}
          value={draftThreshold}
          onChange={(e) => setDraftThreshold(e.target.value)}
          aria-label="Ambang peringatan anggaran dalam persen"
          className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] tabular-nums focus:outline-none focus:border-[#0A4B8F]"
        />
        {thresholdError && (
          <p className="text-xs font-medium text-[#E61E25]" role="alert">
            {thresholdError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setThresholdError(null);
              setThresholdModalBudgetId(null);
            }}
            className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#475569]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              if (thresholdModalBudgetId === null) return;
              const parsedThreshold =
                draftThreshold.trim() === '' ? NaN : Number(draftThreshold);
              const res = onUpdateBudgetThreshold(
                thresholdModalBudgetId,
                parsedThreshold
              );
              if (res.error) {
                setThresholdError(res.error);
              } else {
                setThresholdError(null);
                setThresholdModalBudgetId(null);
              }
            }}
            className="px-4 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold"
          >
            Simpan ambang
          </button>
        </div>
      </Modal>
    </div>
  );
};
