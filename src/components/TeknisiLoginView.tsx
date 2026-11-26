import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MonitorSmartphone,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { VisdatLogo } from './VisdatLogo';

interface TeknisiLoginViewProps {
  onAuthenticate: (
    email: string,
    password: string,
    deviceName: string,
    rememberMe: boolean
  ) => { statusCode: 200 | 401 | 403; error?: string };
}

export const TeknisiLoginView: React.FC<TeknisiLoginViewProps> = ({
  onAuthenticate,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('Aplikasi Teknisi · Samsung A55');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

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
    <div className="min-h-screen bg-[#F1F5F9] md:py-5 md:px-4 flex flex-col items-center justify-center">
      {/* Desktop-only subtle frame header above the Android mobile app */}
      <div className="hidden md:flex w-full max-w-[400px] items-center justify-between gap-2 mb-2.5 px-1 text-xs">
        <div className="inline-flex items-center gap-1.5 font-semibold text-[#0A4B8F]">
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Aplikasi Teknisi · Android Mobile</span>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1 font-semibold text-[#475569] hover:text-[#0A4B8F]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Portal Aplikasi</span>
        </a>
      </div>

      <div className="w-full md:max-w-[400px] min-h-screen md:min-h-0 md:h-[844px] bg-white md:rounded-[28px] md:border md:border-[#CBD5E1] md:shadow-xl flex flex-col overflow-y-auto">
        {/* Mobile Brand Header with Geometric V-Angle Top Bar */}
        <div className="relative bg-white border-b border-[#E2E8F0] px-5 pt-6 pb-4 shrink-0 overflow-hidden md:rounded-t-[28px]">
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
            <p className="mt-1.5 text-[11px] font-bold tracking-wider text-[#0A4B8F] uppercase">
              SIM SERPO · APLIKASI TEKNISI (ANDROID)
            </p>
          </div>
        </div>

        {/* Mobile Technician Sign-In Form */}
        <div className="flex-1 px-6 py-6 flex flex-col justify-center">
          {!forgotMode ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
                  Login Teknisi Lapangan
                </h1>
                <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                  Masuk menggunakan email dan kata sandi akun{' '}
                  <span className="font-semibold text-[#0F172A]">Teknisi</span> untuk tugas ODP,
                  absensi swafoto, dan lokasi langsung.
                </p>
              </div>

              {/* Email & Password */}
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="tech-login-email"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="tech-login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama.teknisi@serpo.example"
                      className="w-full h-11 pl-9 pr-3 rounded-lg bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A4B8F] focus:ring-1 focus:ring-[#0A4B8F]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="tech-login-password"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Kata sandi
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="tech-login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full h-11 pl-9 pr-11 rounded-lg bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A4B8F] focus:ring-1 focus:ring-[#0A4B8F]"
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
                    htmlFor="tech-login-device"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Perangkat Android
                  </label>
                  <div className="relative">
                    <MonitorSmartphone
                      className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="tech-login-device"
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569] focus:outline-none focus:border-[#0A4B8F] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
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
                  className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#E61E25] font-medium space-y-1.5"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                  {errorMsg.includes('Web Backoffice') && (
                    <a
                      href="/backoffice.html"
                      className="font-bold underline text-[#0A4B8F] block pl-6"
                    >
                      Buka Web Backoffice (Desktop) →
                    </a>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-11 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-sm font-semibold tracking-tight transition-colors shadow-xs"
              >
                Masuk Aplikasi Teknisi
              </button>

              <div className="flex items-center justify-between gap-2 text-[11px] text-[#94A3B8] pt-1">
                <a
                  href="/"
                  className="md:hidden inline-flex items-center gap-1 font-semibold text-[#475569] hover:text-[#0A4B8F]"
                >
                  <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                  <span>Portal Aplikasi</span>
                </a>
                <span className="ml-auto text-right">
                  Terhubung dengan sesi login perusahaan
                </span>
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
                Kembali ke login teknisi
              </button>
              <h2 className="text-xl font-bold text-[#0F172A]">Reset kata sandi</h2>
              <p className="text-xs text-[#475569] mt-1">
                Permintaan reset akan diteruskan ke Admin Sistem VISDAT TEKNIK UTAMA.
              </p>
              {!resetSent ? (
                <form onSubmit={handleResetSubmit} className="mt-4 space-y-3">
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#0A4B8F]"
                  />
                  <button
                    type="submit"
                    className="w-full h-11 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-sm font-semibold"
                  >
                    Kirim permintaan reset
                  </button>
                </form>
              ) : (
                <div className="mt-4 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Permintaan reset untuk {resetEmail} telah dicatat.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
