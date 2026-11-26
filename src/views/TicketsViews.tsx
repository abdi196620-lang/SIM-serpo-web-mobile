import React, { useMemo, useState } from 'react';
import { ChevronRight, Download, X } from 'lucide-react';
import {
  ActiveSessionContext,
  SerpoState,
  TicketPriority,
  TicketStatus,
} from '../types/serpo';
import { formatPercent, formatTimeWita } from '../utils/serpoLogic';
import { can, canUpdateTicket } from '../utils/permissions';
import { Modal } from '../components/Modal';
import {
  downloadCsv,
  getTicketPriorityLabel,
  getTicketStatusLabel,
  PageHeader,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '../components/StatusText';

interface TicketsViewsProps {
  mode: 'tiket' | 'rekap_tiket';
  state: SerpoState;
  session: ActiveSessionContext;
  onUpdateTicket: (
    ticketId: number,
    patch: {
      status?: TicketStatus;
      assigned_to?: number | null;
      priority?: TicketPriority;
      note?: string;
    }
  ) => { error?: string };
}

const STATUS_TABS: ('SEMUA' | TicketStatus)[] = [
  'SEMUA',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
];

export const TicketsViews: React.FC<TicketsViewsProps> = ({
  mode,
  state,
  session,
  onUpdateTicket,
}) => {
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | TicketStatus>('SEMUA');
  const [basecampFilter, setBasecampFilter] = useState<number | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);

  const selectedTicket = state.tickets.find((t) => t.id === selectedTicketId) ?? null;

  const techUsers = state.users.filter(
    (u) => u.status === 'ACTIVE' && (u.role_id === 1 || u.role_id === 2)
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      SEMUA: state.tickets.length,
      OPEN: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CANCELLED: 0,
    };
    state.tickets.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [state.tickets]);

  const filteredTickets = useMemo(() => {
    return state.tickets.filter((t) => {
      if (statusFilter !== 'SEMUA' && t.status !== statusFilter) return false;
      if (basecampFilter !== 'all' && t.basecamp_id !== basecampFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [state.tickets, statusFilter, basecampFilter, priorityFilter]);

  if (mode === 'rekap_tiket') {
    const openTickets = state.tickets.filter(
      (t) => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
    );
    const doneTickets = state.tickets.filter((t) => t.status === 'RESOLVED');
    const emergencyTickets = state.tickets.filter(
      (t) => t.priority === 'CRITICAL' && t.status !== 'RESOLVED'
    );

    const handleExportRekap = () => {
      downloadCsv(
        'sim-serpo-rekap-tiket.csv',
        ['Basecamp', 'Terbuka', 'Selesai', 'Kepatuhan SLA'],
        state.basecamps.map((b) => {
          const bcTickets = state.tickets.filter((t) => t.basecamp_id === b.id);
          const openC = bcTickets.filter(
            (t) => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
          ).length;
          const doneC = bcTickets.filter((t) => t.status === 'RESOLVED').length;
          const compliantC = bcTickets.filter((t) => !t.sla_breached).length;
          const slaPct =
            bcTickets.length === 0 ? 100 : Math.round((compliantC / bcTickets.length) * 1000) / 10;
          return [b.name, openC, doneC, formatPercent(slaPct)];
        })
      );
    };

    return (
      <div className="space-y-5">
        <PageHeader
          title="Rekap tiket"
          subtitle="Ringkasan tiket operasional dan riwayat status per Basecamp"
          action={
            <button
              type="button"
              onClick={handleExportRekap}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ekspor</span>
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Tiket terbuka</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">{openTickets.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B] tabular-nums">
              {statusCounts.OPEN} {getTicketStatusLabel('OPEN')} · {statusCounts.ASSIGNED}{' '}
              {getTicketStatusLabel('ASSIGNED')} · {statusCounts.IN_PROGRESS}{' '}
              {getTicketStatusLabel('IN_PROGRESS')}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">{getTicketStatusLabel('RESOLVED')}</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">{doneTickets.length}</p>
            <p className="mt-1.5 text-xs text-[#047857] font-medium">tercatat di riwayat status</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Total perubahan status</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
              {state.ticketStatusHistory.length}
            </p>
            <p className="mt-1.5 text-xs text-[#64748B]">entri riwayat status</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Tiket {getTicketPriorityLabel('CRITICAL')} aktif</p>
            <p className="mt-2 text-2xl font-bold text-[#E61E25] tabular-nums">{emergencyTickets.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B]">prioritas tertinggi</p>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0F172A]">Tiket per Basecamp</h2>
            <span className="text-xs text-[#64748B]">November 2026</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Basecamp</th>
                  <th className="py-2.5 px-4 text-right">Terbuka</th>
                  <th className="py-2.5 px-4 text-right">{getTicketStatusLabel('RESOLVED')}</th>
                  <th className="py-2.5 px-5 text-right">Melewati SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {state.basecamps.map((b) => {
                  const bcTickets = state.tickets.filter((t) => t.basecamp_id === b.id);
                  const bcOpen = bcTickets.filter(
                    (t) => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
                  ).length;
                  const bcDone = bcTickets.filter((t) => t.status === 'RESOLVED').length;
                  const bcBreached = bcTickets.filter((t) => t.sla_breached).length;
                  return (
                    <tr key={b.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-5 font-semibold text-[#0F172A]">{b.name}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{bcOpen}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{bcDone}</td>
                      <td className="py-3 px-5 text-right tabular-nums font-semibold text-[#E61E25]">
                        {bcBreached}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  const selectedHistory = selectedTicket
    ? state.ticketStatusHistory.filter((h) => h.ticket_id === selectedTicket.id)
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tiket"
        subtitle={`Daftar tiket operasional & riwayat perubahan status · Peran aktif: ${session.role.name}`}
      />

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter status tiket">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(tab)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>{tab === 'SEMUA' ? 'Semua' : getTicketStatusLabel(tab)}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#475569]'
                }`}
              >
                {statusCounts[tab] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#64748B]">Basecamp</span>
          <select
            value={basecampFilter}
            onChange={(e) =>
              setBasecampFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
          >
            <option value="all">Semua ({state.basecamps.length})</option>
            {state.basecamps.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#64748B]">Prioritas</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | TicketPriority)}
            className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
          >
            <option value="ALL">Semua</option>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {getTicketPriorityLabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                <th className="py-2.5 px-5">Tiket</th>
                <th className="py-2.5 px-4">Basecamp</th>
                <th className="py-2.5 px-4">Teknisi</th>
                <th className="py-2.5 px-4">Prioritas</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Umur</th>
                <th className="py-2.5 px-5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-sm">
              {filteredTickets.map((t) => {
                const bc = state.basecamps.find((b) => b.id === t.basecamp_id);
                const tech = t.assigned_to
                  ? state.users.find((u) => u.id === t.assigned_to)
                  : null;
                return (
                  <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicketId(t.id);
                          setStatusNote('');
                          setTicketError(null);
                        }}
                        className="text-left group"
                      >
                        <span className="block text-[11px] font-mono text-[#64748B]">
                          {t.ticket_no}
                        </span>
                        <span className="block font-semibold text-[#0F172A] group-hover:text-[#0A4B8F]">
                          {t.title}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-[#334155]">{bc?.name}</td>
                    <td className="py-3 px-4">
                      {tech ? (
                        <span className="text-[#0F172A]">{tech.full_name}</span>
                      ) : (
                        <span className="text-[#64748B] italic">Belum ditugaskan</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <TicketPriorityBadge priority={t.priority} slaBreached={t.sla_breached} />
                    </td>
                    <td className="py-3 px-4">
                      <TicketStatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <span
                        className={`text-xs font-medium ${
                          t.sla_breached ? 'text-[#E61E25]' : 'text-[#334155]'
                        }`}
                      >
                        {t.age_hours} jam
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicketId(t.id);
                          setStatusNote('');
                          setTicketError(null);
                        }}
                        className="p-1.5 rounded-md text-[#64748B] hover:bg-[#E2E8F0]"
                        aria-label={`Lihat detail tiket ${t.ticket_no}`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={selectedTicket !== null}
        onClose={() => setSelectedTicketId(null)}
        ariaLabelledBy="ticket-detail-title"
        maxWidthClass="max-w-lg"
      >
        {selectedTicket && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-[#64748B]">{selectedTicket.ticket_no}</span>
                <h3 id="ticket-detail-title" className="text-lg font-bold text-[#0F172A] mt-0.5">
                  {selectedTicket.title}
                </h3>
                <p className="text-xs text-[#475569] mt-1">
                  {state.basecamps.find((b) => b.id === selectedTicket.basecamp_id)?.name} · Dibuat{' '}
                  {formatTimeWita(selectedTicket.created_at)} WITA
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicketId(null)}
                className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                aria-label="Tutup detail tiket"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TicketPriorityBadge
                priority={selectedTicket.priority}
                slaBreached={selectedTicket.sla_breached}
              />
              <TicketStatusBadge status={selectedTicket.status} />
            </div>

            <p className="text-sm text-[#334155] bg-[#F8FAFC] p-3.5 rounded-lg border border-[#E2E8F0]">
              {selectedTicket.description}
            </p>

            {(() => {
              const canAssignTicket = can(session.role.code, 'ticket.update');
              const canChangeStatus = canUpdateTicket(
                session.role.code,
                session.user.id,
                selectedTicket,
                { status: selectedTicket.status }
              ).allowed;
              return (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-[#334155] mb-1">
                        Teknisi ditugaskan
                      </span>
                      <select
                        value={selectedTicket.assigned_to ?? ''}
                        disabled={!canAssignTicket}
                        onChange={(e) => {
                          const techId = e.target.value ? Number(e.target.value) : null;
                          const res = onUpdateTicket(selectedTicket.id, {
                            assigned_to: techId,
                            status:
                              techId && selectedTicket.status === 'OPEN'
                                ? 'ASSIGNED'
                                : selectedTicket.status,
                            note: statusNote || 'Penugasan teknisi diperbarui',
                          });
                          if (res.error) setTicketError(res.error);
                          else setTicketError(null);
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
                      >
                        <option value="">Belum ditugaskan</option>
                        {techUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="block text-xs font-semibold text-[#334155] mb-1">
                        Ubah status
                      </span>
                      <select
                        value={selectedTicket.status}
                        disabled={!canChangeStatus}
                        onChange={(e) => {
                          const res = onUpdateTicket(selectedTicket.id, {
                            status: e.target.value as TicketStatus,
                            note: statusNote || undefined,
                          });
                          if (res.error) setTicketError(res.error);
                          else setTicketError(null);
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
                      >
                        {(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as TicketStatus[]).map(
                          (s) => (
                            <option key={s} value={s}>
                              {getTicketStatusLabel(s)}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-[#334155] mb-1">
                        Prioritas tiket
                      </span>
                      <select
                        value={selectedTicket.priority}
                        disabled={!canAssignTicket}
                        onChange={(e) => {
                          const res = onUpdateTicket(selectedTicket.id, {
                            priority: e.target.value as TicketPriority,
                            note: statusNote || undefined,
                          });
                          if (res.error) setTicketError(res.error);
                          else setTicketError(null);
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
                      >
                        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((p) => (
                          <option key={p} value={p}>
                            {getTicketPriorityLabel(p)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="block text-xs font-semibold text-[#334155] mb-1">
                        Catatan perubahan (opsional)
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={statusNote}
                          disabled={!canChangeStatus}
                          onChange={(e) => setStatusNote(e.target.value)}
                          placeholder="Tulis catatan progres..."
                          className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
                        />
                        {canChangeStatus && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = onUpdateTicket(selectedTicket.id, {
                                status: selectedTicket.status,
                                note: statusNote,
                              });
                              if (res.error) {
                                setTicketError(res.error);
                              } else {
                                setTicketError(null);
                                setStatusNote('');
                              }
                            }}
                            className="px-3 h-10 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#0A4B8F] hover:bg-[#EFF6FF] shrink-0"
                          >
                            Catat
                          </button>
                        )}
                      </div>
                    </label>
                  </div>
                  {ticketError && (
                    <p className="text-xs font-medium text-[#E61E25]" role="alert">
                      {ticketError}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="border-t border-[#E2E8F0] pt-3">
              <h4 className="text-xs font-bold text-[#0F172A] mb-2">
                Riwayat perubahan status
              </h4>
              <div className="space-y-2 text-xs">
                {selectedHistory.map((h) => {
                  const actor = state.users.find((u) => u.id === h.changed_by);
                  return (
                    <div
                      key={h.id}
                      className="flex items-start justify-between gap-3 py-1.5 border-b last:border-b-0 border-[#E2E8F0]"
                    >
                      <div>
                        <span className="font-semibold text-[#0F172A]">
                          {h.from_status ? getTicketStatusLabel(h.from_status) : 'Awal'} →{' '}
                          {getTicketStatusLabel(h.to_status)}
                        </span>
                        <span className="block text-[#475569]">
                          oleh {actor?.full_name ?? h.changed_by}
                          {h.note ? ` · ${h.note}` : ''}
                        </span>
                      </div>
                      <span className="font-mono text-[#64748B] shrink-0">
                        {formatTimeWita(h.changed_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTicketId(null)}
                className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
              >
                Selesai
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};
