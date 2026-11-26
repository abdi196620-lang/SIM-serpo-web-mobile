import React from 'react';
import { LogOut, MapPin, RotateCcw, ShieldAlert } from 'lucide-react';
import { DEMO_MODE } from '../config';
import { ActiveSessionContext, SerpoState } from '../types/serpo';
import { can } from '../utils/permissions';
import { formatDateShortId, formatPercent, formatTimeWita } from '../utils/serpoLogic';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/StatusText';

interface ProfileViewProps {
  session: ActiveSessionContext;
  state: SerpoState;
  onUpdateBudgetThreshold: (budgetId: number, thresholdPct: number) => { error?: string };
  onResetDemoData: () => { error?: string };
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  session,
  state,
  onUpdateBudgetThreshold,
  onResetDemoData,
  onLogout,
}) => {
  const [resetDone, setResetDone] = React.useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [thresholdError, setThresholdError] = React.useState<string | null>(null);

  const isTechnician = session.role.code === 'TEKNISI';
  const canSetThreshold = !isTechnician && can(session.role.code, 'budget.setThreshold');
  const canResetDemo = !isTechnician && DEMO_MODE && can(session.role.code, 'demo.reset');
  const ownSessions = state.authSessions.filter((s) => s.user_id === session.user.id);

  const initials = session.user.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profil, Penempatan & Sesi"
        subtitle="Identitas pengguna, penempatan basecamp, titik absen, dan sesi login aktif"
      />

      {resetDone && (
        <div
          className="px-4 py-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-medium text-[#083C73]"
          role="status"
        >
          Seluruh data operasional berhasil dikembalikan ke kondisi awal 8 Nov 2026.
        </div>
      )}

      {resetError && (
        <div
          className="px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#E61E25]"
          role="alert"
        >
          {resetError}
        </div>
      )}

      {/* Current User + Placement + Attendance Location */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#0A4B8F] text-white font-bold flex items-center justify-center text-base">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">{session.user.full_name}</h2>
              <p className="text-xs text-[#475569] mt-0.5">
                {session.role.name} · <span className="font-mono">{session.user.email}</span>
              </p>
              {session.technicianProfile && (
                <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                  ID Teknisi: {session.technicianProfile.employee_no} ·{' '}
                  {session.technicianProfile.position}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#E61E25] text-xs font-semibold hover:bg-[#FEE2E2]"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E2E8F0] text-xs">
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[#64748B] block">Penempatan Basecamp</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">
              {session.basecamp ? `${session.basecamp.name} (${session.basecamp.code})` : 'Akses Global / Semua Area'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[#64748B] block">Area Wilayah</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">
              {session.area ? `${session.area.name} (${session.area.code})` : 'Nasional / Semua Area'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[#64748B] block">Titik Absen & Radius</span>
            {session.attendanceLocation ? (
              <span className="font-mono text-[#0F172A] mt-0.5 inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#0A4B8F]" aria-hidden="true" />
                {session.attendanceLocation.lat.toFixed(4)}, {session.attendanceLocation.lng.toFixed(4)} (radius{' '}
                {session.attendanceLocation.radius} m)
              </span>
            ) : (
              <span className="text-[#64748B] mt-0.5 block">Tidak terikat titik absen</span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-[#64748B]">
          Untuk beralih ke akun lain, silakan klik <span className="font-semibold text-[#0F172A]">Keluar</span> lalu masuk kembali melalui halaman login.
        </p>
      </section>

      {/* Budget Alert Threshold quick control */}
      {canSetThreshold && (
        <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Ambang Peringatan Anggaran per Area</h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Standar ambang adalah 90%. Peringatan anggaran dikirim saat persetujuan final melewati batas ini.
            </p>
          </div>
          {thresholdError && (
            <p className="text-xs font-medium text-[#E61E25]" role="alert">
              {thresholdError}
            </p>
          )}
          <div className="space-y-2.5">
            {state.budgets.map((b) => {
              const area = state.areas.find((a) => a.id === b.area_id);
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
                >
                  <span className="text-xs font-semibold text-[#0F172A]">
                    {area?.name} ({b.period_label}) — saat ini {formatPercent(b.alert_threshold, 0)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[80, 85, 90, 95].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const res = onUpdateBudgetThreshold(b.id, pct);
                          if (res.error) setThresholdError(res.error);
                          else setThresholdError(null);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums ${
                          b.alert_threshold === pct
                            ? 'bg-[#0A4B8F] text-white'
                            : 'bg-white border border-[#E2E8F0] text-[#334155]'
                        }`}
                      >
                        {formatPercent(pct, 0)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Session history table (filtered to currently logged-in user; hidden for TEKNISI) */}
      {!isTechnician && (
        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Riwayat Sesi Login Saya</h2>
            <span className="text-xs text-[#64748B] tabular-nums">{ownSessions.length} sesi</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2.5 px-5">ID</th>
                  <th className="py-2.5 px-4">Pengguna</th>
                  <th className="py-2.5 px-4">Perangkat</th>
                  <th className="py-2.5 px-4">Dibuat</th>
                  <th className="py-2.5 px-4">Berlaku Sampai</th>
                  <th className="py-2.5 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {ownSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#64748B]">
                      Belum ada riwayat sesi untuk akun ini.
                    </td>
                  </tr>
                ) : (
                  ownSessions.slice(0, 6).map((s) => {
                    const u = state.users.find((x) => x.id === s.user_id);
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 px-5 font-mono">#{s.id}</td>
                        <td className="py-2.5 px-4 font-medium text-[#0F172A]">{u?.full_name}</td>
                        <td className="py-2.5 px-4 text-[#334155]">{s.device_name}</td>
                        <td className="py-2.5 px-4 font-mono text-[#475569]">
                          {formatDateShortId(s.created_at)} {formatTimeWita(s.created_at)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[#475569]">
                          {formatDateShortId(s.expires_at)} {formatTimeWita(s.expires_at)}
                        </td>
                        <td className="py-2.5 px-5 font-mono">
                          {s.ended_at ? (
                            <span className="text-[#64748B]">
                              Berakhir · {formatTimeWita(s.ended_at)}
                            </span>
                          ) : (
                            <span className="font-semibold text-[#047857]">Aktif</span>
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
      )}

      {/* Reset Demo Data (DEMO_MODE && MANAGEMENT only, requires confirmation modal) */}
      {canResetDemo && (
        <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Reset data operasional</h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Kembalikan seluruh data operasional (pengguna, anggaran, buku kas, absensi, pelacakan, audit, dan notifikasi) ke kondisi awal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetError(null);
              setResetConfirmOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset data awal</span>
          </button>
        </section>
      )}

      {/* Confirmation Dialog for Demo Reset */}
      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        ariaLabelledBy="reset-confirm-title"
        maxWidthClass="max-w-md"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FEF2F2] text-[#E61E25] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="reset-confirm-title" className="text-base font-bold text-[#0F172A]">
              Konfirmasi reset data awal
            </h3>
            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
              Tindakan ini akan mengembalikan seluruh data operasional (tiket, kas, absensi, pelacakan, dan log audit) ke kondisi awal 8 Nov 2026. Lanjutkan?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setResetConfirmOpen(false)}
            className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              const res = onResetDemoData();
              setResetConfirmOpen(false);
              if (res.error) {
                setResetError(res.error);
              } else {
                setResetError(null);
                setResetDone(true);
              }
            }}
            className="px-4 py-2 rounded-lg bg-[#E61E25] hover:bg-[#C81920] text-white text-xs font-semibold"
          >
            Ya, reset data
          </button>
        </div>
      </Modal>
    </div>
  );
};
