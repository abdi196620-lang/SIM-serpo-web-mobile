import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ActiveSessionContext,
  FundRequestStatus,
  LedgerTransactionType,
  RouteId,
  SerpoState,
} from '../types/serpo';
import {
  canUserActOnFundRequest,
  formatDateShortId,
  formatJuta,
  formatNumberId,
  formatPercent,
  formatRupiah,
  formatTimeWita,
  FundDecisionResult,
  generateSequentialLedgerRef,
  generateUniqueId,
  getActiveAreaBudget,
  getAreaBudgetStatus,
  getBasecampBalance,
  getBudgetAbsorptionPct,
  getPendingApprovalsForUser,
  SubmitFundRequestInput,
  SubmitFundRequestResult,
} from '../utils/serpoLogic';
import { can } from '../utils/permissions';
import {
  formatFileSizeKb,
  ProcessedFundDocumentSuccess,
  processFundDocumentUpload,
} from '../utils/fileUpload';
import { downloadCashLedgerPdf } from '../utils/pdfExport';
import { BudgetMeter, PageHeader, StatusLabel } from '../components/StatusText';
import { Modal } from '../components/Modal';

const FUND_STATUS_LABELS: Record<FundRequestStatus, string> = {
  PENDING: 'Menunggu',
  IN_PROGRESS: 'Diproses',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

const APPROVAL_STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
  WAITING: 'Menunggu Giliran',
};

const LEDGER_TYPE_LABELS: Record<LedgerTransactionType, string> = {
  TOP_UP: 'Isi Saldo',
  EXPENSE: 'Pengeluaran',
  REFUND: 'Pengembalian',
  ADJUSTMENT: 'Penyesuaian',
};

const DIRECTION_LABELS: Record<'IN' | 'OUT', string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
};

const AGE_FLAG_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  PRIORITY: 'Prioritas',
  LATE: 'Terlambat',
  CLOCK_ANOMALY: 'Anomali Waktu',
};

const SCOPE_LABELS: Record<string, string> = {
  AREA: 'Area',
  ALL: 'Semua Area',
};

interface FinanceViewsProps {
  mode:
    | 'dana_pengajuan'
    | 'antrean_persetujuan'
    | 'riwayat_keputusan'
    | 'anggaran_area'
    | 'saldo_kas'
    | 'kas_basecamp'
    | 'buku_kas';
  state: SerpoState;
  session: ActiveSessionContext;
  contextId?: string | null;
  onNavigate: (route: RouteId, contextId?: string) => void;
  onSubmitFundRequest: (input: SubmitFundRequestInput) => SubmitFundRequestResult;
  onDecideFundRequest: (
    fundRequestId: number,
    decision: 'SETUJUI' | 'TOLAK',
    note?: string
  ) => FundDecisionResult;
  onRecordCashLedger: (payload: {
    basecampId: number;
    transactionType: 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
    amount: number;
    description: string;
    referenceNo: string;
  }) => { error?: string };
  onProposeCorrection: (payload: {
    findingId: string;
    type: 'REPAIR' | 'ADJUSTMENT';
    basecampId?: number;
    cashDelta: number;
    realizationDelta: number;
    reason: string;
  }) => { error?: string };
  onAddBudgetAllocation: (budgetId: number, extraAmount: number) => { error?: string };
}

export const FinanceViews: React.FC<FinanceViewsProps> = ({
  mode,
  state,
  session,
  contextId,
  onNavigate,
  onSubmitFundRequest,
  onDecideFundRequest,
  onRecordCashLedger,
  onProposeCorrection,
  onAddBudgetAllocation,
}) => {
  const [basecampFilter, setBasecampFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | FundRequestStatus>('ALL');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'ALL' | LedgerTransactionType>('ALL');

  // Detail & Decision Modal (D4)
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionFeedback, setDecisionFeedback] = useState<{
    tone: 'red' | 'green' | 'amber';
    text: string;
  } | null>(null);

  // Create Fund Request Modal (D3)
  const [createOpen, setCreateOpen] = useState(false);
  const [newBasecampId, setNewBasecampId] = useState<number>(session.basecamp?.id ?? 1);
  const [newDesc, setNewDesc] = useState('');
  const [newItems, setNewItems] = useState<
    { item_name: string; quantity: number; unit: string; unit_price: number }[]
  >([
    { item_name: 'BBM Pertalite Genset', quantity: 20, unit: 'liter', unit_price: 10000 },
    { item_name: 'Konektor SC/APC & Patchcord', quantity: 10, unit: 'pcs', unit_price: 25000 },
  ]);
  const [uploadedDoc, setUploadedDoc] = useState<ProcessedFundDocumentSuccess | null>(null);
  const [isCompressingDoc, setIsCompressingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);
  const [newClientUuid, setNewClientUuid] = useState(() => generateUniqueId('fr'));
  const [createFeedback, setCreateFeedback] = useState<{
    tone: 'red' | 'amber' | 'green';
    text: string;
  } | null>(null);

  // Budget allocation modal
  const [allocModalBudgetId, setAllocModalBudgetId] = useState<number | null>(null);
  const [extraBudgetAmount, setExtraBudgetAmount] = useState('2500000');
  const [allocError, setAllocError] = useState<string | null>(null);

  // Record Cash Ledger modal (EXPENSE / REFUND / ADJUSTMENT)
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerBasecampId, setLedgerBasecampId] = useState<number>(session.basecamp?.id ?? 1);
  const [ledgerType, setLedgerType] = useState<'EXPENSE' | 'REFUND' | 'ADJUSTMENT'>('EXPENSE');
  const [ledgerDirection, setLedgerDirection] = useState<'IN' | 'OUT'>('IN');
  const [ledgerAmount, setLedgerAmount] = useState('150000');
  const [ledgerRef, setLedgerRef] = useState(() =>
    generateSequentialLedgerRef(state.cashLedgers, 'EXPENSE', state.serverNowIso)
  );
  const [ledgerDesc, setLedgerDesc] = useState('');
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerNotice, setLedgerNotice] = useState<string | null>(null);

  const canAddBudgetAllocation = can(session.role.code, 'budget.addAllocation');
  const canExpense = can(session.role.code, 'ledger.expense');
  const canRefund = can(session.role.code, 'ledger.refund');
  const canAdjustment = can(session.role.code, 'ledger.adjustment');
  const canRecordAnyLedger = canExpense || canRefund || canAdjustment;
  const ledgerBasecamps =
    session.role.code === 'KOORDINATOR' && session.basecamp
      ? [session.basecamp]
      : state.basecamps;

  const activeBasecamp = useMemo(() => {
    const parsed = contextId ? Number(contextId) : NaN;
    return state.basecamps.find((b) => b.id === parsed) ?? state.basecamps[0];
  }, [state.basecamps, contextId]);

  const renderFundBadge = (status: FundRequestStatus) => {
    const label = FUND_STATUS_LABELS[status];
    if (status === 'APPROVED') return <StatusLabel tone="green" icon="check" label={label} />;
    if (status === 'REJECTED') return <StatusLabel tone="red" icon="error" label={label} />;
    if (status === 'IN_PROGRESS') return <StatusLabel tone="amber" icon="clock" label={label} />;
    return <StatusLabel tone="amber" icon="clock" label={label} />;
  };

  // 1. FUND REQUESTS / APPROVAL QUEUE / DECISION HISTORY
  if (
    mode === 'dana_pengajuan' ||
    mode === 'antrean_persetujuan' ||
    mode === 'riwayat_keputusan'
  ) {
    const pendingList = state.fundRequests.filter((r) => r.status === 'PENDING');
    const inProgressList = state.fundRequests.filter((r) => r.status === 'IN_PROGRESS');
    const approvedList = state.fundRequests.filter((r) => r.status === 'APPROVED');
    const rejectedList = state.fundRequests.filter((r) => r.status === 'REJECTED');

    const myQueue = getPendingApprovalsForUser(state, session.user.id);
    const myQueueIds = new Set(myQueue.map((q) => q.id));

    const baseList =
      mode === 'antrean_persetujuan'
        ? myQueue
        : mode === 'riwayat_keputusan'
        ? state.fundRequests.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
        : state.fundRequests;

    const filteredRequests = baseList.filter((r) => {
      if (basecampFilter !== 'all' && r.basecamp_id !== basecampFilter) return false;
      if (mode === 'dana_pengajuan' && statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      return true;
    });

    const selectedReq = state.fundRequests.find((r) => r.id === selectedReqId) ?? null;
    const selectedItems = selectedReq
      ? state.fundRequestItems.filter((it) => it.fund_request_id === selectedReq.id)
      : [];
    const selectedApprovals = selectedReq
      ? state.fundRequestApprovals
          .filter((a) => a.fund_request_id === selectedReq.id)
          .sort((a, b) => a.step_order - b.step_order)
      : [];
    const selectedDocs = selectedReq
      ? state.attachments.filter(
          (at) => at.purpose === 'REQUEST_DOCUMENT' && at.ref_id === selectedReq.id
        )
      : [];
    const selectedAuditFlag = selectedReq
      ? state.syncAuditLogs.find(
          (log) =>
            log.entity_type === 'FUND_REQUEST' &&
            log.entity_id === selectedReq.id &&
            log.outcome === 'ACCEPTED_FLAGGED' &&
            log.resolution_status === 'UNRESOLVED'
        )
      : undefined;
    const selectedPerm = selectedReq
      ? canUserActOnFundRequest(state, selectedReq.id, session.user.id)
      : { allowed: false };

    const draftTotal = newItems.reduce(
      (sum, it) => sum + Math.round((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
      0
    );
    const createBc = state.basecamps.find((b) => b.id === newBasecampId);
    const createBudget = createBc
      ? getActiveAreaBudget(state, createBc.area_id, state.currentDate)
      : undefined;

    const handleAction = (decision: 'SETUJUI' | 'TOLAK') => {
      if (!selectedReq) return;
      const res = onDecideFundRequest(selectedReq.id, decision, decisionNote);
      if (res.error) {
        setDecisionFeedback({ tone: 'red', text: res.error });
        return;
      }
      setDecisionNote('');
      setDecisionFeedback({
        tone: res.budgetAlertTriggered ? 'amber' : 'green',
        text: res.budgetAlertTriggered
          ? 'Persetujuan final berhasil! Saldo kas basecamp telah ditambahkan dan peringatan ambang anggaran dikirim ke Management & Koordinator.'
          : decision === 'SETUJUI'
          ? 'Keputusan setuju berhasil disimpan.'
          : 'Pengajuan dana berhasil ditolak.',
      });
    };

    const handleSelectDocFile = async (file: File | null | undefined) => {
      if (!file) return;
      setIsCompressingDoc(true);
      setDocUploadError(null);
      setCreateFeedback(null);
      try {
        const result = await processFundDocumentUpload(file);
        if (!result.ok) {
          setUploadedDoc(null);
          setDocUploadError(result.error);
          return;
        }
        setUploadedDoc(result);
        setDocUploadError(null);
      } catch {
        setUploadedDoc(null);
        setDocUploadError('Gagal memproses atau mengompres berkas. Coba berkas lain.');
      } finally {
        setIsCompressingDoc(false);
      }
    };

    const handleClearUploadedDoc = () => {
      setUploadedDoc(null);
      setDocUploadError(null);
      if (docFileInputRef.current) {
        docFileInputRef.current.value = '';
      }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (isCompressingDoc) {
        setCreateFeedback({
          tone: 'amber',
          text: 'Proses kompresi dokumen masih berjalan. Tunggu sebentar sebelum mengirim.',
        });
        return;
      }

      const res = onSubmitFundRequest({
        requesterId: session.user.id,
        basecampId: newBasecampId,
        description: newDesc,
        items: newItems,
        doc_path: uploadedDoc?.virtualPath ?? '',
        doc_sha256: uploadedDoc?.sha256 ?? '',
        doc_size_kb: uploadedDoc?.compressedSizeKb ?? NaN,
        client_uuid: newClientUuid,
      });

      if (res.queuedOffline) {
        setCreateFeedback({
          tone: 'amber',
          text: 'Mode offline aktif: pengajuan dana dan rincian item disimpan ke antrean sinkronisasi lokal.',
        });
        setNewClientUuid(generateUniqueId('fr'));
        handleClearUploadedDoc();
        return;
      }
      if (res.error) {
        setCreateFeedback({ tone: 'red', text: res.error });
        return;
      }
      if (res.idempotentHit) {
        setCreateFeedback({
          tone: 'amber',
          text: `Permintaan yang sama sudah tercatat pada pengajuan ${res.fundRequest?.request_no} tanpa membuat duplikat.`,
        });
        return;
      }

      setCreateFeedback({
        tone: 'green',
        text: `Pengajuan ${res.fundRequest?.request_no} berhasil dibuat dan notifikasi persetujuan tahap 1 dikirim ke Manajer Area.`,
      });
      setNewDesc('');
      setNewClientUuid(generateUniqueId('fr'));
      handleClearUploadedDoc();
    };

    const pageTitle =
      mode === 'antrean_persetujuan'
        ? 'Antrean Persetujuan'
        : mode === 'riwayat_keputusan'
        ? 'Riwayat Keputusan'
        : 'Pengajuan Dana Operasional';

    const pageSubtitle =
      mode === 'antrean_persetujuan'
        ? `Persetujuan berjenjang operasional basecamp · Peran aktif: ${session.role.name}`
        : mode === 'riwayat_keputusan'
        ? 'Daftar pengajuan dana yang telah berstatus Disetujui atau Ditolak'
        : 'Pengajuan isi saldo kas basecamp beserta rincian kebutuhan dan dokumen pendukung';

    return (
      <div className="space-y-5">
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          action={
            <button
              type="button"
              onClick={() => {
                setCreateFeedback(null);
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ajukan Dana</span>
            </button>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Menunggu (Tahap 1)</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">{pendingList.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B] tabular-nums">
              Rp {formatJuta(pendingList.reduce((s, r) => s + r.amount, 0), 2)} jt
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Diproses (Tahap 2 Finance)</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
              {inProgressList.length}
            </p>
            <p className="mt-1.5 text-xs text-[#64748B] tabular-nums">
              Rp {formatJuta(inProgressList.reduce((s, r) => s + r.amount, 0), 2)} jt
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Disetujui (Masuk Kas)</p>
            <p className="mt-2 text-2xl font-bold text-[#047857] tabular-nums">{approvedList.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B]">Menambah saldo kas basecamp</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Ditolak</p>
            <p className="mt-2 text-2xl font-bold text-[#E61E25] tabular-nums">{rejectedList.length}</p>
            <p className="mt-1.5 text-xs text-[#64748B]">Dengan catatan penolakan</p>
          </div>
        </div>

        {/* Filters */}
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

          {mode === 'dana_pengajuan' && (
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
              <span className="text-[#64748B]">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | FundRequestStatus)}
                className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
              >
                <option value="ALL">Semua</option>
                <option value="PENDING">Menunggu</option>
                <option value="IN_PROGRESS">Diproses</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </label>
          )}
        </div>

        {/* Requests Table */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0F172A]">
              {mode === 'antrean_persetujuan'
                ? 'Menunggu Keputusan Anda'
                : mode === 'riwayat_keputusan'
                ? 'Keputusan Final'
                : 'Daftar Pengajuan Dana'}
            </h2>
            <span className="text-xs text-[#64748B] tabular-nums">
              {filteredRequests.length} pengajuan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Nomor Pengajuan</th>
                  <th className="py-2.5 px-4">Keterangan & Rincian</th>
                  <th className="py-2.5 px-4">Basecamp / Area</th>
                  <th className="py-2.5 px-4">Pemohon</th>
                  <th className="py-2.5 px-4 text-right">Total (Rp)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#64748B]">
                      Tidak ada pengajuan dana pada antrean ini untuk peran {session.role.name}.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const bc = state.basecamps.find((b) => b.id === req.basecamp_id);
                    const area = bc ? state.areas.find((a) => a.id === bc.area_id) : undefined;
                    const requester = state.users.find((u) => u.id === req.requester_id);
                    const itemCount = state.fundRequestItems.filter(
                      (i) => i.fund_request_id === req.id
                    ).length;
                    const hasUnresolvedAudit = state.syncAuditLogs.some(
                      (l) =>
                        l.entity_type === 'FUND_REQUEST' &&
                        l.entity_id === req.id &&
                        l.outcome === 'ACCEPTED_FLAGGED' &&
                        l.resolution_status === 'UNRESOLVED'
                    );
                    const canDecide = myQueueIds.has(req.id);

                    return (
                      <tr key={req.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-5 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#F1F5F9] font-mono text-xs font-semibold text-[#0F172A]">
                            {req.request_no}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-medium text-[#0F172A]">{req.description}</span>
                          <span className="block text-[11px] text-[#64748B]">
                            {itemCount} item · {formatDateShortId(req.created_at)}
                          </span>
                          {hasUnresolvedAudit && (
                            <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-[#B45309]">
                              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                              Perlu verifikasi audit sebelum persetujuan final
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="block font-medium text-[#0F172A]">{bc?.name}</span>
                          <span className="text-[#64748B]">{area?.name}</span>
                        </td>
                        <td className="py-3 px-4 text-[#334155] text-xs">{requester?.full_name}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                          {formatNumberId(req.amount)}
                        </td>
                        <td className="py-3 px-4">{renderFundBadge(req.status)}</td>
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReqId(req.id);
                              setDecisionNote('');
                              setDecisionFeedback(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                              canDecide
                                ? 'bg-[#0A4B8F] text-white hover:bg-[#083C73]'
                                : 'bg-white border border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]'
                            }`}
                          >
                            {canDecide ? 'Putuskan' : 'Detail'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detail & Approval Modal */}
        <Modal
          open={selectedReq !== null}
          onClose={() => setSelectedReqId(null)}
          ariaLabelledBy="fund-decision-title"
          maxWidthClass="max-w-2xl"
        >
          {selectedReq && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#0A4B8F]">
                    {selectedReq.request_no} · Ref. Pengajuan: {selectedReq.client_uuid.slice(0, 18)}…
                  </span>
                  <h3 id="fund-decision-title" className="text-base font-bold text-[#0F172A] mt-0.5">
                    {selectedReq.description}
                  </h3>
                  <p className="text-xs text-[#475569] mt-0.5">
                    {state.basecamps.find((b) => b.id === selectedReq.basecamp_id)?.name} · Pemohon:{' '}
                    {state.users.find((u) => u.id === selectedReq.requester_id)?.full_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReqId(null)}
                  className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                  aria-label="Tutup dialog pengajuan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedAuditFlag && (
                <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#8E5805] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong>
                      Peringatan Audit Belum Selesai ({AGE_FLAG_LABELS[selectedAuditFlag.age_flag] ?? selectedAuditFlag.age_flag}):
                    </strong>{' '}
                    {selectedAuditFlag.flag_reasons.join(', ')}. Persetujuan final ditahan hingga audit diselesaikan.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReqId(null);
                      onNavigate('antrean_audit');
                    }}
                    className="font-semibold underline text-[#0F172A]"
                  >
                    Buka Antrean Audit
                  </button>
                </div>
              )}

              {/* Item breakdown */}
              <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <div className="px-3.5 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#334155]">
                  <span>Rincian Kebutuhan</span>
                  <span className="font-mono text-[#0F172A]">Total {formatRupiah(selectedReq.amount)}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 px-3.5">Item</th>
                      <th className="py-2 px-3 text-right">Jumlah</th>
                      <th className="py-2 px-3 text-right">Harga Satuan</th>
                      <th className="py-2 px-3.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {selectedItems.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3.5 font-medium text-[#0F172A]">{it.item_name}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatNumberId(it.unit_price)}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono font-semibold tabular-nums">
                          {formatNumberId(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Document Attachments */}
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                <span className="font-semibold text-[#334155] inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0A4B8F]" aria-hidden="true" />
                  <span>Lampiran Dokumen Pengajuan</span>
                </span>
                {selectedDocs.length === 0 ? (
                  <p className="text-[#64748B]">Tidak ada lampiran</p>
                ) : (
                  selectedDocs.map((doc) => (
                    <p key={doc.id} className="font-mono text-[11px] text-[#475569]">
                      {doc.file_path} · {formatFileSizeKb(doc.file_size_kb)}
                    </p>
                  ))
                )}
              </div>

              {/* Approval Stepper */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#334155]">Alur Persetujuan Berjenjang</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedApprovals.map((app) => {
                    const step = state.approvalFlowSteps.find((s) => s.id === app.flow_step_id);
                    const stepRole = step ? state.roles.find((r) => r.id === step.approver_role_id) : undefined;
                    const actor = app.approver_user_id
                      ? state.users.find((u) => u.id === app.approver_user_id)
                      : undefined;
                    return (
                      <div key={app.id} className="p-3 rounded-lg border border-[#E2E8F0] bg-white text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#0F172A]">
                            Tahap {app.step_order}: {stepRole?.name ?? stepRole?.code} ({SCOPE_LABELS[step?.scope ?? ''] ?? step?.scope})
                          </span>
                          <StatusLabel
                            tone={
                              app.status === 'APPROVED'
                                ? 'green'
                                : app.status === 'REJECTED' || app.status === 'CANCELLED'
                                ? 'red'
                                : app.status === 'PENDING'
                                ? 'amber'
                                : 'gray'
                            }
                            label={APPROVAL_STEP_STATUS_LABELS[app.status] ?? app.status}
                          />
                        </div>
                        {actor && (
                          <p className="text-[#475569]">
                            Oleh {actor.full_name} · {formatTimeWita(app.acted_at)} WITA
                          </p>
                        )}
                        {app.note && <p className="text-[#334155] italic">"{app.note}"</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Decision Controls */}
              {selectedPerm.allowed ? (
                <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
                  <label htmlFor="decision-note" className="block text-xs font-semibold text-[#334155]">
                    Catatan keputusan (wajib jika menolak)
                  </label>
                  <textarea
                    id="decision-note"
                    rows={2}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Tulis alasan persetujuan atau penolakan..."
                    className="w-full p-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#0A4B8F]"
                  />

                  {decisionFeedback && (
                    <p
                      role="alert"
                      className={`p-2.5 rounded-lg text-xs font-medium ${
                        decisionFeedback.tone === 'red'
                          ? 'bg-[#FEF2F2] text-[#E61E25]'
                          : decisionFeedback.tone === 'amber'
                          ? 'bg-[#FFFBEB] text-[#B45309]'
                          : 'bg-[#EFF6FF] text-[#083C73]'
                      }`}
                    >
                      {decisionFeedback.text}
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction('TOLAK')}
                      className="px-4 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#E61E25] text-xs font-semibold hover:bg-[#FEE2E2]"
                    >
                      Tolak Pengajuan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('SETUJUI')}
                      className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
                    >
                      {selectedReq.status === 'IN_PROGRESS'
                        ? 'Setujui Final & Cairkan Dana'
                        : 'Setujui ke Finance'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                  {decisionFeedback ? (
                    <p
                      role="status"
                      className={`p-2.5 rounded-lg text-xs font-medium ${
                        decisionFeedback.tone === 'amber'
                          ? 'bg-[#FFFBEB] text-[#B45309]'
                          : 'bg-[#EFF6FF] text-[#083C73]'
                      }`}
                    >
                      {decisionFeedback.text}
                    </p>
                  ) : (
                    <p className="text-xs text-[#64748B]">
                      {selectedPerm.error ?? 'Pengajuan ini sudah tidak berada pada giliran Anda.'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Modal>

        {/* Create Fund Request Modal */}
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          ariaLabelledBy="create-fund-title"
          maxWidthClass="max-w-2xl"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 id="create-fund-title" className="text-base font-bold text-[#0F172A]">
                Ajukan Dana Operasional
              </h3>
              <p className="text-xs text-[#475569] mt-0.5">
                Total dihitung otomatis dari rincian kebutuhan dan lampiran dokumen maksimal 2 MB.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Tutup form pengajuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-[#334155] mb-1">Basecamp tujuan</span>
                <select
                  value={newBasecampId}
                  onChange={(e) => setNewBasecampId(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white"
                >
                  {state.basecamps.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs flex flex-col justify-center">
                <span className="text-[#64748B]">Sisa anggaran area aktif:</span>
                <span className="font-mono font-bold text-[#0F172A] mt-0.5">
                  {createBudget
                    ? formatRupiah(createBudget.allocated_amount - createBudget.realized_amount)
                    : 'Tidak ada anggaran aktif'}
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="req-desc" className="block text-xs font-semibold text-[#334155] mb-1">
                Keterangan pengajuan
              </label>
              <input
                id="req-desc"
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Contoh: Isi saldo BBM genset & perlengkapan sambung FO"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#0A4B8F]"
              />
            </div>

            {/* Itemized Builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#334155]">Rincian Kebutuhan</span>
                <button
                  type="button"
                  onClick={() =>
                    setNewItems((prev) => [
                      ...prev,
                      { item_name: '', quantity: 1, unit: 'pcs', unit_price: 50000 },
                    ])
                  }
                  className="text-xs font-semibold text-[#0A4B8F] hover:underline"
                >
                  + Tambah item
                </button>
              </div>

              <div className="space-y-2">
                {newItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Nama item"
                      value={it.item_name}
                      onChange={(e) =>
                        setNewItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, item_name: e.target.value } : row
                          )
                        )
                      }
                      className="col-span-5 h-9 px-2.5 rounded-lg border border-[#E2E8F0] text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) =>
                        setNewItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, quantity: Number(e.target.value) } : row
                          )
                        )
                      }
                      className="col-span-2 h-9 px-2 rounded-lg border border-[#E2E8F0] text-xs tabular-nums"
                      aria-label={`Jumlah item ${idx + 1}`}
                    />
                    <input
                      type="text"
                      value={it.unit}
                      onChange={(e) =>
                        setNewItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, unit: e.target.value } : row))
                        )
                      }
                      className="col-span-2 h-9 px-2 rounded-lg border border-[#E2E8F0] text-xs"
                      aria-label={`Satuan item ${idx + 1}`}
                    />
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={it.unit_price}
                      onChange={(e) =>
                        setNewItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, unit_price: Number(e.target.value) } : row
                          )
                        )
                      }
                      className="col-span-2 h-9 px-2 rounded-lg border border-[#E2E8F0] font-mono text-xs tabular-nums"
                      aria-label={`Harga item ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      disabled={newItems.length <= 1}
                      className="col-span-1 h-9 flex items-center justify-center text-[#64748B] hover:text-[#E61E25] disabled:opacity-40"
                      aria-label={`Hapus item ${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-right text-xs font-bold text-[#0F172A] tabular-nums">
                Total Pengajuan: {formatRupiah(draftTotal)}
              </div>
            </div>

            {/* Compressed Document Upload (max 2 MB, auto-compressed if > 2 MB) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="fund-doc-upload"
                  className="block text-[11px] font-semibold text-[#334155]"
                >
                  Dokumen Pendukung (Maksimal 2 MB)
                </label>
                <span className="text-[11px] text-[#64748B]">
                  PDF, JPG, PNG, WEBP · Maks. 2 MB (2.048 KB)
                </span>
              </div>

              <input
                ref={docFileInputRef}
                id="fund-doc-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  void handleSelectDocFile(selected);
                }}
                className="sr-only"
              />

              {uploadedDoc ? (
                <div className="p-3 rounded-lg border border-[#BAE6FD] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0 flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-4 h-4 text-[#047857] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">
                        {uploadedDoc.sanitizedName}
                      </p>
                      <p className="text-[11px] text-[#475569] tabular-nums">
                        {uploadedDoc.wasCompressed ? (
                          <>
                            Terkompres (&gt; 2 MB → ≤ 2 MB): {formatFileSizeKb(uploadedDoc.originalSizeKb)} →{' '}
                            <strong className="text-[#047857]">
                              {formatFileSizeKb(uploadedDoc.compressedSizeKb)}
                            </strong>
                          </>
                        ) : (
                          <>
                            Ukuran berkas:{' '}
                            <strong className="text-[#047857]">
                              {formatFileSizeKb(uploadedDoc.compressedSizeKb)}
                            </strong>
                          </>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-[#64748B] truncate">
                        {uploadedDoc.virtualPath} · SHA-256: {uploadedDoc.sha256.slice(0, 12)}…
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => docFileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-md border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#0A4B8F] hover:bg-[#F1F5F9]"
                    >
                      Ganti Berkas
                    </button>
                    <button
                      type="button"
                      onClick={handleClearUploadedDoc}
                      className="px-2.5 py-1.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[11px] font-semibold text-[#E61E25] hover:bg-[#FEE2E2]"
                      aria-label="Hapus lampiran dokumen"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(true);
                  }}
                  onDragLeave={() => setIsDraggingDoc(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(false);
                    const dropped = e.dataTransfer.files?.[0];
                    void handleSelectDocFile(dropped);
                  }}
                  className={`p-3.5 rounded-lg border border-dashed transition-colors flex flex-wrap items-center justify-between gap-3 ${
                    isDraggingDoc
                      ? 'border-[#0A4B8F] bg-[#EFF6FF]'
                      : 'border-[#CBD5E1] bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4 text-[#0A4B8F]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A]">
                        {isCompressingDoc
                          ? 'Mengompres dokumen agar tidak melebihi 2 MB...'
                          : 'Unggah lampiran nota atau penawaran'}
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        Maksimal 2 MB · gambar &gt; 2 MB dikompres otomatis
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isCompressingDoc}
                    onClick={() => docFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#CBD5E1] hover:border-[#0A4B8F] text-xs font-semibold text-[#0A4B8F] disabled:opacity-50 shrink-0"
                  >
                    {isCompressingDoc ? 'Memproses...' : 'Pilih Berkas'}
                  </button>
                </div>
              )}

              {docUploadError && (
                <p
                  role="alert"
                  className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[11px] font-medium text-[#E61E25]"
                >
                  {docUploadError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748B] bg-[#F8FAFC] px-3 py-2 rounded-lg border border-[#E2E8F0]">
              <span>
                Kode Referensi Unik: <strong className="font-mono text-[#0F172A]">{newClientUuid}</strong>
              </span>
              <button
                type="button"
                onClick={() => setNewClientUuid(generateUniqueId('fr'))}
                className="font-semibold text-[#0A4B8F] hover:underline"
              >
                Buat kode baru
              </button>
            </div>

            {createFeedback && (
              <p
                role="alert"
                className={`p-3 rounded-lg text-xs font-medium ${
                  createFeedback.tone === 'red'
                    ? 'bg-[#FEF2F2] text-[#E61E25]'
                    : createFeedback.tone === 'amber'
                    ? 'bg-[#FFFBEB] text-[#B45309]'
                    : 'bg-[#EFF6FF] text-[#083C73]'
                }`}
              >
                {createFeedback.text}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
              >
                {state.networkOnline ? 'Kirim Pengajuan' : 'Simpan ke Antrean Offline'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // 2. ANGGARAN AREA (Budgets per area + TOP_UP breakdown)
  if (mode === 'anggaran_area') {
    const topUps = state.cashLedgers.filter((l) => l.transaction_type === 'TOP_UP');
    return (
      <div className="space-y-5">
        <PageHeader
          title="Anggaran per Area"
          subtitle="Realisasi dihitung dari transaksi isi saldo buku kas dalam periode aktif · ambang peringatan bawaan 90%"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.budgets.map((b) => {
            const area = state.areas.find((a) => a.id === b.area_id);
            const pct = getBudgetAbsorptionPct(b.realized_amount, b.allocated_amount);
            const status = getAreaBudgetStatus(b);
            return (
              <div key={b.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-[#64748B]">{area?.code} · {b.period_label}</span>
                    <h2 className="text-base font-bold text-[#0F172A]">{area?.name}</h2>
                  </div>
                  {status === 'ALERT' ? (
                    <StatusLabel
                      tone="red"
                      icon="error"
                      label={`Melebihi Ambang (>${formatPercent(b.alert_threshold, 0)})`}
                    />
                  ) : (
                    <StatusLabel
                      tone="green"
                      icon="check"
                      label={`Normal (≤${formatPercent(b.alert_threshold, 0)})`}
                    />
                  )}
                </div>

                <BudgetMeter
                  pct={pct}
                  warningThresholdPct={b.alert_threshold}
                  status={status === 'ALERT' ? 'Melebihi budget' : pct >= 80 ? 'Waspada' : 'Aman'}
                />

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2E8F0] text-xs">
                  <div>
                    <span className="text-[#64748B] block">Alokasi Anggaran</span>
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {formatRupiah(b.allocated_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Realisasi</span>
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {formatRupiah(b.realized_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Sisa</span>
                    <span className="font-mono font-semibold text-[#047857] tabular-nums">
                      {formatRupiah(b.allocated_amount - b.realized_amount)}
                    </span>
                  </div>
                </div>

                {canAddBudgetAllocation && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAllocError(null);
                        setAllocModalBudgetId(b.id);
                      }}
                      className="text-xs font-semibold text-[#0A4B8F] hover:underline"
                    >
                      + Tambah Alokasi Anggaran
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Pembentuk Realisasi (Transaksi Isi Saldo)</h2>
            <span className="text-xs text-[#64748B] tabular-nums">{topUps.length} transaksi isi saldo</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Tanggal</th>
                  <th className="py-2.5 px-4">Basecamp / Area</th>
                  <th className="py-2.5 px-4">Referensi</th>
                  <th className="py-2.5 px-4">Keterangan</th>
                  <th className="py-2.5 px-5 text-right">Isi Saldo (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {topUps.map((l) => {
                  const bc = state.basecamps.find((b) => b.id === l.basecamp_id);
                  const area = bc ? state.areas.find((a) => a.id === bc.area_id) : undefined;
                  return (
                    <tr key={l.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-5 text-xs text-[#475569]">{formatDateShortId(l.created_at)}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-semibold text-[#0F172A]">{bc?.name}</span>{' '}
                        <span className="text-[#64748B]">({area?.name})</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#0A4B8F]">{l.reference_no}</td>
                      <td className="py-3 px-4 text-xs text-[#334155]">{l.description}</td>
                      <td className="py-3 px-5 text-right font-mono text-xs font-semibold tabular-nums">
                        +{formatNumberId(l.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <Modal
          open={allocModalBudgetId !== null}
          onClose={() => {
            setAllocError(null);
            setAllocModalBudgetId(null);
          }}
          ariaLabelledBy="alloc-budget-title"
          maxWidthClass="max-w-sm"
        >
          <h3 id="alloc-budget-title" className="text-base font-bold text-[#0F172A]">
            Tambah Alokasi Anggaran
          </h3>
          <label className="block">
            <span className="block text-xs font-semibold text-[#334155] mb-1">Tambahan alokasi (Rp)</span>
            <input
              type="number"
              min={500000}
              step={500000}
              value={extraBudgetAmount}
              onChange={(e) => setExtraBudgetAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm tabular-nums"
            />
          </label>
          {allocError && (
            <p className="text-xs font-medium text-[#E61E25]" role="alert">
              {allocError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAllocError(null);
                setAllocModalBudgetId(null);
              }}
              className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (allocModalBudgetId === null) return;
                const parsedExtra =
                  extraBudgetAmount.trim() === '' ? NaN : Number(extraBudgetAmount);
                const res = onAddBudgetAllocation(
                  allocModalBudgetId,
                  parsedExtra
                );
                if (res.error) {
                  setAllocError(res.error);
                } else {
                  setAllocError(null);
                  setAllocModalBudgetId(null);
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold"
            >
              Simpan
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // 3. BUKU KAS (Cash_Ledgers)
  if (mode === 'buku_kas') {
    const filteredLedgers = state.cashLedgers.filter((l) => {
      if (basecampFilter !== 'all' && l.basecamp_id !== basecampFilter) return false;
      if (ledgerTypeFilter !== 'ALL' && l.transaction_type !== ledgerTypeFilter) return false;
      return true;
    });

    const handleExportLedgersPdf = () => {
      const basecampLabel =
        basecampFilter === 'all'
          ? `Semua (${state.basecamps.length})`
          : state.basecamps.find((b) => b.id === basecampFilter)?.name ?? `Basecamp #${basecampFilter}`;
      const typeLabel =
        ledgerTypeFilter === 'ALL'
          ? 'Semua Jenis'
          : `${LEDGER_TYPE_LABELS[ledgerTypeFilter]} (${
              ledgerTypeFilter === 'EXPENSE'
                ? 'Keluar'
                : ledgerTypeFilter === 'TOP_UP' || ledgerTypeFilter === 'REFUND'
                ? 'Masuk'
                : 'Semua Arah'
            })`;

      downloadCashLedgerPdf({
        ledgers: filteredLedgers,
        basecamps: state.basecamps,
        basecampLabel,
        typeLabel,
        filename: 'sim-serpo-buku-kas.pdf',
      });
    };

    return (
      <div className="space-y-5">
        <PageHeader
          title="Buku Kas"
          subtitle="Catatan tunggal mutasi kas basecamp: Isi Saldo, Pengeluaran, Pengembalian, dan Penyesuaian"
          action={
            <div className="flex items-center gap-2">
              {canRecordAnyLedger && (
                <button
                  type="button"
                  onClick={() => {
                    const initialType: 'EXPENSE' | 'REFUND' | 'ADJUSTMENT' = canExpense
                      ? 'EXPENSE'
                      : canRefund
                      ? 'REFUND'
                      : 'ADJUSTMENT';
                    setLedgerError(null);
                    setLedgerNotice(null);
                    setLedgerBasecampId(ledgerBasecamps[0]?.id ?? 1);
                    setLedgerType(initialType);
                    setLedgerDirection('IN');
                    setLedgerRef(
                      generateSequentialLedgerRef(
                        state.cashLedgers,
                        initialType,
                        state.serverNowIso
                      )
                    );
                    setLedgerModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Catat Mutasi Kas</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleExportLedgersPdf}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ekspor PDF</span>
              </button>
            </div>
          }
        />

        {ledgerNotice && (
          <div
            role="status"
            className="px-4 py-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-medium text-[#083C73] flex flex-wrap items-center justify-between gap-2"
          >
            <span>{ledgerNotice}</span>
            <button
              type="button"
              onClick={() => setLedgerNotice(null)}
              className="font-semibold underline"
            >
              Tutup
            </button>
          </div>
        )}

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
            <span className="text-[#64748B]">Jenis Mutasi</span>
            <select
              value={ledgerTypeFilter}
              onChange={(e) => setLedgerTypeFilter(e.target.value as 'ALL' | LedgerTransactionType)}
              className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
            >
              <option value="ALL">Semua</option>
              <option value="TOP_UP">Isi Saldo (Masuk)</option>
              <option value="EXPENSE">Pengeluaran (Keluar)</option>
              <option value="REFUND">Pengembalian (Masuk)</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
            </select>
          </label>
        </div>

        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Daftar Mutasi Buku Kas</h2>
            <span className="text-xs text-[#64748B] tabular-nums">{filteredLedgers.length} mutasi</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Waktu</th>
                  <th className="py-2.5 px-4">Basecamp</th>
                  <th className="py-2.5 px-4">Jenis / Arah</th>
                  <th className="py-2.5 px-4">Keterangan & Referensi</th>
                  <th className="py-2.5 px-4 text-right">Nominal (Rp)</th>
                  <th className="py-2.5 px-5 text-right">Saldo Sesudah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredLedgers.map((l) => {
                  const bc = state.basecamps.find((b) => b.id === l.basecamp_id);
                  return (
                    <tr key={l.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-5 text-xs text-[#475569] tabular-nums">
                        {formatDateShortId(l.created_at)} · {formatTimeWita(l.created_at)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-[#0F172A]">{bc?.name}</td>
                      <td className="py-3 px-4">
                        <StatusLabel
                          tone={l.direction === 'IN' ? 'green' : 'amber'}
                          label={`${LEDGER_TYPE_LABELS[l.transaction_type]} (${DIRECTION_LABELS[l.direction]})`}
                        />
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="block font-medium text-[#0F172A]">{l.description}</span>
                        <span className="font-mono text-[11px] text-[#64748B]">{l.reference_no}</span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                          l.direction === 'IN' ? 'text-[#047857]' : 'text-[#E61E25]'
                        }`}
                      >
                        {l.direction === 'IN' ? '+' : '−'}
                        {formatNumberId(l.amount)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-xs tabular-nums text-[#0F172A]">
                        {formatRupiah(l.balance_after)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <Modal
          open={ledgerModalOpen}
          onClose={() => setLedgerModalOpen(false)}
          ariaLabelledBy="ledger-modal-title"
          maxWidthClass="max-w-md"
        >
          <div className="flex items-center justify-between">
            <h3 id="ledger-modal-title" className="text-base font-bold text-[#0F172A]">
              Catat Mutasi Buku Kas
            </h3>
            <button
              type="button"
              onClick={() => setLedgerModalOpen(false)}
              className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Tutup dialog kas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const parsedAmount =
                ledgerAmount.trim() === '' ? NaN : Number(ledgerAmount);
              if (ledgerType === 'ADJUSTMENT') {
                if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                  setLedgerError('Nominal mutasi kas harus berupa angka positif yang valid.');
                  return;
                }
                const openFinding = state.findings.find(
                  (f) => f.basecamp_id === ledgerBasecampId && f.status === 'Terbuka'
                );
                const signedDelta =
                  ledgerDirection === 'IN' ? parsedAmount : -parsedAmount;
                const res = onProposeCorrection({
                  findingId: openFinding?.id ?? `MANUAL-ADJ-${ledgerBasecampId}`,
                  type: 'ADJUSTMENT',
                  basecampId: ledgerBasecampId,
                  cashDelta: signedDelta,
                  realizationDelta: 0,
                  reason: ledgerDesc,
                });
                if (res.error) {
                  setLedgerError(res.error);
                  return;
                }
                const bcName =
                  state.basecamps.find((b) => b.id === ledgerBasecampId)?.name ??
                  `Basecamp #${ledgerBasecampId}`;
                setLedgerNotice(
                  `Usulan penyesuaian (${DIRECTION_LABELS[ledgerDirection]}) untuk ${bcName} dikirim ke Usulan & Persetujuan Koreksi untuk persetujuan Management.`
                );
                setLedgerDesc('');
                setLedgerModalOpen(false);
                return;
              }

              const res = onRecordCashLedger({
                basecampId: ledgerBasecampId,
                transactionType: ledgerType,
                amount: parsedAmount,
                description: ledgerDesc,
                referenceNo: ledgerRef,
              });
              if (res.error) {
                setLedgerError(res.error);
                return;
              }
              setLedgerNotice(null);
              setLedgerDesc('');
              setLedgerModalOpen(false);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-[#334155] mb-1">Basecamp</span>
                <select
                  value={ledgerBasecampId}
                  disabled={session.role.code === 'KOORDINATOR'}
                  onChange={(e) => setLedgerBasecampId(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white disabled:bg-[#F8FAFC] disabled:text-[#475569]"
                >
                  {ledgerBasecamps.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({formatRupiah(getBasecampBalance(state, b.id))})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[#334155] mb-1">Jenis</span>
                <select
                  value={ledgerType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
                    setLedgerType(nextType);
                    setLedgerRef(
                      generateSequentialLedgerRef(
                        state.cashLedgers,
                        nextType,
                        state.serverNowIso
                      )
                    );
                    setLedgerError(null);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white"
                >
                  {canExpense && <option value="EXPENSE">Pengeluaran (Keluar)</option>}
                  {canRefund && <option value="REFUND">Pengembalian (Masuk)</option>}
                  {canAdjustment && (
                    <option value="ADJUSTMENT">Penyesuaian (Usulan Koreksi)</option>
                  )}
                </select>
              </label>
            </div>
            {ledgerType === 'ADJUSTMENT' && (
              <div className="space-y-2">
                <label className="block">
                  <span className="block text-xs font-semibold text-[#334155] mb-1">
                    Arah penyesuaian
                  </span>
                  <select
                    value={ledgerDirection}
                    onChange={(e) => setLedgerDirection(e.target.value as 'IN' | 'OUT')}
                    className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white"
                  >
                    <option value="IN">Masuk — Tambah saldo kas</option>
                    <option value="OUT">Keluar — Kurangi saldo kas</option>
                  </select>
                </label>
                <p className="text-[11px] text-[#083C73] bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-3 py-2">
                  Penyesuaian tidak langsung mengubah buku kas, melainkan mengirim usulan koreksi untuk disetujui Management (penyetuju bukan pengusul).
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-[#334155] mb-1">Nominal (Rp)</span>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={ledgerAmount}
                  onChange={(e) => setLedgerAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[#334155] mb-1">Referensi</span>
                <input
                  type="text"
                  value={ledgerRef}
                  onChange={(e) => setLedgerRef(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] font-mono text-xs"
                />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-[#334155] mb-1">Keterangan</span>
              <input
                type="text"
                value={ledgerDesc}
                onChange={(e) => setLedgerDesc(e.target.value)}
                placeholder="Contoh: Pembelian BBM lapangan tim ODP"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm"
              />
            </label>
            {ledgerError && (
              <p className="text-xs font-medium text-[#E61E25]" role="alert">
                {ledgerError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLedgerModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold"
              >
                {ledgerType === 'ADJUSTMENT' ? 'Kirim Usulan Koreksi' : 'Simpan Mutasi'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // 4. SALDO KAS BASECAMP & DRILLDOWN (Basecamp_Cash_Balances)
  if (mode === 'kas_basecamp') {
    const bcLedgers = state.cashLedgers.filter((l) => l.basecamp_id === activeBasecamp.id);
    const bcBal = getBasecampBalance(state, activeBasecamp.id);
    const area = state.areas.find((a) => a.id === activeBasecamp.area_id);
    const coordPlacement = state.userPlacements.find((p) => {
      if (!p.is_current || p.basecamp_id !== activeBasecamp.id) return false;
      const u = state.users.find((us) => us.id === p.user_id);
      return u?.role_id === 2;
    });
    const coordinator = coordPlacement
      ? state.users.find((u) => u.id === coordPlacement.user_id)
      : undefined;

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onNavigate('saldo_kas')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A4B8F] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Kembali ke Saldo kas basecamp</span>
        </button>

        <PageHeader
          title={`Kas Basecamp · ${activeBasecamp.name}`}
          subtitle={`${area?.name} · Koordinator: ${coordinator?.full_name ?? 'Belum ditetapkan'}`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Saldo Kas Saat Ini</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">{formatRupiah(bcBal)}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Total Isi Saldo Tercatat</p>
            <p className="mt-2 text-2xl font-bold text-[#047857] tabular-nums">
              {formatRupiah(
                bcLedgers
                  .filter((l) => l.transaction_type === 'TOP_UP')
                  .reduce((s, l) => s + l.amount, 0)
              )}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#475569]">Total Pengeluaran Tercatat</p>
            <p className="mt-2 text-2xl font-bold text-[#B45309] tabular-nums">
              {formatRupiah(
                bcLedgers
                  .filter((l) => l.transaction_type === 'EXPENSE')
                  .reduce((s, l) => s + l.amount, 0)
              )}
            </p>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-bold text-[#0F172A]">Riwayat Buku Kas {activeBasecamp.name}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                  <th className="py-2.5 px-5">Waktu</th>
                  <th className="py-2.5 px-4">Jenis</th>
                  <th className="py-2.5 px-4">Keterangan</th>
                  <th className="py-2.5 px-4 text-right">Nominal</th>
                  <th className="py-2.5 px-5 text-right">Saldo Sesudah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {bcLedgers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[#64748B]">
                      Belum ada mutasi pada basecamp ini.
                    </td>
                  </tr>
                ) : (
                  bcLedgers.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-5 text-xs text-[#475569]">
                        {formatDateShortId(l.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel
                          tone={l.direction === 'IN' ? 'green' : 'amber'}
                          label={`${LEDGER_TYPE_LABELS[l.transaction_type]} (${DIRECTION_LABELS[l.direction]})`}
                        />
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-[#0F172A]">{l.description}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {l.direction === 'IN' ? '+' : '−'}
                        {formatNumberId(l.amount)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-xs tabular-nums">
                        {formatRupiah(l.balance_after)}
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

  // saldo_kas
  const totalCash = state.basecamps.reduce((s, b) => s + getBasecampBalance(state, b.id), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Saldo Kas Basecamp"
        subtitle={`Total saldo kas Rp ${formatJuta(totalCash, 2)} jt di ${state.basecamps.length} basecamp`}
      />

      <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">Daftar Basecamp & Saldo Terkini</h2>
          <span className="text-xs text-[#64748B] tabular-nums">{state.basecamps.length} basecamp</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                <th className="py-2.5 px-5">Kode & Basecamp</th>
                <th className="py-2.5 px-4">Area</th>
                <th className="py-2.5 px-4 text-right">Saldo Kas (Rp)</th>
                <th className="py-2.5 px-4 text-right">Jumlah Mutasi</th>
                <th className="py-2.5 px-5 text-right">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {state.basecamps.map((bc) => {
                const bal = getBasecampBalance(state, bc.id);
                const area = state.areas.find((a) => a.id === bc.area_id);
                const ledgerCount = state.cashLedgers.filter((l) => l.basecamp_id === bc.id).length;
                return (
                  <tr key={bc.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-5">
                      <span className="font-semibold text-[#0F172A]">{bc.name}</span>
                      <span className="ml-2 font-mono text-xs text-[#64748B]">{bc.code}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#475569]">{area?.name}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                        bal < 1_000_000 ? 'text-[#E61E25]' : 'text-[#0F172A]'
                      }`}
                    >
                      {formatRupiah(bal)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-[#475569] tabular-nums">
                      {ledgerCount} entri
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onNavigate('kas_basecamp', String(bc.id))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A4B8F] hover:underline"
                      >
                        <span>Lihat mutasi</span>
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
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
};
