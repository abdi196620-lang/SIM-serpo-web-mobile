import React, { useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MapPin,
  Monitor,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { resolvePortalRedirectPath } from './utils/serpoLogic';
import { VisdatLogo } from './components/VisdatLogo';

export function PortalApp() {
  useEffect(() => {
    const redirect = resolvePortalRedirectPath(window.location.search);
    if (redirect) {
      window.location.replace(redirect);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Corporate Top Bar */}
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <VisdatLogo className="h-9 w-auto" />
            <div className="hidden sm:block border-l border-[#E2E8F0] pl-3">
              <span className="font-display-italic text-sm font-bold text-[#0A4B8F] block leading-none">
                SIM SERPO
              </span>
              <span className="text-[11px] text-[#475569] block mt-0.5">
                Portal Aplikasi Terpisah · VISDAT TEKNIK UTAMA
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-[#475569]">
            10 Basecamp · 2 Area Wilayah
          </span>
        </div>
      </header>

      {/* Main Launcher Workspace */}
      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-5xl space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0A4B8F]">
              <span className="h-0.5 w-6 bg-[#E61E25]" aria-hidden="true" />
              <span>Pilih Aplikasi Platform</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
              Portal Aplikasi SIM Serpo
            </h1>
            <p className="text-sm text-[#475569] leading-relaxed">
              Versi Desktop dan Android beroperasi sebagai aplikasi terpisah dengan sesi login masing-masing dan sinkronisasi data operasional secara langsung.
            </p>
          </div>

          {/* Two Standalone Application Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Web Backoffice (Desktop) */}
            <section
              aria-labelledby="app-backoffice-title"
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-6 sm:p-7 flex flex-col justify-between hover:border-[#0A4B8F]/60 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#0A4B8F] flex items-center justify-center shrink-0">
                    <Monitor className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-[#F1F5F9] text-[#475569] text-[11px] font-semibold">
                    Aplikasi Desktop Web
                  </span>
                </div>

                <div>
                  <h2
                    id="app-backoffice-title"
                    className="text-xl font-bold text-[#0F172A] tracking-tight"
                  >
                    Web Backoffice (Desktop)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#475569] mt-1.5 leading-relaxed">
                    Khusus <strong>Management</strong>, <strong>Finance</strong>,{' '}
                    <strong>Manajer Area</strong>, dan <strong>Koordinator Basecamp</strong>.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[#475569] pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Pemantauan tiket gangguan, kepatuhan SLA, dan jejak teknisi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 text-[#0A4B8F] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Persetujuan dana berjenjang, anggaran area, dan buku kas basecamp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#0A4B8F] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Audit sinkronisasi tertunda dan rekonsiliasi temuan kas</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-[#94A3B8]">/backoffice.html</span>
                <a
                  href="/backoffice.html"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                >
                  <span>Buka Web Backoffice</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </section>

            {/* 2. Aplikasi Teknisi (Android) */}
            <section
              aria-labelledby="app-teknisi-title"
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-6 sm:p-7 flex flex-col justify-between hover:border-[#0A4B8F]/60 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#E61E25] flex items-center justify-center shrink-0">
                    <Smartphone className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-[#F1F5F9] text-[#475569] text-[11px] font-semibold">
                    Aplikasi Android Mobile
                  </span>
                </div>

                <div>
                  <h2
                    id="app-teknisi-title"
                    className="text-xl font-bold text-[#0F172A] tracking-tight"
                  >
                    Aplikasi Teknisi (Android)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#475569] mt-1.5 leading-relaxed">
                    Khusus <strong>Teknisi Lapangan</strong> dengan antarmuka mobile untuk operasional di area kerja.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[#475569] pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Daftar tugas perbaikan ODP dan pembaruan status penyelesaian</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#E61E25] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Absen Masuk & Absen Pulang dengan swafoto dan validasi radius</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#0A4B8F] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Pelacakan lokasi berkala serta antrean sinkronisasi offline FIFO</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-[#94A3B8]">/teknisi.html</span>
                <a
                  href="/teknisi.html"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E61E25] hover:bg-[#C8181E] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                >
                  <span>Buka Aplikasi Teknisi</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
