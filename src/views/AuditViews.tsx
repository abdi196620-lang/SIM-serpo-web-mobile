import React, { useState } from 'react';
import { ArrowLeft, Play, RefreshCw, X } from 'lucide-react';
import {
  ActiveSessionContext,
  AuditResolutionStatus,
  ReconciliationFinding,
  RouteId,
  SerpoState,
  SyncAuditLog,
} from '../types/serpo';
import {
  canApproveCorrection,
  formatDateShortId,
  formatNumberId,
  formatRupiah,
  formatTimeWita,
  getUserBasecampAndArea,
  reconcileBudgetsWithLedgers,
} from '../utils/serpoLogic';
import { can } from '../utils/permissions';
import { PageHeader, StatusLabel } from '../components/StatusText';
import { Modal } from '../components/Modal';

const ENTITY_LABELS: Record<string, string> = {
  ATTENDANCE: 'Absensi',
  FUND_REQUEST: 'Pengajuan Dana',
};

const OUTBOX_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu Kirim',
  SYNCED: 'Tersinkronisasi',
  FAILED_RETRY: 'Gagal (Coba Lagi)',
  FAILED_NEEDS_ATTENTION: 'Gagal (Perlu Perhatian)',
};

const OUTCOME_LABELS: Record<string, string> = {
  ACCEPTED: 'Diterima',
  ACCEPTED_FLAGGED: 'Diterima (Ditandai)',
  REJECTED: 'Ditolak',
};

const RESOLUTION_LABELS: Record<string, string> = {
  UNRESOLVED: 'Belum Selesai',
  CONFIRMED: 'Dikonfirmasi',
  REJECTED: 'Ditolak',
};

const AGE_FLAG_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  PRIORITY: 'Prioritas',
  LATE: 'Terlambat',
  CLOCK_ANOMALY: 'Anomali Waktu',
};

const CORRECTION_TYPE_LABELS: Record<string, string> = {
  REPAIR: 'Perbaikan Saldo',
  ADJUSTMENT: 'Penyesuaian',
};

interface AuditViewsProps {
  mode:
    | 'antrean_audit'
    | 'temuan_rekonsiliasi'
    | 'detail_temuan'
    | 'usulan_koreksi'
    | 'persetujuan_koreksi'
    | 'riwayat_run';
  state: SerpoState;
  session: ActiveSessionContext;
  contextId?: string | null;
  onNavigate: (route: RouteId, contextId?: string) => void;
  onFlushOfflineOutbox: () => { processed: number; failed: number };
  onResolveSyncAuditLog: (
    auditLogId: number,
    resolution: 'CONFIRMED' | 'REJECTED',
    note: string
  ) => void;
  onProposeCorrection: (payload: {
    findingId: string;
    type: 'REPAIR' | 'ADJUSTMENT';
    basecampId?: number;
    cashDelta: number;
    realizationDelta: number;
    reason: string;
  }) => { error?: string };
  onMarkFalsePositive: (findingId: string, reason: string) => { error?: string };
  onCorrectionDecision: (
    correctionId: string,
    action: 'approve' | 'reject',
    note?: string
  ) => { error?: string };
  onRunManualReconciliation: () => { error?: string };
}

export const AuditViews: React.FC<AuditViewsProps> = ({
  mode,
  state,
  session,
  contextId,
  onNavigate,
  onFlushOfflineOutbox,
  onResolveSyncAuditLog,
  onProposeCorrection,
  onMarkFalsePositive,
  onCorrectionDecision,
  onRunManualReconciliation,
}) => {
  const [entityFilter, setEntityFilter] = useState<'ALL' | 'ATTENDANCE' | 'FUND_REQUEST'>('ALL');
  const [resolutionFilter, setResolutionFilter] = useState<'ALL' | AuditResolutionStatus>('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<SyncAuditLog | null>(null);
  const [auditNote, setAuditNote] = useState('');
  const [flushSummary, setFlushSummary] = useState<string | null>(null);

  const [findingTab, setFindingTab] = useState<'Terbuka' | 'Koreksi diusulkan' | 'Selesai'>('Terbuka');
  const [falsePosReason, setFalsePosReason] = useState('');
  const [falsePosError, setFalsePosError] = useState<string | null>(null);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposeType, setProposeType] = useState<'REPAIR' | 'ADJUSTMENT'>('REPAIR');
  const [proposeDirection, setProposeDirection] = useState<'IN' | 'OUT'>('IN');
  const [proposeReason, setProposeReason] = useState('');
  const [proposeCashDelta, setProposeCashDelta] = useState('200000');
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [reconError, setReconError] = useState<string | null>(null);

  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(
    state.corrections.find((c) => c.status === 'Menunggu Management')?.id ??
      state.corrections[0]?.id ??
      null
  );
  const [corrNote, setCorrNote] = useState('');
  const [corrError, setCorrError] = useState<string | null>(null);

  const isTechnician = session.role.code === 'TEKNISI';
  const canProposeCorrection = can(session.role.code, 'correction.propose');
  const canMarkFP = can(session.role.code, 'finding.markFalsePositive');
  const canRunManualRecon = can(session.role.code, 'recon.runManual');

  const activeFinding = state.findings.find((f) => f.id === contextId) ?? state.findings[0];

  const getBasecampName = (bcId: number) =>
    state.basecamps.find((b) => b.id === bcId)?.name ?? `Basecamp #${bcId}`;

  const formatAgeHours = (sec: number) => {
    if (sec < 0) return `${sec} dtk (anomali)`;
    const hrs = sec / 3600;
    if (hrs < 1) return `${Math.round(sec / 60)} mnt`;
    return `${hrs.toFixed(1).replace('.', ',')} jam`;
  };

  // 1. ANTREAN AUDIT & OUTBOX OFFLINE (Diagram 6)
  if (mode === 'antrean_audit') {
    const visibleOutbox = isTechnician
      ? state.offlineOutbox.filter((o) => o.user_id === session.user.id)
      : state.offlineOutbox;
    const visibleAuditLogs = isTechnician
      ? state.syncAuditLogs.filter((l) => l.user_id === session.user.id)
      : state.syncAuditLogs;

    const unresolvedLogs = visibleAuditLogs.filter(
      (l) => l.outcome === 'ACCEPTED_FLAGGED' && l.resolution_status === 'UNRESOLVED'
    );
    const lateOrPriorityCount = unresolvedLogs.filter(
      (l) => l.age_flag === 'LATE' || l.age_flag === 'PRIORITY' || l.age_flag === 'CLOCK_ANOMALY'
    ).length;
    const pendingOutbox = visibleOutbox.filter((o) => o.status !== 'SYNCED');

    const filteredLogs = visibleAuditLogs.filter((l) => {
      if (entityFilter !== 'ALL' && l.entity_type !== entityFilter) return false;
      if (resolutionFilter !== 'ALL' && l.resolution_status !== resolutionFilter) return false;
      return true;
    });

    const handleFlush = () => {
      const res = onFlushOfflineOutbox();
      if (!state.networkOnline) {
        setFlushSummary(
          `Sinkronisasi gagal (${res.failed} item): Mode offline aktif — percobaan ulang bertambah (maksimal ${state.offlineMaxRetry} kali).`
        );
      } else if (res.processed === 0) {
        setFlushSummary('Semua item pada antrean offline lokal sudah tersinkronisasi.');
      } else {
        setFlushSummary(
          `${res.processed} item berhasil diproses berurutan ke Log Audit Sinkronisasi.`
        );
      }
    };

    return (
      <div className="space-y-5">
        <PageHeader
          title="Antrean Offline & Audit Sinkronisasi"
          subtitle="Antrean pengiriman lokal berurutan serta catatan audit sinkronisasi data lapangan"
          action={
            <button
              type="button"
              onClick={handleFlush}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sinkronkan Antrean ({pendingOutbox.length})</span>
            </button>
          }
        />

        {flushSummary && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border text-xs font-medium ${
              state.networkOnline
                ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#083C73]'
                : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
            }`}
          >
            {flushSummary}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Antrean Lokal (Belum Sinkron)</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">{pendingOutbox.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B]">
              Status jaringan: {state.networkOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Audit Belum Selesai</p>
            <p className="mt-2 text-2xl font-bold text-[#B45309] tabular-nums">{unresolvedLogs.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B]">Menunggu peninjauan</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Prioritas / Terlambat / Anomali</p>
            <p className="mt-2 text-2xl font-bold text-[#E61E25] tabular-nums">
              {lateOrPriorityCount}
            </p>
            <p className="mt-1.5 text-xs text-[#64748B]">Data tetap diterima & ditandai</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Total Log Audit Sinkronisasi</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
              {visibleAuditLogs.length}
            </p>
            <p className="mt-1.5 text-xs text-[#64748B]">Terlindungi dari pengiriman ganda</p>
          </div>
        </div>

        {/* Local Outbox Section */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Antrean Offline Lokal</h2>
            <span className="text-xs text-[#64748B] tabular-nums">
              {visibleOutbox.length} item · maks. percobaan {state.offlineMaxRetry}x
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2.5 px-5">Kode Unik</th>
                  <th className="py-2.5 px-4">Jenis Data</th>
                  <th className="py-2.5 px-4">Ringkasan Aktivitas</th>
                  <th className="py-2.5 px-4">Waktu Dibuat (Perangkat)</th>
                  <th className="py-2.5 px-4 text-right">Percobaan</th>
                  <th className="py-2.5 px-5">Status Antrean</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {visibleOutbox.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#64748B]">
                      Belum ada antrean offline untuk akun ini.
                    </td>
                  </tr>
                ) : (
                  visibleOutbox.map((item) => {
                    const outboxStatusLabel = OUTBOX_STATUS_LABELS[item.status] ?? item.status;
                    const outcomeLabel = item.server_outcome
                      ? OUTCOME_LABELS[item.server_outcome] ?? item.server_outcome
                      : null;
                    return (
                      <tr key={item.client_uuid} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-5 font-mono text-[#475569]">
                          {item.client_uuid.slice(0, 22)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#0F172A]">
                          {ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-medium text-[#0F172A]">{item.action_label}</span>
                          {item.last_error && (
                            <span className="block text-[11px] text-[#E61E25]">{item.last_error}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums">
                          {formatDateShortId(item.client_created_at)} · {formatTimeWita(item.client_created_at)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{item.retry_count}</td>
                        <td className="py-2.5 px-5">
                          <StatusLabel
                            tone={
                              item.status === 'SYNCED'
                                ? 'green'
                                : item.status === 'FAILED_NEEDS_ATTENTION'
                                ? 'red'
                                : 'amber'
                            }
                            label={outcomeLabel ? `${outboxStatusLabel} (${outcomeLabel})` : outboxStatusLabel}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Filters for Log Audit Sinkronisasi */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
            <span className="text-[#64748B]">Jenis Data</span>
            <select
              value={entityFilter}
              onChange={(e) =>
                setEntityFilter(e.target.value as 'ALL' | 'ATTENDANCE' | 'FUND_REQUEST')
              }
              className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
            >
              <option value="ALL">Semua</option>
              <option value="ATTENDANCE">Absensi</option>
              <option value="FUND_REQUEST">Pengajuan Dana</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
            <span className="text-[#64748B]">Status Resolusi</span>
            <select
              value={resolutionFilter}
              onChange={(e) =>
                setResolutionFilter(e.target.value as 'ALL' | AuditResolutionStatus)
              }
              className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
            >
              <option value="ALL">Semua</option>
              <option value="UNRESOLVED">Belum Selesai</option>
              <option value="CONFIRMED">Dikonfirmasi</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </label>
        </div>

        {/* Log Audit Sinkronisasi Table */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Log Audit Sinkronisasi</h2>
            <span className="text-xs text-[#64748B] tabular-nums">{filteredLogs.length} catatan</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Entitas</th>
                  <th className="py-2.5 px-4">Pengguna & Ringkasan</th>
                  <th className="py-2.5 px-4">Perangkat vs Server</th>
                  <th className="py-2.5 px-4">Kategori Waktu</th>
                  <th className="py-2.5 px-4">Alasan & Hasil</th>
                  <th className="py-2.5 px-5 text-right">Resolusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#64748B]">
                      Belum ada catatan log audit sinkronisasi untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const u = state.users.find((us) => us.id === log.user_id);
                    const { basecamp } = getUserBasecampAndArea(state, log.user_id);
                    return (
                      <tr key={log.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-5 font-semibold text-[#0F172A]">
                          {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                          {log.entity_id !== null && (
                            <span className="block font-mono text-[11px] text-[#64748B]">#{log.entity_id}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-semibold text-[#0F172A]">
                            {u?.full_name} · {basecamp?.name ?? '—'}
                          </span>
                          <span className="block text-[#475569]">{log.payload_summary}</span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[#475569]">
                          <span>
                            Perangkat: {formatDateShortId(log.client_created_at)} {formatTimeWita(log.client_created_at)}
                          </span>
                          <span className="block">
                            Server: {formatDateShortId(log.server_received_at)} {formatTimeWita(log.server_received_at)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel
                            tone={
                              log.age_flag === 'LATE' || log.age_flag === 'CLOCK_ANOMALY'
                                ? 'red'
                                : log.age_flag === 'PRIORITY'
                                ? 'amber'
                                : 'green'
                            }
                            label={`${AGE_FLAG_LABELS[log.age_flag] ?? log.age_flag} · ${formatAgeHours(log.age_seconds)}`}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-semibold text-[#0F172A]">
                            {OUTCOME_LABELS[log.outcome] ?? log.outcome}
                          </span>
                          {log.flag_reasons.length > 0 && (
                            <span className="block text-[#475569]">{log.flag_reasons.join('; ')}</span>
                          )}
                          {log.reject_reason && (
                            <span className="block text-[#E61E25]">{log.reject_reason}</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right">
                          {log.outcome === 'ACCEPTED_FLAGGED' && log.resolution_status === 'UNRESOLVED' ? (
                            isTechnician ? (
                              <StatusLabel tone="amber" label="Belum Selesai" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAuditLog(log);
                                  setAuditNote('');
                                }}
                                className="px-3 py-1 rounded-md bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
                              >
                                Tinjau
                              </button>
                            )
                          ) : log.resolution_status ? (
                            <StatusLabel
                              tone={log.resolution_status === 'CONFIRMED' ? 'green' : 'red'}
                              label={RESOLUTION_LABELS[log.resolution_status] ?? log.resolution_status}
                            />
                          ) : (
                            <span className="text-[#64748B]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Resolution Modal */}
        <Modal
          open={selectedAuditLog !== null}
          onClose={() => setSelectedAuditLog(null)}
          ariaLabelledBy="audit-resolve-title"
          maxWidthClass="max-w-md"
        >
          {selectedAuditLog && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 id="audit-resolve-title" className="text-base font-bold text-[#0F172A]">
                    Resolusi Log Audit #{selectedAuditLog.id}
                  </h3>
                  <p className="text-xs text-[#475569] mt-0.5">{selectedAuditLog.payload_summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAuditLog(null)}
                  className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                  aria-label="Tutup dialog audit"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                <p>
                  <strong>Kategori waktu:</strong>{' '}
                  {AGE_FLAG_LABELS[selectedAuditLog.age_flag] ?? selectedAuditLog.age_flag} (
                  {formatAgeHours(selectedAuditLog.age_seconds)})
                </p>
                <p>
                  <strong>Alasan penandaan:</strong> {selectedAuditLog.flag_reasons.join('; ')}
                </p>
              </div>
              <textarea
                rows={3}
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                placeholder="Catatan resolusi (konfirmasi membuka blokir persetujuan pengajuan dana terkait)..."
                className="w-full p-3 rounded-lg border border-[#E2E8F0] text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResolveSyncAuditLog(
                      selectedAuditLog.id,
                      'REJECTED',
                      auditNote || 'Dinyatakan pelanggaran oleh audit'
                    );
                    setSelectedAuditLog(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#FEF2F2] text-[#E61E25] text-xs font-semibold"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResolveSyncAuditLog(
                      selectedAuditLog.id,
                      'CONFIRMED',
                      auditNote || 'Dikonfirmasi valid setelah verifikasi lapangan'
                    );
                    setSelectedAuditLog(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold"
                >
                  Konfirmasi Valid
                </button>
              </div>
            </>
          )}
        </Modal>
      </div>
    );
  }

  // 2. TEMUAN REKONSILIASI + Live Reconciliation Budgets vs Cash_Ledgers TOP_UP
  if (mode === 'temuan_rekonsiliasi') {
    const liveRecon = reconcileBudgetsWithLedgers(state);
    const openCount = state.findings.filter((f) => f.status === 'Terbuka').length;
    const proposedCount = state.findings.filter((f) => f.status === 'Koreksi diusulkan').length;
    const closedCount = state.findings.filter(
      (f) => f.status === 'Selesai' || f.status === 'False positive'
    ).length;

    const visibleFindings = state.findings.filter((f) => {
      if (findingTab === 'Selesai') {
        return f.status === 'Selesai' || f.status === 'False positive';
      }
      return f.status === findingTab;
    });

    const renderSeverity = (sev: 'Tinggi' | 'Sedang' | 'Rendah') => {
      if (sev === 'Tinggi') return <StatusLabel tone="red" icon="error" label="Tinggi" />;
      if (sev === 'Sedang') return <StatusLabel tone="amber" icon="warn" label="Sedang" />;
      return <StatusLabel tone="gray" label="Rendah" />;
    };

    const renderFindingStatus = (st: ReconciliationFinding['status']) => {
      if (st === 'Terbuka') return <StatusLabel tone="red" label="Terbuka" />;
      if (st === 'Koreksi diusulkan') return <StatusLabel tone="amber" label="Koreksi diusulkan" />;
      if (st === 'Selesai') return <StatusLabel tone="green" label="Selesai" />;
      return <StatusLabel tone="gray" label="False positive" />;
    };

    return (
      <div className="space-y-5">
        <PageHeader
          title="Temuan & Rekonsiliasi"
          subtitle="Pemeriksaan konsistensi realisasi anggaran area, transaksi isi saldo buku kas, dan saldo kas basecamp"
        />

        {/* Live Reconciliation Budgets vs Ledger */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Rekonsiliasi Langsung: Realisasi Anggaran vs Total Isi Saldo Buku Kas
            </h2>
            <span className="text-xs text-[#64748B]">Sumber kebenaran realisasi area</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2.5 px-5">Area</th>
                  <th className="py-2.5 px-4 text-right">Realisasi Tercatat</th>
                  <th className="py-2.5 px-4 text-right">Total Isi Saldo Buku Kas</th>
                  <th className="py-2.5 px-4 text-right">Selisih</th>
                  <th className="py-2.5 px-5">Status Rekonsiliasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {liveRecon.map((row) => (
                  <tr key={row.budget_id}>
                    <td className="py-3 px-5 font-semibold text-[#0F172A]">{row.area_name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatRupiah(row.stored_realized)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatRupiah(row.ledger_topup_sum)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatRupiah(row.diff)}
                    </td>
                    <td className="py-3 px-5">
                      {row.matched ? (
                        <StatusLabel tone="green" icon="check" label="Cocok 100%" />
                      ) : (
                        <StatusLabel tone="red" icon="error" label="Ada Selisih" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {(
            [
              { id: 'Terbuka', count: openCount },
              { id: 'Koreksi diusulkan', count: proposedCount },
              { id: 'Selesai', count: closedCount },
            ] as const
          ).map((tab) => {
            const active = findingTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFindingTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-white border border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]'
                }`}
              >
                <span>{tab.id}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#475569]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Temuan rekonsiliasi</h2>
            <span className="text-xs text-[#64748B]">
              Run terakhir: {state.reconciliationRuns[0]?.startedAt} WITA
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Temuan</th>
                  <th className="py-2.5 px-4">Tingkat Keparahan</th>
                  <th className="py-2.5 px-4">Jenis pemeriksaan</th>
                  <th className="py-2.5 px-4">Basecamp</th>
                  <th className="py-2.5 px-4 text-right">Selisih (Rp)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-5 text-right">Umur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {visibleFindings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#64748B]">
                      Tidak ada temuan pada kategori ini.
                    </td>
                  </tr>
                ) : (
                  visibleFindings.map((f) => (
                    <tr key={f.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-5">
                        <button
                          type="button"
                          onClick={() => onNavigate('detail_temuan', f.id)}
                          className="font-mono text-xs font-bold text-[#0A4B8F] hover:underline"
                        >
                          {f.id}
                        </button>
                      </td>
                      <td className="py-3 px-4">{renderSeverity(f.severity)}</td>
                      <td className="py-3 px-4 text-xs text-[#0F172A]">{f.checkType}</td>
                      <td className="py-3 px-4 text-xs text-[#334155]">{getBasecampName(f.basecamp_id)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatNumberId(f.discrepancyAmount)}
                      </td>
                      <td className="py-3 px-4">{renderFindingStatus(f.status)}</td>
                      <td className="py-3 px-5 text-right text-xs text-[#475569] tabular-nums">
                        {f.ageLabel}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // 3. DETAIL TEMUAN
  if (mode === 'detail_temuan') {
    const bcName = getBasecampName(activeFinding.basecamp_id);
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onNavigate('temuan_rekonsiliasi')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A4B8F] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Kembali ke Temuan rekonsiliasi</span>
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">
              {activeFinding.id} · {bcName}
            </h1>
            <p className="text-sm text-[#475569] mt-0.5">
              Pertama terdeteksi {activeFinding.firstDetected} · muncul di {activeFinding.occurrences} run
            </p>
          </div>
          <StatusLabel
            tone={activeFinding.severity === 'Tinggi' ? 'red' : 'amber'}
            label={`${activeFinding.severity} · ${activeFinding.status}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
              <h2 className="text-sm font-bold text-[#0F172A]">{activeFinding.checkType}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B]">Selisih</span>
                  <p className="mt-1 text-base font-bold text-[#E61E25] tabular-nums">
                    {formatRupiah(activeFinding.discrepancyAmount)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B]">Diharapkan (Buku Kas)</span>
                  <p className="mt-1 text-base font-bold text-[#0F172A] tabular-nums">
                    {formatRupiah(activeFinding.expectedAmount)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B]">Aktual (Tersimpan)</span>
                  <p className="mt-1 text-base font-bold text-[#0F172A] tabular-nums">
                    {formatRupiah(activeFinding.actualAmount)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-[#E2E8F0]">
                <div className="flex justify-between gap-4">
                  <span className="text-[#64748B]">Mutasi terkait</span>
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {activeFinding.relatedMutationId} · {activeFinding.relatedMutationSummary}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#64748B]">Dugaan penyebab</span>
                  <span className="text-[#0F172A] text-right">{activeFinding.hypothesis}</span>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <h2 className="text-sm font-bold text-[#0F172A] mb-3">Riwayat deteksi</h2>
              <div className="space-y-2.5">
                {activeFinding.detectionHistory.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 text-xs py-2 border-b last:border-b-0 border-[#E2E8F0]"
                  >
                    <span className="font-semibold text-[#0F172A]">{h.runLabel}</span>
                    <span className="text-[#475569]">{h.note}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#0F172A]">Tindakan</h2>
            <p className="text-xs text-[#475569]">
              Usulan koreksi mencatat penyesuaian di Buku Kas hanya setelah disetujui Management (penyetuju bukan pengusul).
            </p>

            {activeFinding.status === 'Terbuka' ? (
              canProposeCorrection || canMarkFP ? (
                <>
                  {canProposeCorrection && (
                    <button
                      type="button"
                      onClick={() => {
                        setProposeDirection(activeFinding.discrepancyAmount < 0 ? 'OUT' : 'IN');
                        setProposeCashDelta(String(Math.abs(activeFinding.discrepancyAmount) || 200000));
                        setProposeReason(activeFinding.hypothesis);
                        setProposeError(null);
                        setProposeModalOpen(true);
                      }}
                      className="w-full py-2.5 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
                    >
                      Usulkan koreksi
                    </button>
                  )}

                  {canMarkFP && (
                    <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5">
                      <label htmlFor="fp-reason" className="block text-xs font-semibold text-[#334155]">
                        Catatan false positive (wajib)
                      </label>
                      <textarea
                        id="fp-reason"
                        rows={3}
                        value={falsePosReason}
                        onChange={(e) => setFalsePosReason(e.target.value)}
                        placeholder="Jelaskan mengapa temuan ini bukan selisih sebenarnya..."
                        className="w-full p-2.5 rounded-lg border border-[#E2E8F0] text-xs"
                      />
                      {falsePosError && (
                        <p className="text-xs text-[#E61E25]" role="alert">
                          {falsePosError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const res = onMarkFalsePositive(activeFinding.id, falsePosReason);
                          if (res.error) setFalsePosError(res.error);
                          else {
                            setFalsePosError(null);
                            setFalsePosReason('');
                          }
                        }}
                        className="w-full py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9]"
                      >
                        Tandai false positive
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569]">
                  Tindakan usulan koreksi dan false positive hanya tersedia untuk peran Finance.
                </div>
              )
            ) : (
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569]">
                Status temuan saat ini: <strong>{activeFinding.status}</strong>.
              </div>
            )}
          </div>
        </div>

        <Modal
          open={proposeModalOpen}
          onClose={() => {
            setProposeError(null);
            setProposeModalOpen(false);
          }}
          ariaLabelledBy="propose-correction-title"
          maxWidthClass="max-w-md"
        >
          <div className="flex items-center justify-between">
            <h3 id="propose-correction-title" className="text-base font-bold text-[#0F172A]">
              Usulkan Koreksi · {activeFinding.id}
            </h3>
            <button
              type="button"
              onClick={() => {
                setProposeError(null);
                setProposeModalOpen(false);
              }}
              className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Tutup dialog usulan koreksi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-[#334155] mb-1">Jenis koreksi</span>
            <select
              value={proposeType}
              onChange={(e) => setProposeType(e.target.value as 'REPAIR' | 'ADJUSTMENT')}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white"
            >
              <option value="REPAIR">Perbaikan Saldo Kas Basecamp</option>
              <option value="ADJUSTMENT">Penyesuaian (Masuk / Keluar)</option>
            </select>
          </label>
          {proposeType === 'ADJUSTMENT' && (
            <label className="block">
              <span className="block text-xs font-semibold text-[#334155] mb-1">Arah koreksi</span>
              <select
                value={proposeDirection}
                onChange={(e) => setProposeDirection(e.target.value as 'IN' | 'OUT')}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white"
              >
                <option value="IN">Masuk — Tambah</option>
                <option value="OUT">Keluar — Kurangi</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className="block text-xs font-semibold text-[#334155] mb-1">Nilai dampak (Rp)</span>
            <input
              type="number"
              min={1000}
              value={proposeCashDelta}
              onChange={(e) => setProposeCashDelta(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[#334155] mb-1">Alasan koreksi</span>
            <textarea
              rows={3}
              value={proposeReason}
              onChange={(e) => setProposeReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E2E8F0] text-sm"
            />
          </label>
          {proposeError && (
            <p className="text-xs font-medium text-[#E61E25]" role="alert">
              {proposeError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setProposeError(null);
                setProposeModalOpen(false);
              }}
              className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                const rawVal =
                  proposeCashDelta.trim() === '' ? NaN : Number(proposeCashDelta);
                if (!Number.isFinite(rawVal) || rawVal <= 0) {
                  setProposeError('Nominal koreksi harus berupa angka positif yang valid.');
                  return;
                }
                const signedVal =
                  proposeType === 'ADJUSTMENT' && proposeDirection === 'OUT'
                    ? -rawVal
                    : rawVal;
                const isBudgetAdjustment =
                  proposeType === 'ADJUSTMENT' && activeFinding.budget_id !== undefined;
                const res = onProposeCorrection({
                  findingId: activeFinding.id,
                  type: proposeType,
                  basecampId: activeFinding.basecamp_id,
                  cashDelta: isBudgetAdjustment ? 0 : signedVal,
                  realizationDelta: isBudgetAdjustment ? signedVal : 0,
                  reason: proposeReason || activeFinding.hypothesis,
                });
                if (res.error) {
                  setProposeError(res.error);
                } else {
                  setProposeError(null);
                  setProposeModalOpen(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold"
            >
              Kirim usulan ke Management
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // 4. USULAN KOREKSI & PERSETUJUAN KOREKSI
  if (mode === 'usulan_koreksi' || mode === 'persetujuan_koreksi') {
    const selectedCorr =
      state.corrections.find((c) => c.id === selectedCorrectionId) ??
      state.corrections[0] ??
      null;

    const approvalCheck = selectedCorr
      ? canApproveCorrection(selectedCorr, session.user.id, session.role.code)
      : { allowed: false, reason: '' };

    return (
      <div className="space-y-5">
        <PageHeader
          title={mode === 'usulan_koreksi' ? 'Usulan koreksi' : 'Persetujuan koreksi'}
          subtitle="Pemisahan tugas: penyetuju Management tidak boleh sama dengan pengusul"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <section className="lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-[#0F172A]">Usulan koreksi</h2>
              <span className="text-xs text-[#64748B] tabular-nums">
                {state.corrections.filter((c) => c.status === 'Menunggu Management').length} menunggu Management
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                    <th className="py-2.5 px-5">Temuan</th>
                    <th className="py-2.5 px-4">Jenis</th>
                    <th className="py-2.5 px-4">Basecamp</th>
                    <th className="py-2.5 px-4">Dampak</th>
                    <th className="py-2.5 px-4">Pengusul</th>
                    <th className="py-2.5 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {state.corrections.map((c) => {
                    const active = selectedCorr?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSelectedCorrectionId(c.id);
                          setCorrError(null);
                        }}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-[#EFF6FF]/50' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className="py-3 px-5 font-mono text-xs font-bold text-[#0A4B8F]">
                          {c.findingId}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold">
                          {CORRECTION_TYPE_LABELS[c.type] ?? c.type}
                        </td>
                        <td className="py-3 px-4 text-xs">{getBasecampName(c.basecamp_id)}</td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums">{c.impactLabel}</td>
                        <td className="py-3 px-4 text-xs text-[#475569]">{c.proposerName}</td>
                        <td className="py-3 px-5">
                          <StatusLabel
                            tone={
                              c.status === 'Disetujui'
                                ? 'green'
                                : c.status === 'Ditolak'
                                ? 'red'
                                : 'amber'
                            }
                            label={c.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selectedCorr && (
            <section className="lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  {selectedCorr.findingId} · {CORRECTION_TYPE_LABELS[selectedCorr.type] ?? selectedCorr.type}{' '}
                  {getBasecampName(selectedCorr.basecamp_id)}
                </h2>
                <p className="text-xs text-[#475569] mt-0.5">
                  Pengusul: {selectedCorr.proposerName} ({selectedCorr.proposerRole})
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                <div>
                  <span className="text-[#64748B]">Alasan:</span>
                  <p className="text-[#0F172A] font-medium mt-0.5">{selectedCorr.reason}</p>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#E2E8F0]">
                  <span className="text-[#64748B]">Dampak</span>
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {selectedCorr.impactLabel}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#083C73]">
                <strong>Prasyarat: Penyetuju bukan pengusul</strong>
                <p className="mt-0.5">
                  {approvalCheck.allowed
                    ? `Anda (${session.user.full_name}) berbeda dari ${selectedCorr.proposerName}.`
                    : approvalCheck.reason}
                </p>
              </div>

              {selectedCorr.status === 'Menunggu Management' ? (
                session.role.code === 'MANAGEMENT' ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-[#334155] mb-1">
                        Catatan Management (wajib jika menolak)
                      </span>
                      <textarea
                        rows={2}
                        value={corrNote}
                        onChange={(e) => setCorrNote(e.target.value)}
                        placeholder="Catatan keputusan..."
                        className="w-full p-2.5 rounded-lg border border-[#E2E8F0] text-xs"
                      />
                    </label>
                    {corrError && (
                      <p className="text-xs text-[#E61E25]" role="alert">
                        {corrError}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const res = onCorrectionDecision(selectedCorr.id, 'approve', corrNote);
                          if (res.error) setCorrError(res.error);
                          else {
                            setCorrError(null);
                            setCorrNote('');
                          }
                        }}
                        className="flex-1 py-2.5 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
                      >
                        Setujui koreksi
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const res = onCorrectionDecision(selectedCorr.id, 'reject', corrNote);
                          if (res.error) setCorrError(res.error);
                          else {
                            setCorrError(null);
                            setCorrNote('');
                          }
                        }}
                        className="px-4 py-2.5 rounded-lg bg-[#FEF2F2] text-[#E61E25] text-xs font-semibold hover:bg-[#FEE2E2]"
                      >
                        Tolak usulan
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B]">Menunggu keputusan peran Management.</p>
                )
              ) : (
                <div className="text-xs text-[#475569]">
                  Diputuskan: <strong>{selectedCorr.status}</strong> oleh {selectedCorr.decisionBy}
                  {selectedCorr.decisionNote && ` — ${selectedCorr.decisionNote}`}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    );
  }

  // 5. RIWAYAT RUN
  const openFindings = state.findings.filter((f) => f.status === 'Terbuka').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Riwayat Pemeriksaan & Rekonsiliasi Terjadwal"
        subtitle="Audit otomatis harian pukul 02.00 WITA terhadap realisasi anggaran, buku kas, dan saldo kas basecamp"
        action={
          canRunManualRecon ? (
            <button
              type="button"
              onClick={() => {
                const res = onRunManualReconciliation();
                if (res.error) setReconError(res.error);
                else setReconError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Jalankan manual</span>
            </button>
          ) : undefined
        }
      />

      {reconError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#E61E25]"
        >
          {reconError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Run terakhir</p>
          <p className="mt-2 text-xl font-bold text-[#0F172A] tabular-nums">
            {state.reconciliationRuns[0]?.startedAt}
          </p>
          <p className="mt-1.5 text-xs text-[#64748B]">{state.reconciliationRuns[0]?.trigger}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Jadwal harian</p>
          <p className="mt-2 text-xl font-bold text-[#0F172A] tabular-nums">02.00 WITA</p>
          <p className="mt-1.5 text-xs text-[#64748B]">Otomatis</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Temuan terbuka</p>
          <p className="mt-2 text-xl font-bold text-[#0F172A] tabular-nums">{openFindings}</p>
          <p className="mt-1.5 text-xs text-[#64748B]">dari run terakhir</p>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">Riwayat run</h2>
          <span className="text-xs text-[#64748B] tabular-nums">{state.reconciliationRuns.length} run</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                <th className="py-2.5 px-5">Mulai (WITA)</th>
                <th className="py-2.5 px-4">Pemicu</th>
                <th className="py-2.5 px-4">Durasi</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Temuan baru</th>
                <th className="py-2.5 px-5">Ringkasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {state.reconciliationRuns.map((r) => (
                <tr key={r.id} className="hover:bg-[#F8FAFC]">
                  <td className="py-3 px-5 font-mono text-xs tabular-nums">{r.startedAt}</td>
                  <td className="py-3 px-4 text-xs text-[#334155]">
                    {r.trigger}
                    {r.triggeredBy ? ` · ${r.triggeredBy}` : ''}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#475569] tabular-nums">{r.duration}</td>
                  <td className="py-3 px-4">
                    <StatusLabel tone="green" icon="check" label={r.status} />
                  </td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums">{r.newFindings}</td>
                  <td className="py-3 px-5 text-xs text-[#475569]">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
