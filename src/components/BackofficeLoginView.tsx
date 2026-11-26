import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  LayoutGrid,
  Lock,
  Mail,
  Map,
  MapPin,
  MonitorSmartphone,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { DEMO_MODE } from '../config';
import { VisdatLogo } from './VisdatLogo';

interface BackofficeLoginViewProps {
  onAuthenticate: (
    email: string,
    password: string,
    deviceName: string,
    rememberMe: boolean
  ) => { statusCode: 200 | 401 | 403; error?: string };
}

interface PresetAccount {
  title: string;
  desc: string;
  email: string;
  icon: React.ReactNode;
}

const BACKOFFICE_ACCOUNTS: PresetAccount[] = [
  {
    title: 'Management',
    desc: 'Semua area · SLA & audit',
    email: 'rina.m@serpo.example',
    icon: <LayoutGrid className="w-4 h-4" aria-hidden="true" />,
  },
  {
    title: 'Finance',
    desc: 'Persetujuan tahap 2 · Buku kas',
    email: 'maya.f@serpo.example',
    icon: <CreditCard className="w-4 h-4" aria-hidden="true" />,
  },
  {
    title: 'Manajer Area',
    desc: 'Sulbar · persetujuan tahap 1',
    email: 'andi.ma@serpo.example',
    icon: <MapPin className="w-4 h-4" aria-hidden="true" />,
  },
  {
    title: 'Koordinator',
    desc: 'Pasangkayu · dana & tim',
    email: 'hendra.k@serpo.example',
    icon: <UserCheck className="w-4 h-4" aria-hidden="true" />,
  },
];

export const BackofficeLoginView: React.FC<BackofficeLoginViewProps> = ({
  onAuthenticate,
}) => {
  const defaultBackoffice = BACKOFFICE_ACCOUNTS[0];

  const [selectedEmail, setSelectedEmail] = useState(
    DEMO_MODE ? defaultBackoffice.email : ''
  );
  const [email, setEmail] = useState(DEMO_MODE ? defaultBackoffice.email : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'rahasia123' : '');
  const [deviceName, setDeviceName] = useState('Chrome Desktop · Backoffice');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState(DEMO_MODE ? defaultBackoffice.email : '');
  const [resetSent, setResetSent] = useState(false);

  const handleSelectPreset = (presetEmail: string) => {
    setSelectedEmail(presetEmail);
    setEmail(presetEmail);
    setPassword('rahasia123');
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Masukkan alamat email perusahaan yang valid.');
      return;
    }
    if (!password) {
      setErrorMsg('Kata sandi wajib diisi.');
      return;
    }
    const res = onAuthenticate(email, password, deviceName, rememberMe);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setErrorMsg(null);
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || !resetEmail.includes('@')) return;
    setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-stretch justify-center">
      <div className="w-full max-w-[1440px] min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white shadow-xs border-x border-[#E2E8F0]/60">
        {/* Small-screen header for Web Backoffice */}
        <div className="lg:hidden relative bg-white border-b border-[#E2E8F0] px-5 pt-5 pb-3.5 overflow-hidden">
          <svg
            viewBox="0 0 390 48"
            className="absolute top-0 left-0 w-full h-2.5 pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points="0,0 245,0 220,48 0,48" fill="#0A4B8F" />
            <polygon points="252,0 390,0 390,48 227,48" fill="#E61E25" />
          </svg>
          <div className="mt-1 flex flex-col items-center text-center">
            <VisdatLogo className="h-10 w-auto" />
            <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-[#0A4B8F] uppercase">
              SIM Serpo · Web Backoffice (Desktop)
            </p>
          </div>
        </div>

        {/* Left Side: Backoffice Sign-In Form */}
        <section className="lg:col-span-5 bg-white px-5 py-6 sm:px-10 lg:px-12 lg:py-8 flex items-center justify-center">
          <div className="w-full max-w-[430px]">
            {/* Desktop Logo Lockup */}
            <div className="hidden lg:flex items-center justify-between gap-4 pb-4 mb-5 border-b border-[#E2E8F0]">
              <VisdatLogo className="h-10 w-auto" />
              <div className="text-right">
                <span className="font-display-italic text-base text-[#0A4B8F] block leading-none">
                  SIM SERPO
                </span>
                <span className="text-[11px] font-medium text-[#475569] mt-0.5 block">
                  Web Backoffice Portal
                </span>
              </div>
            </div>

            {!forgotMode ? (
              <form onSubmit={handleSubmit} noValidate>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                    Masuk Web Backoffice
                  </h1>
                  <p className="text-xs sm:text-sm text-[#475569] mt-1">
                    Khusus Management, Finance, Manajer Area, dan Koordinator Basecamp.
                  </p>
                </div>

                {/* Backoffice Demo Role Presets (2x2 grid, DEMO_MODE only) */}
                {DEMO_MODE && (
                  <div className="mt-4">
                    <span className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Akses Cepat Backoffice (Demo)
                    </span>

                    <div
                      className="grid grid-cols-2 gap-1.5"
                      role="radiogroup"
                      aria-label="Pilih akun backoffice"
                    >
                      {BACKOFFICE_ACCOUNTS.map((card) => {
                        const active = selectedEmail === card.email && email === card.email;
                        return (
                          <button
                            key={card.email}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => handleSelectPreset(card.email)}
                            className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-left transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4B8F] ${
                              active
                                ? 'bg-[#EFF6FF]/80 border-[#0A4B8F] ring-1 ring-[#0A4B8F]'
                                : 'bg-white border-[#E2E8F0] hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                  active
                                    ? 'bg-[#0A4B8F] text-white'
                                    : 'bg-[#F1F5F9] text-[#0A4B8F]'
                                }`}
                              >
                                {card.icon}
                              </span>
                              <div className="min-w-0">
                                <span className="block text-xs font-semibold text-[#0F172A] truncate">
                                  {card.title}
                                </span>
                                <span className="block text-[10px] text-[#475569] truncate">
                                  {card.desc}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                active ? 'border-[#0A4B8F]' : 'border-[#CBD5E1]'
                              }`}
                            >
                              {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0A4B8F]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Credentials Inputs */}
                <div className="mt-4 space-y-2.5">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-[#0F172A] mb-1"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@serpo.example"
                        className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A4B8F] focus:ring-1 focus:ring-[#0A4B8F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#0F172A] mb-1"
                    >
                      Kata sandi
                    </label>
                    <div className="relative">
                      <Lock
                        className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 pl-9 pr-11 rounded-lg bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A4B8F] focus:ring-1 focus:ring-[#0A4B8F]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#475569] hover:text-[#0F172A]"
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-device"
                      className="block text-xs font-semibold text-[#0F172A] mb-1"
                    >
                      Perangkat
                    </label>
                    <div className="relative">
                      <MonitorSmartphone
                        className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="login-device"
                        type="text"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569] focus:outline-none focus:border-[#0A4B8F] focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Ingat sesi ini & Lupa kata sandi */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#475569] cursor-pointer select-none min-h-[32px]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#0A4B8F] focus:ring-[#0A4B8F]"
                    />
                    <span>Ingat sesi ini</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setResetEmail(email);
                      setResetSent(false);
                    }}
                    className="text-xs font-semibold text-[#0A4B8F] hover:underline whitespace-nowrap"
                  >
                    Lupa kata sandi?
                  </button>
                </div>

                {errorMsg && (
                  <div
                    className="mt-3 p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#E61E25] font-medium space-y-1.5"
                    role="alert"
                  >
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{errorMsg}</span>
                    </div>
                    {errorMsg.includes('Aplikasi Teknisi') && (
                      <a
                        href="/teknisi.html"
                        className="font-bold underline text-[#0A4B8F] block pl-6"
                      >
                        Buka Aplikasi Teknisi (Android) →
                      </a>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="mt-4 w-full h-11 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-sm font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0A4B8F] shadow-xs"
                >
                  Masuk Backoffice
                </button>

                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
                  <a
                    href="/"
                    className="inline-flex items-center gap-1 font-semibold text-[#475569] hover:text-[#0A4B8F]"
                  >
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                    <span>Portal Aplikasi</span>
                  </a>
                  {DEMO_MODE && (
                    <span>
                      Password demo: <span className="font-mono text-[#475569]">rahasia123</span>
                    </span>
                  )}
                </div>
              </form>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A4B8F] hover:underline mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Kembali ke halaman masuk
                </button>
                <h2 className="text-2xl font-bold text-[#0F172A]">Reset kata sandi</h2>
                <p className="text-sm text-[#475569] mt-1">
                  Token reset sementara dibuat oleh Admin Sistem untuk pemulihan akun.
                </p>

                {!resetSent ? (
                  <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
                    <div>
                      <label
                        htmlFor="reset-email"
                        className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                      >
                        Email terdaftar
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full h-11 px-3 rounded-lg bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#0A4B8F]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full h-11 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-sm font-semibold transition-colors"
                    >
                      Kirim permintaan reset
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-sm">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">Token reset dicatat</p>
                        <p className="text-xs mt-1 text-[#047857]">
                          Permintaan untuk <span className="font-mono">{resetEmail}</span> telah diteruskan ke Admin Sistem.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Corporate Blue (#0A4B8F) Technical Showcase Panel */}
        <section className="hidden lg:flex lg:col-span-7 relative bg-[#0A4B8F] text-white px-12 py-8 flex-col justify-between overflow-hidden">
          <svg
            viewBox="0 0 800 900"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points="0,0 320,0 560,640 800,120 800,0 0,0" fill="#083D77" opacity="0.55" />
            <polygon points="440,900 800,260 800,900" fill="#073466" opacity="0.7" />
            <polygon points="140,900 420,420 680,900" fill="#0D57A6" opacity="0.28" />
            <polyline
              points="460,0 605,360 760,0"
              fill="none"
              stroke="#E61E25"
              strokeWidth="4"
              opacity="0.9"
            />
            <line x1="0" y1="896" x2="800" y2="896" stroke="#E61E25" strokeWidth="6" />
          </svg>

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-1 w-10 bg-[#E61E25] inline-block" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wider uppercase text-white/90">
                VISDAT TEKNIK UTAMA · WEB BACKOFFICE
              </span>
            </div>
            <span className="font-mono text-xs text-white/75 tabular-nums">
              10 Basecamp · 2 Area Wilayah
            </span>
          </div>

          <div className="relative z-10 my-auto max-w-xl py-4">
            <h2 className="font-display-italic text-[38px] leading-[1.12] tracking-tight text-white text-balance">
              Kendali Presisi Tiket, SLA & Keuangan Lapangan.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/85 max-w-lg">
              Portal manajemen dan keuangan backoffice untuk memantau gangguan jaringan, kepatuhan SLA, absensi teknisi, serta rekonsiliasi kas basecamp.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <div className="p-3.5 rounded-xl bg-white/8 border border-white/15 backdrop-blur-xs flex items-start gap-3.5">
                <span className="w-9 h-9 rounded-lg bg-[#E61E25] text-white flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Pemantauan SLA Tiket & Kehadiran Tim Lapangan
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    Pantau status tiket kritis, distribusi beban basecamp, serta validasi swafoto & radius teknisi lapangan.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/8 border border-white/15 backdrop-blur-xs flex items-start gap-3.5">
                <span className="w-9 h-9 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Persetujuan Dana Berjenjang & Rekonsiliasi Buku Kas
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    Persetujuan bertingkat Manajer Area & Finance dengan pemeriksaan audit dan peringatan serapan 90%.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/8 border border-white/15 backdrop-blur-xs flex items-start gap-3.5">
                <span className="w-9 h-9 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                  <Map className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Pelacakan Teknisi & Audit Antrean Offline
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    Pantau posisi GPS berkala setiap 5 menit serta selesaikan temuan rekonsiliasi dan sinkronisasi tertunda.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 pt-4 border-t border-white/15 text-xs text-white/75">
            <span>Autentikasi Perusahaan · Manajemen Sesi & Penempatan</span>
            <span className="font-mono">SIM Serpo Backoffice</span>
          </div>
        </section>
      </div>
    </div>
  );
};
