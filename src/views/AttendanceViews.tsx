import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  ActiveSessionContext,
  AttendanceSource,
  SerpoState,
  VerificationStatus,
} from '../types/serpo';
import {
  formatAttendanceDayLabel,
  formatTimeWita,
  getAttendanceTypeLabel,
  getUserBasecampAndArea,
  haversineMeters,
  SubmitAttendanceInput,
  SubmitAttendanceResult,
} from '../utils/serpoLogic';
import {
  ATTENDANCE_OPTION_META,
  AttendanceConfirmModal,
  AttendanceSelectionOption,
} from '../components/AttendanceConfirmModal';
import { downloadCsv, PageHeader, StatusLabel } from '../components/StatusText';

interface AttendanceViewsProps {
  mode: 'rekap_kehadiran' | 'riwayat_absensi';
  state: SerpoState;
  session: ActiveSessionContext;
  onSubmitAttendance: (input: SubmitAttendanceInput) => SubmitAttendanceResult;
}

const TECHNICIAN_ATTENDANCE_OPTIONS: {
  id: AttendanceSelectionOption;
  label: string;
}[] = [
  { id: 'CHECK_IN', label: 'Absen Masuk' },
  { id: 'CHECK_OUT', label: 'Absen Pulang' },
  { id: 'DINAS_LUAR', label: 'Dinas Luar' },
  { id: 'LEMBUR', label: 'Lembur' },
];

export const AttendanceViews: React.FC<AttendanceViewsProps> = ({
  mode,
  state,
  session,
  onSubmitAttendance,
}) => {
  const isTechnician = session.role.code === 'TEKNISI';
  const [basecampFilter, setBasecampFilter] = useState<number | 'all'>('all');
  const [verifFilter, setVerifFilter] = useState<'ALL' | VerificationStatus>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | AttendanceSource>('ALL');

  // Technician mobile attendance state
  const todayOpenAttendance = useMemo(
    () =>
      state.attendances.find(
        (a) =>
          a.user_id === session.user.id &&
          a.work_date === state.currentDate &&
          a.check_out_time === null
      ) ?? null,
    [state.attendances, session.user.id, state.currentDate]
  );

  const [selectedOption, setSelectedOption] = useState<AttendanceSelectionOption>(() =>
    todayOpenAttendance ? 'CHECK_OUT' : 'CHECK_IN'
  );
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'green' | 'amber';
    text: string;
  } | null>(null);

  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync default selection when shift opens/closes if modal isn't open
  useEffect(() => {
    if (!confirmOpen) {
      setSelectedOption(todayOpenAttendance ? 'CHECK_OUT' : 'CHECK_IN');
    }
  }, [Boolean(todayOpenAttendance), confirmOpen]);

  // Close dropdown menu on outside click or Escape
  useEffect(() => {
    if (!typeMenuOpen) return;
    const handlePointer = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setTypeMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTypeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [typeMenuOpen]);

  const scopedAttendances = useMemo(() => {
    if (isTechnician) {
      return state.attendances.filter((a) => a.user_id === session.user.id);
    }
    return state.attendances;
  }, [isTechnician, state.attendances, session.user.id]);

  const filtered = useMemo(() => {
    return scopedAttendances.filter((a) => {
      const { basecamp } = getUserBasecampAndArea(state, a.user_id);
      if (!isTechnician && basecampFilter !== 'all' && basecamp?.id !== basecampFilter) return false;
      if (verifFilter !== 'ALL' && a.verification_status !== verifFilter) return false;
      if (sourceFilter !== 'ALL' && a.source !== sourceFilter) return false;
      return true;
    });
  }, [
    scopedAttendances,
    state.userPlacements,
    state.basecamps,
    isTechnician,
    basecampFilter,
    verifFilter,
    sourceFilter,
  ]);

  const activeOpenCount = scopedAttendances.filter(
    (a) => a.work_date === state.currentDate && a.check_out_time === null
  ).length;
  const verifiedCount = scopedAttendances.filter((a) => a.verification_status === 'VERIFIED').length;
  const flaggedCount = scopedAttendances.filter((a) => a.verification_status === 'FLAGGED').length;
  const offlineCount = scopedAttendances.filter((a) => a.source === 'OFFLINE').length;

  const handleExport = () => {
    downloadCsv(
      'sim-serpo-absensi.csv',
      [
        'Teknisi',
        'Tanggal',
        'Jenis',
        'Absen Masuk',
        'Absen Pulang',
        'Sumber',
        'Verifikasi',
        'Akurasi (m)',
        'Lokasi Palsu',
      ],
      filtered.map((a) => {
        const u = state.users.find((us) => us.id === a.user_id);
        return [
          u?.full_name ?? a.user_id,
          a.work_date,
          getAttendanceTypeLabel(a.attendance_type),
          formatTimeWita(a.check_in_time),
          formatTimeWita(a.check_out_time),
          a.source === 'OFFLINE' ? 'Offline' : 'Online',
          a.verification_status === 'VERIFIED' ? 'Terverifikasi' : 'Perlu Tinjauan',
          a.check_in_accuracy,
          a.check_in_is_mock ? 'Ya' : 'Tidak',
        ];
      })
    );
  };

  // =========================================================================
  // TECHNICIAN MOBILE VIEW (matches Screenshot 1 & 2, preserves SIM Serpo colors)
  // =========================================================================
  if (isTechnician) {
    const selectedMeta = ATTENDANCE_OPTION_META[selectedOption];
    const { attendanceLocation, basecamp } = getUserBasecampAndArea(state, session.user.id);

    return (
      <div className="space-y-4">
        {/* Top Selector + Clock Pill Row (mirrors Screenshot 1 top bar) */}
        <div className="flex items-center justify-between gap-3">
          <div ref={menuContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setTypeMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={typeMenuOpen}
              aria-label="Pilih jenis absensi"
              className="h-10 px-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs text-sm font-semibold text-[#0F172A] inline-flex items-center gap-2 hover:bg-[#F8FAFC] transition-colors"
            >
              <span>{selectedMeta.label}</span>
              <ChevronDown
                className={`w-4 h-4 text-[#475569] transition-transform ${
                  typeMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {typeMenuOpen && (
              <div
                role="listbox"
                aria-label="Jenis absensi"
                className="absolute left-0 mt-2 w-48 bg-white rounded-xl border border-[#E2E8F0] shadow-lg py-1.5 z-30"
              >
                {TECHNICIAN_ATTENDANCE_OPTIONS.map((opt) => {
                  const isSelected = selectedOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedOption(opt.id);
                        setTypeMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        isSelected
                          ? 'bg-[#EFF6FF] text-[#0A4B8F] font-semibold'
                          : 'text-[#0F172A] hover:bg-[#F8FAFC] font-medium'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#0A4B8F] text-xs font-bold font-mono tabular-nums"
            aria-label="Waktu server saat ini"
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{formatTimeWita(state.serverNowIso)} WITA</span>
          </div>
        </div>

        {/* Hero Attendance Card in SIM Serpo Primary Blue (#0A4B8F) */}
        <section className="relative overflow-hidden bg-[#0A4B8F] text-white rounded-2xl p-5 border border-[#083C73] shadow-sm">
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
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Siap untuk absen?</h1>
              <p className="text-xs text-white/85 mt-1 leading-relaxed">
                Pastikan Anda berada di lokasi yang sesuai sebelum melakukan absen.
              </p>
              <p className="text-[11px] text-white/75 mt-2 font-medium">
                {session.user.full_name} · {basecamp?.name ?? 'Lapangan'} (radius{' '}
                {attendanceLocation?.radius ?? 200} m)
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFeedbackBanner(null);
                setConfirmOpen(true);
              }}
              className="w-full min-h-[46px] rounded-full bg-white hover:bg-[#EFF6FF] text-[#0A4B8F] text-xs font-bold tracking-wider uppercase shadow-sm transition-colors"
            >
              ABSEN SEKARANG
            </button>
          </div>
        </section>

        {feedbackBanner && (
          <div
            role="status"
            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
              feedbackBanner.tone === 'amber'
                ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
            }`}
          >
            {feedbackBanner.tone === 'amber' ? (
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
        )}

        {/* Riwayat Absen Section (mirrors Screenshot 1 card list) */}
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#0F172A]">Riwayat Absen</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMobileFilter((v) => !v)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:text-[#0F172A]"
              >
                Filter
              </button>
              <button
                type="button"
                onClick={handleExport}
                aria-label="Ekspor riwayat absensi"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ekspor</span>
              </button>
            </div>
          </div>

          {showMobileFilter && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs">
                <span className="text-[#64748B]">Status</span>
                <select
                  value={verifFilter}
                  onChange={(e) => setVerifFilter(e.target.value as 'ALL' | VerificationStatus)}
                  className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
                >
                  <option value="ALL">Semua</option>
                  <option value="VERIFIED">Terverifikasi</option>
                  <option value="FLAGGED">Perlu Tinjauan</option>
                </select>
              </label>

              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs">
                <span className="text-[#64748B]">Sumber</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as 'ALL' | AttendanceSource)}
                  className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
                >
                  <option value="ALL">Semua</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </label>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 text-center text-xs text-[#64748B]">
              Belum ada catatan absensi untuk akun {session.user.full_name}.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => {
                const loc = state.attendanceLocations.find(
                  (l) => l.attendance_location_id === a.attendance_location_id
                );
                const { basecamp: recBasecamp } = getUserBasecampAndArea(state, a.user_id);
                const dist = loc
                  ? haversineMeters(a.check_in_lat, a.check_in_lng, loc.lat, loc.lng)
                  : null;
                const selfies = state.attachments.filter(
                  (at) =>
                    at.ref_id === a.id &&
                    (at.purpose === 'CHECKIN_SELFIE' || at.purpose === 'CHECKOUT_SELFIE')
                );
                const { weekday, dateLabel } = formatAttendanceDayLabel(a.work_date);
                const isExpanded = expandedCardId === a.id;
                const isNonRegular =
                  a.attendance_type === 'DINAS_LUAR' || a.attendance_type === 'LEMBUR';

                return (
                  <article
                    key={a.id}
                    className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-bold text-[#0A4B8F]">{weekday}</span>
                        <span className="text-[#475569] font-medium">{dateLabel}</span>
                        {isNonRegular && (
                          <StatusLabel
                            tone="blue"
                            label={getAttendanceTypeLabel(a.attendance_type)}
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {a.source === 'OFFLINE' && <StatusLabel tone="amber" label="Offline" />}
                        <StatusLabel
                          tone={a.verification_status === 'VERIFIED' ? 'green' : 'red'}
                          icon={a.verification_status === 'VERIFIED' ? 'check' : 'warn'}
                          label={
                            a.verification_status === 'VERIFIED'
                              ? 'Terverifikasi'
                              : 'Perlu Tinjauan'
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            ABSEN MASUK
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedCardId(isExpanded ? null : a.id)}
                            aria-expanded={isExpanded}
                            aria-label={`Detail absensi ${weekday} ${dateLabel}`}
                            className="w-5 h-5 rounded-full border border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0A4B8F] inline-flex items-center justify-center"
                          >
                            <Info className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="mt-1.5 text-lg font-bold text-[#0F172A] font-mono tabular-nums">
                          {formatTimeWita(a.check_in_time)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          ABSEN PULANG
                        </span>
                        <p className="mt-1.5 text-lg font-bold text-[#0F172A] font-mono tabular-nums">
                          {a.check_out_time ? formatTimeWita(a.check_out_time) : '—'}
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2.5 border-t border-[#E2E8F0] text-xs text-[#475569] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span>Basecamp</span>
                          <span className="font-semibold text-[#0F172A]">
                            {recBasecamp?.name ?? loc?.name ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Jarak & Akurasi GPS</span>
                          <span className="font-mono text-[#0F172A] tabular-nums">
                            {dist !== null ? `${dist} m` : '—'} · akurasi {a.check_in_accuracy} m
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Lampiran Swafoto</span>
                          <span className="font-mono text-[#0F172A]">
                            {selfies.length === 0
                              ? '—'
                              : selfies
                                  .map(
                                    (s) =>
                                      `${s.purpose === 'CHECKIN_SELFIE' ? 'Masuk' : 'Pulang'} ${s.file_size_kb} KB`
                                  )
                                  .join(' · ')}
                          </span>
                        </div>
                        {a.check_in_is_mock && (
                          <p className="text-[11px] font-semibold text-[#E61E25]">
                            Terindikasi lokasi palsu saat absensi.
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <AttendanceConfirmModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          selection={selectedOption}
          state={state}
          session={session}
          onSubmitAttendance={onSubmitAttendance}
          onSuccessFeedback={setFeedbackBanner}
        />
      </div>
    );
  }

  // =========================================================================
  // BACKOFFICE DESKTOP VIEW (Read-only team monitoring & export)
  // =========================================================================
  return (
    <div className="space-y-5">
      <PageHeader
        title={mode === 'riwayat_absensi' ? 'Riwayat absensi' : 'Absensi teknisi'}
        subtitle="Rekap Absen Masuk / Absen Pulang tim lapangan · lampiran swafoto terverifikasi (≤ 200 KB)"
        action={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ekspor</span>
          </button>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Sesi absensi aktif</p>
          <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">{activeOpenCount}</p>
          <p className="mt-1.5 text-xs text-[#64748B]">Pelacakan langsung berjalan</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Terverifikasi</p>
          <p className="mt-2 text-2xl font-bold text-[#047857] tabular-nums">{verifiedCount}</p>
          <p className="mt-1.5 text-xs text-[#64748B]">Lolos jarak titik absen & anti-lokasi palsu</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Perlu Tinjauan</p>
          <p className="mt-2 text-2xl font-bold text-[#E61E25] tabular-nums">{flaggedCount}</p>
          <p className="mt-1.5 text-xs text-[#64748B]">Tercatat di log audit / luar radius</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#475569]">Dari Mode Offline</p>
          <p className="mt-2 text-2xl font-bold text-[#B45309] tabular-nums">{offlineCount}</p>
          <p className="mt-1.5 text-xs text-[#64748B]">Masuk lewat antrean sinkronisasi offline</p>
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

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#64748B]">Verifikasi</span>
          <select
            value={verifFilter}
            onChange={(e) => setVerifFilter(e.target.value as 'ALL' | VerificationStatus)}
            className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
          >
            <option value="ALL">Semua</option>
            <option value="VERIFIED">Terverifikasi</option>
            <option value="FLAGGED">Perlu Tinjauan</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#64748B]">Sumber</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'ALL' | AttendanceSource)}
            className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
          >
            <option value="ALL">Semua</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </label>
      </div>

      {/* Attendance Table */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0F172A]">Daftar Absensi & Lampiran Swafoto</h2>
          <span className="text-xs text-[#64748B]">
            Satu sesi absensi per teknisi per hari · Aktif bila belum absen pulang
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                <th className="py-2.5 px-5">Teknisi</th>
                <th className="py-2.5 px-4">Basecamp</th>
                <th className="py-2.5 px-4">Masuk / Pulang</th>
                <th className="py-2.5 px-4">Jarak & Akurasi GPS</th>
                <th className="py-2.5 px-4">Swafoto</th>
                <th className="py-2.5 px-4">Sumber</th>
                <th className="py-2.5 px-5">Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#64748B]">
                    Belum ada catatan absensi yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const u = state.users.find((us) => us.id === a.user_id);
                  const loc = state.attendanceLocations.find(
                    (l) => l.attendance_location_id === a.attendance_location_id
                  );
                  const { basecamp } = getUserBasecampAndArea(state, a.user_id);
                  const dist = loc
                    ? haversineMeters(a.check_in_lat, a.check_in_lng, loc.lat, loc.lng)
                    : null;
                  const selfies = state.attachments.filter(
                    (at) =>
                      at.ref_id === a.id &&
                      (at.purpose === 'CHECKIN_SELFIE' || at.purpose === 'CHECKOUT_SELFIE')
                  );
                  const isNonRegular =
                    a.attendance_type === 'DINAS_LUAR' || a.attendance_type === 'LEMBUR';
                  return (
                    <tr key={a.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-5">
                        <span className="block font-semibold text-[#0F172A]">{u?.full_name}</span>
                        <span className="block text-[11px] font-mono text-[#64748B]">
                          {a.work_date}
                          {isNonRegular ? ` · ${getAttendanceTypeLabel(a.attendance_type)}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#334155]">{basecamp?.name ?? loc?.name}</td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums">
                        <span className="text-[#0F172A]">Masuk {formatTimeWita(a.check_in_time)}</span>
                        <span className="block text-[#64748B]">
                          {a.check_out_time
                            ? `Pulang ${formatTimeWita(a.check_out_time)}`
                            : 'Aktif (belum pulang)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums">
                        <span className="text-[#0F172A]">
                          {dist !== null ? `${dist} m` : '—'} · akurasi {a.check_in_accuracy} m
                        </span>
                        {a.check_in_is_mock && (
                          <span className="block text-[11px] font-semibold text-[#E61E25]">
                            Terindikasi lokasi palsu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-[#475569]">
                        {selfies.length === 0 ? (
                          <span className="text-[#64748B]">—</span>
                        ) : (
                          selfies.map((s) => (
                            <span key={s.id} className="block">
                              {s.purpose === 'CHECKIN_SELFIE' ? 'Masuk' : 'Pulang'} · {s.file_size_kb} KB
                            </span>
                          ))
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel
                          tone={a.source === 'OFFLINE' ? 'amber' : 'gray'}
                          label={a.source === 'OFFLINE' ? 'Offline' : 'Online'}
                        />
                      </td>
                      <td className="py-3 px-5">
                        <StatusLabel
                          tone={a.verification_status === 'VERIFIED' ? 'green' : 'red'}
                          icon={a.verification_status === 'VERIFIED' ? 'check' : 'warn'}
                          label={
                            a.verification_status === 'VERIFIED'
                              ? 'Terverifikasi'
                              : 'Perlu Tinjauan'
                          }
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
    </div>
  );
};
