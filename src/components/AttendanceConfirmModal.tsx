import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, MapPin, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { DEMO_MODE } from '../config';
import { ActiveSessionContext, SerpoState } from '../types/serpo';
import {
  formatTimeWita,
  generateUniqueId,
  getUserBasecampAndArea,
  haversineMeters,
  SubmitAttendanceInput,
  SubmitAttendanceResult,
} from '../utils/serpoLogic';
import { Modal } from './Modal';

export type AttendanceSelectionOption = 'CHECK_IN' | 'CHECK_OUT' | 'DINAS_LUAR' | 'LEMBUR';

export const ATTENDANCE_OPTION_META: Record<
  AttendanceSelectionOption,
  {
    label: string;
    aksi: 'CHECK_IN' | 'CHECK_OUT';
    attendanceType: 'REGULER' | 'DINAS_LUAR' | 'LEMBUR';
  }
> = {
  CHECK_IN: { label: 'Absen Masuk', aksi: 'CHECK_IN', attendanceType: 'REGULER' },
  CHECK_OUT: { label: 'Absen Pulang', aksi: 'CHECK_OUT', attendanceType: 'REGULER' },
  DINAS_LUAR: { label: 'Dinas Luar', aksi: 'CHECK_IN', attendanceType: 'DINAS_LUAR' },
  LEMBUR: { label: 'Lembur', aksi: 'CHECK_IN', attendanceType: 'LEMBUR' },
};

interface AttendanceConfirmModalProps {
  open: boolean;
  onClose: () => void;
  selection: AttendanceSelectionOption;
  state: SerpoState;
  session: ActiveSessionContext;
  onSubmitAttendance: (input: SubmitAttendanceInput) => SubmitAttendanceResult;
  onSuccessFeedback?: (feedback: { tone: 'green' | 'amber'; text: string }) => void;
}

export const AttendanceConfirmModal: React.FC<AttendanceConfirmModalProps> = ({
  open,
  onClose,
  selection,
  state,
  session,
  onSubmitAttendance,
  onSuccessFeedback,
}) => {
  const { attendanceLocation, basecamp } = getUserBasecampAndArea(state, session.user.id);
  const meta = ATTENDANCE_OPTION_META[selection];

  const [lat, setLat] = useState('-5.158005');
  const [lng, setLng] = useState('119.478260');
  const [accuracy, setAccuracy] = useState('12');
  const [isMock, setIsMock] = useState(false);
  const [selfieKb, setSelfieKb] = useState('145');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<'initializing' | 'live' | 'fallback'>('initializing');
  const [showGpsAdvanced, setShowGpsAdvanced] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{
    tone: 'green' | 'amber' | 'red';
    text: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const applyDefaultCoords = (offsetMeters = 12) => {
    if (!attendanceLocation) return;
    const deltaLat = offsetMeters / 111_111;
    setLat((attendanceLocation.lat + deltaLat).toFixed(6));
    setLng(attendanceLocation.lng.toFixed(6));
  };

  // Initialize modal state whenever opened
  useEffect(() => {
    if (!open) {
      stopCameraStream();
      return;
    }

    if (attendanceLocation) {
      const deltaLat = 12 / 111_111;
      setLat((attendanceLocation.lat + deltaLat).toFixed(6));
      setLng(attendanceLocation.lng.toFixed(6));
    }
    setAccuracy('12');
    setIsMock(false);
    setSelfieKb('145');
    setCapturedPhotoUrl(null);
    setShowGpsAdvanced(false);
    setAlertMessage(null);
  }, [open, selection, attendanceLocation?.attendance_location_id]);

  // Attempt live front-camera stream when modal is open and photo not yet captured
  useEffect(() => {
    if (!open || capturedPhotoUrl) {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    setCameraState('initializing');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('fallback');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 400 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraState('live');
      })
      .catch(() => {
        if (!cancelled) {
          setCameraState('fallback');
        }
      });

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [open, capturedPhotoUrl]);

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const previewDist =
    attendanceLocation && Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
      ? haversineMeters(parsedLat, parsedLng, attendanceLocation.lat, attendanceLocation.lng)
      : null;

  const withinRadius =
    previewDist !== null && attendanceLocation ? previewDist <= attendanceLocation.radius : false;

  const handleUseDeviceGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setAlertMessage({
        tone: 'amber',
        text: 'GPS perangkat tidak tersedia pada peramban ini.',
      });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAccuracy(String(Math.max(1, Math.round(pos.coords.accuracy || 12))));
        setIsMock(false);
        setAlertMessage(null);
      },
      () => {
        setGeoLoading(false);
        setAlertMessage({
          tone: 'amber',
          text: 'Izin lokasi perangkat tidak aktif. Koordinat lokasi absen tetap digunakan.',
        });
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleCapturePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const video = videoRef.current;
      if (cameraState === 'live' && video && video.videoWidth > 0 && video.videoHeight > 0) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        // Clean deterministic viewfinder capture when no physical webcam is attached
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#1E293B');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle studio radial highlight
        const glow = ctx.createRadialGradient(320, 175, 20, 320, 175, 210);
        glow.addColorStop(0, 'rgba(10, 75, 143, 0.35)');
        glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Technician silhouette / avatar badge
        ctx.fillStyle = '#0A4B8F';
        ctx.beginPath();
        ctx.arc(320, 155, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#BFDBFE';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = session.user.full_name
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        ctx.fillText(initials, 320, 157);

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(320, 295, 105, 65, 0, Math.PI, Math.PI * 2);
        ctx.fill();
      }

      // Timestamp & location verification watermark on bottom strip
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${session.user.full_name} · ${meta.label} · ${formatTimeWita(state.serverNowIso)} WITA`,
        18,
        canvas.height - 22
      );
      ctx.textAlign = 'right';
      ctx.fillStyle = '#93C5FD';
      ctx.fillText(
        `${basecamp?.name ?? 'Lapangan'} (${lat}, ${lng})`,
        canvas.width - 18,
        canvas.height - 22
      );
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.76);
    const approxBytes = Math.round((dataUrl.length * 3) / 4);
    const computedKb = Math.max(18, Math.min(185, Math.round(approxBytes / 1024) || 42));

    setCapturedPhotoUrl(dataUrl);
    setSelfieKb(String(computedKb));
    setAlertMessage(null);
    stopCameraStream();
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedPhotoUrl) {
      setAlertMessage({
        tone: 'red',
        text: 'Ambil foto verifikasi terlebih dahulu sebelum melanjutkan konfirmasi absen.',
      });
      return;
    }

    const res = onSubmitAttendance({
      userId: session.user.id,
      aksi: meta.aksi,
      attendance_type: meta.attendanceType,
      lat: parsedLat,
      lng: parsedLng,
      accuracy: Number(accuracy),
      is_mock: isMock,
      client_uuid: generateUniqueId(`att-${session.user.id}`),
      selfie_path: `/uploads/selfie/u${session.user.id}-${selection.toLowerCase()}.jpg`,
      selfie_sha256: generateUniqueId(`sha256_${session.user.id}`),
      selfie_size_kb: selfieKb.trim() === '' ? NaN : Number(selfieKb),
    });

    if (res.queuedOffline) {
      onSuccessFeedback?.({
        tone: 'amber',
        text: `Mode Offline: ${meta.label} dan swafoto disimpan ke antrean sinkronisasi lokal.`,
      });
      onClose();
      return;
    }

    if (res.error) {
      setAlertMessage({ tone: 'red', text: res.error });
      return;
    }

    onSuccessFeedback?.({
      tone: 'green',
      text: `${meta.label} berhasil dicatat · jarak ${res.distanceMeters ?? 0} m · verifikasi foto tersimpan.`,
    });
    onClose();
  };

  const initials = session.user.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabelledBy="confirm-attendance-title"
      maxWidthClass="max-w-md"
      panelClassName="p-5 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
    >
      {/* Modal Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 id="confirm-attendance-title" className="text-lg font-bold text-[#0F172A]">
          Konfirmasi Absen
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
          aria-label="Tutup konfirmasi absen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Clean Summary Lines matching Screenshot 2 */}
        <div className="space-y-1.5 text-sm text-[#334155] leading-relaxed">
          <p>
            Jenis absen:{' '}
            <strong className="font-bold text-[#0F172A]">{meta.label}</strong>
          </p>
          <p>
            Waktu saat ini:{' '}
            <strong className="font-bold text-[#0F172A] font-mono tabular-nums">
              {formatTimeWita(state.serverNowIso)} WITA
            </strong>
          </p>
          <p>
            Lokasi:{' '}
            <strong className="font-bold text-[#0F172A] tabular-nums">
              {lat}, {lng} ·{' '}
              <span className={withinRadius ? 'text-[#047857]' : 'text-[#E61E25]'}>
                {withinRadius ? 'Dalam radius' : 'Di luar radius'}
              </span>{' '}
              · {attendanceLocation?.name ?? basecamp?.name ?? 'Basecamp'} (
              {previewDist !== null ? `${previewDist} m` : '—'})
            </strong>
          </p>
          <p className="text-xs text-[#64748B] pt-1">
            Pastikan informasi sudah benar sebelum melanjutkan.
          </p>
        </div>

        {/* Photo Verification Block matching Screenshot 2 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#0F172A]">Verifikasi Foto</span>
            {capturedPhotoUrl && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857]">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Foto siap ({selfieKb} KB)</span>
              </span>
            )}
          </div>

          <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-[#0F172A] border border-[#E2E8F0]">
            {capturedPhotoUrl ? (
              <img
                src={capturedPhotoUrl}
                alt="Hasil foto verifikasi absensi"
                className="w-full h-full object-cover"
              />
            ) : cameraState === 'live' ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center pb-8 bg-gradient-to-br from-[#0F172A] to-[#1E293B]">
                {/* Subtle facial framing guide */}
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/35 flex items-center justify-center bg-[#0A4B8F]/75 text-white text-2xl font-bold shadow-inner">
                  {initials}
                </div>
              </div>
            )}

            {/* Overlay Instruction Pill matching Screenshot 2 */}
            <div className="absolute inset-x-2 bottom-2.5 flex justify-center pointer-events-none">
              <span className="px-3 py-1.5 rounded-full bg-black/75 text-white text-[11px] font-medium text-center backdrop-blur-xs">
                {capturedPhotoUrl
                  ? 'Swafoto berhasil diambil'
                  : 'Posisikan wajah Anda sebelum mengambil foto'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCapturePhoto}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#E2E8F0] shadow-xs hover:bg-[#F8FAFC] text-xs font-bold tracking-wider uppercase text-[#0F172A] transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-[#0A4B8F]" aria-hidden="true" />
              <span>{capturedPhotoUrl ? 'AMBIL ULANG' : 'AMBIL FOTO'}</span>
            </button>

            <button
              type="button"
              onClick={handleUseDeviceGps}
              disabled={geoLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#0A4B8F] hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${geoLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{geoLoading ? 'Mengambil GPS...' : 'Perbarui GPS'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible GPS & Scenario Adjustment (DEMO_MODE) so tests/demos stay accessible without cluttering default UI */}
        {DEMO_MODE && (
          <div className="border-t border-[#E2E8F0] pt-2.5">
            <button
              type="button"
              onClick={() => setShowGpsAdvanced((v) => !v)}
              aria-expanded={showGpsAdvanced}
              className="w-full flex items-center justify-between text-xs font-semibold text-[#475569] hover:text-[#0F172A] py-1"
            >
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0A4B8F]" aria-hidden="true" />
                <span>Pengaturan lokasi & uji validasi</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showGpsAdvanced ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {showGpsAdvanced && (
              <div className="mt-2.5 space-y-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      applyDefaultCoords(12);
                      setAccuracy('10');
                      setIsMock(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#083C73] text-[11px] font-semibold"
                  >
                    Dalam radius (12 m)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyDefaultCoords(420);
                      setAccuracy('14');
                      setIsMock(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#FFFBEB] text-[#B45309] text-[11px] font-semibold"
                  >
                    Di luar radius (420 m)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyDefaultCoords(12);
                      setIsMock(true);
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#FEF2F2] text-[#E61E25] text-[11px] font-semibold"
                  >
                    Lokasi palsu
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-[#334155] mb-1">
                      Lintang
                    </span>
                    <input
                      type="text"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-[#E2E8F0] bg-white font-mono text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-[#334155] mb-1">
                      Bujur
                    </span>
                    <input
                      type="text"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-[#E2E8F0] bg-white font-mono text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-[#334155] mb-1">
                      Akurasi (m)
                    </span>
                    <input
                      type="number"
                      value={accuracy}
                      onChange={(e) => setAccuracy(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-[#E2E8F0] bg-white font-mono text-xs"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-[#0F172A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMock}
                    onChange={(e) => setIsMock(e.target.checked)}
                    className="rounded border-[#E2E8F0]"
                  />
                  <span>Tandai lokasi palsu</span>
                </label>
              </div>
            )}
          </div>
        )}

        {alertMessage && (
          <div
            role="alert"
            className={`p-3 rounded-lg border text-xs font-medium flex items-start gap-2 ${
              alertMessage.tone === 'red'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#E61E25]'
                : alertMessage.tone === 'amber'
                ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#083C73]'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{alertMessage.text}</span>
          </div>
        )}

        {/* Footer Buttons matching Screenshot 2 */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold tracking-wider uppercase text-[#475569] hover:bg-[#F8FAFC]"
          >
            BATAL
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-bold tracking-wider uppercase transition-colors"
          >
            {state.networkOnline ? 'KONFIRMASI' : 'SIMPAN OFFLINE'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
