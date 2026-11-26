import React, { useEffect, useMemo, useState } from 'react';
import { BatteryCharging, CheckCircle2, MapPin, Radio, Route as RouteIcon, ShieldAlert, X } from 'lucide-react';
import { DEMO_MODE } from '../config';
import { ActiveSessionContext, RouteId, SerpoState } from '../types/serpo';
import { canUpdateBasecampLocation } from '../utils/permissions';
import {
  addMinutesIso,
  formatPercent,
  formatTimeWita,
  generateUniqueId,
  getLatestTrackForUser,
  getUserBasecampAndArea,
  haversineMeters,
  IngestPingsResult,
  LocationPingInput,
  parseCoordinateInput,
} from '../utils/serpoLogic';
import { Modal } from '../components/Modal';
import { PageHeader, StatusLabel } from '../components/StatusText';
import { LiveTrackingGoogleMap, TechRouteGoogleMap } from '../components/SerpoGoogleMap';

interface LocationViewsProps {
  mode: 'peta_langsung' | 'jejak_teknisi';
  state: SerpoState;
  session: ActiveSessionContext;
  contextId?: string | null;
  onNavigate: (route: RouteId, contextId?: string) => void;
  onRecordLocationAccess: (technicianUserId: number, date: string) => void;
  onIngestPings: (pings: LocationPingInput[]) => IngestPingsResult;
  onUpdateBasecampLocation?: (
    basecampId: number,
    payload: { lat: number; lng: number; radius?: number; name?: string }
  ) => { error?: string };
}

export const LocationViews: React.FC<LocationViewsProps> = ({
  mode,
  state,
  session,
  contextId,
  onNavigate,
  onRecordLocationAccess,
  onIngestPings,
  onUpdateBasecampLocation,
}) => {
  const isTechnician = session.role.code === 'TEKNISI';

  const [selectedBasecampId, setSelectedBasecampId] = useState<number>(() =>
    isTechnician && session.basecamp ? session.basecamp.id : 7
  );
  const [selectedUserId, setSelectedUserId] = useState<number>(() =>
    isTechnician ? session.user.id : 201
  );

  // Route view state
  const [routeUserId, setRouteUserId] = useState<number>(() => {
    if (isTechnician) return session.user.id;
    const parsed = contextId ? Number(contextId) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 201;
  });
  const effectiveRouteUserId = isTechnician ? session.user.id : routeUserId;
  const [routeDate, setRouteDate] = useState<string>(state.currentDate);

  // Batch location simulation modal
  const [pingModalOpen, setPingModalOpen] = useState(false);
  const [pingUserId, setPingUserId] = useState<number>(() =>
    isTechnician ? session.user.id : 202
  );
  const [pingBattery, setPingBattery] = useState('86');
  const [pingStaleFix, setPingStaleFix] = useState(false);
  const [pingIsMock, setPingIsMock] = useState(false);
  const [pingIncludePostCheckout, setPingIncludePostCheckout] = useState(false);
  const [pingResult, setPingResult] = useState<IngestPingsResult | null>(null);

  // Basecamp coordinate modal
  const [basecampModalOpen, setBasecampModalOpen] = useState(false);
  const [bcCoordPaste, setBcCoordPaste] = useState('');
  const [bcLat, setBcLat] = useState('');
  const [bcLng, setBcLng] = useState('');
  const [bcRadius, setBcRadius] = useState('200');
  const [bcError, setBcError] = useState<string | null>(null);
  const [bcFeedback, setBcFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isTechnician && mode === 'jejak_teknisi' && contextId) {
      const parsed = Number(contextId);
      if (Number.isFinite(parsed) && parsed > 0) {
        setRouteUserId(parsed);
      }
    }
  }, [isTechnician, mode, contextId]);

  useEffect(() => {
    if (mode === 'jejak_teknisi') {
      onRecordLocationAccess(effectiveRouteUserId, routeDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, effectiveRouteUserId, routeDate]);

  const effectiveBasecampId =
    isTechnician && session.basecamp ? session.basecamp.id : selectedBasecampId;
  const activeBasecamp =
    state.basecamps.find((b) => b.id === effectiveBasecampId) ?? state.basecamps[0];
  const activeLocation = state.attendanceLocations.find(
    (l) => l.attendance_location_id === activeBasecamp.attendance_location_id
  );

  // Technicians placed in the selected basecamp with today's attendance & latest track
  const basecampTechRows = useMemo(() => {
    return state.userPlacements
      .filter((p) => {
        if (!p.is_current || p.basecamp_id !== activeBasecamp.id) return false;
        if (isTechnician && p.user_id !== session.user.id) return false;
        return true;
      })
      .map((p) => {
        const user = state.users.find((u) => u.id === p.user_id);
        const attendance = state.attendances.find(
          (a) => a.user_id === p.user_id && a.work_date === state.currentDate
        );
        const latestTrack = getLatestTrackForUser(state, p.user_id);
        if (!user || user.role_id !== 1) return null;

        const isTrackingActive = Boolean(attendance && attendance.check_out_time === null);
        const distM =
          latestTrack && activeLocation
            ? haversineMeters(
                latestTrack.latitude,
                latestTrack.longitude,
                activeLocation.lat,
                activeLocation.lng
              )
            : null;
        const outsideRadius =
          distM !== null && activeLocation ? distM > activeLocation.radius : false;
        const isStaleFix = Boolean(latestTrack && latestTrack.fix_at !== latestTrack.recorded_at);

        const initials = user.full_name
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('');

        return {
          user,
          initials,
          attendance,
          latestTrack,
          isTrackingActive,
          distM,
          outsideRadius,
          isStaleFix,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [state, activeBasecamp.id, activeLocation, isTechnician, session.user.id]);

  const activeOpenCount = state.attendances.filter((a) => {
    if (isTechnician && a.user_id !== session.user.id) return false;
    return a.work_date === state.currentDate && a.check_out_time === null;
  }).length;

  const techUsers = isTechnician
    ? [session.user]
    : state.users.filter((u) => u.role_id === 1 && u.status === 'ACTIVE');

  if (mode === 'jejak_teknisi') {
    const tech = state.users.find((u) => u.id === effectiveRouteUserId) ?? techUsers[0];
    const { basecamp, attendanceLocation } = getUserBasecampAndArea(state, tech.id);
    const tracks = state.locationTracks
      .filter((t) => t.user_id === tech.id && t.recorded_at.startsWith(routeDate))
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    const visibleAccessLogs = isTechnician
      ? state.locationAccessLogs.filter((log) => log.technician_user_id === session.user.id)
      : state.locationAccessLogs;

    const mockCount = tracks.filter((t) => t.is_mock).length;
    const staleCount = tracks.filter((t) => t.fix_at !== t.recorded_at).length;

    return (
      <div className="space-y-5">
        <PageHeader
          title="Jejak lokasi teknisi"
          subtitle={`${tech.full_name} · Basecamp ${basecamp?.name ?? '—'} · waktu dalam WITA`}
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
            <span className="text-[#64748B]">Teknisi</span>
            <select
              value={effectiveRouteUserId}
              disabled={isTechnician}
              onChange={(e) => {
                if (!isTechnician) setRouteUserId(Number(e.target.value));
              }}
              className="font-semibold text-[#0F172A] bg-transparent focus:outline-none disabled:opacity-80"
            >
              {techUsers.map((u) => {
                const bc = getUserBasecampAndArea(state, u.id).basecamp;
                return (
                  <option key={u.id} value={u.id}>
                    {u.full_name} · {bc?.name ?? '—'}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
            <span className="text-[#64748B]">Tanggal</span>
            <input
              type="date"
              value={routeDate}
              onChange={(e) => setRouteDate(e.target.value)}
              className="font-semibold text-[#0F172A] bg-transparent focus:outline-none"
            />
          </label>
        </div>

        <div className="px-4 py-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#083C73]">
          Setiap pembaruan lokasi terikat pada absensi aktif dan mencatat tingkat baterai, waktu GPS, serta waktu tercatat. Akses halaman ini tercatat ke log audit.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#0F172A]">Peta Jejak ({routeDate})</span>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#475569]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0A4B8F] shrink-0" /> Normal
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B45309] shrink-0" /> GPS Tertunda
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E61E25] shrink-0" /> Lokasi Palsu
                </span>
              </div>
            </div>

            <div className="relative h-[320px] bg-[#F2F3EE]">
              {tracks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#64748B] px-6 text-center">
                  Belum ada data jejak lokasi untuk {tech.full_name} pada {routeDate}.
                </div>
              ) : (
                <TechRouteGoogleMap
                  techName={tech.full_name}
                  routeDate={routeDate}
                  basecampName={
                    attendanceLocation?.name ?? (basecamp ? `Basecamp ${basecamp.name}` : undefined)
                  }
                  basecampCenter={
                    attendanceLocation
                      ? { lat: attendanceLocation.lat, lng: attendanceLocation.lng }
                      : undefined
                  }
                  radiusMeters={attendanceLocation?.radius}
                  tracks={tracks}
                  networkOnline={state.networkOnline}
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
                <p className="text-[11px] text-[#475569]">Titik lokasi</p>
                <p className="mt-1.5 text-xl font-bold text-[#0F172A] tabular-nums">{tracks.length}</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">unik per waktu tercatat</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
                <p className="text-[11px] text-[#475569]">GPS tertunda</p>
                <p className="mt-1.5 text-xl font-bold text-[#B45309] tabular-nums">{staleCount}</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">waktu GPS ≠ waktu kirim</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
                <p className="text-[11px] text-[#475569]">Indikasi lokasi palsu</p>
                <p className="mt-1.5 text-xl font-bold text-[#E61E25] tabular-nums">{mockCount}</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">ditandai sistem</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-[#0F172A]">Riwayat Lokasi Teknisi</h2>
                <span className="text-xs text-[#64748B]">terikat pada absensi aktif</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 px-4">Waktu Tercatat / GPS</th>
                      <th className="py-2 px-3">Baterai</th>
                      <th className="py-2 px-3">Akurasi</th>
                      <th className="py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {tracks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[#64748B]">
                          Tidak ada catatan lokasi pada tanggal ini.
                        </td>
                      </tr>
                    ) : (
                      tracks.map((t) => {
                        const isStale = t.fix_at !== t.recorded_at;
                        return (
                          <tr key={t.id}>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-[#0F172A]">
                              {formatTimeWita(t.recorded_at)}
                              {isStale && (
                                <span className="block text-[10px] text-[#B45309]">
                                  GPS {formatTimeWita(t.fix_at)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 tabular-nums text-[#334155]">
                              {formatPercent(t.battery_level, 0)}
                            </td>
                            <td className="py-2.5 px-3 tabular-nums text-[#475569]">{t.accuracy} m</td>
                            <td className="py-2.5 px-4">
                              {t.is_mock ? (
                                <StatusLabel tone="red" icon="warn" label="Lokasi Palsu" />
                              ) : isStale ? (
                                <StatusLabel tone="amber" icon="clock" label="GPS Tertunda" />
                              ) : (
                                <StatusLabel tone="green" icon="check" label={`Absensi #${t.attendance_id}`} />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Log akses lokasi terbaru</h2>
            <span className="text-xs text-[#64748B] tabular-nums">
              {visibleAccessLogs.length} catatan
            </span>
          </div>
          <div className="divide-y divide-[#E2E8F0] text-xs">
            {visibleAccessLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[#0F172A]">
                  <strong>{log.viewer_name}</strong> ({log.viewer_role}) melihat jejak{' '}
                  <strong>{log.technician_name}</strong> ({log.date})
                </span>
                <span className="text-[#64748B] tabular-nums">{log.accessed_at}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const handleRunPingSimulator = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPingUserId = isTechnician ? session.user.id : pingUserId;
    const att = state.attendances.find(
      (a) => a.user_id === targetPingUserId && a.work_date === state.currentDate
    );
    const { attendanceLocation } = getUserBasecampAndArea(state, targetPingUserId);
    if (!att || !attendanceLocation) return;

    const staleFixIso = addMinutesIso(state.serverNowIso, -15);
    const pings: LocationPingInput[] = [
      {
        ping_id: generateUniqueId(`ping-${targetPingUserId}`),
        user_id: targetPingUserId,
        attendance_id: att.id,
        latitude: attendanceLocation.lat + 0.0004,
        longitude: attendanceLocation.lng + 0.0003,
        accuracy: 11,
        battery_level: Number(pingBattery) || 85,
        is_mock: pingIsMock,
        fix_at: pingStaleFix ? staleFixIso : state.serverNowIso,
        recorded_at: state.serverNowIso,
      },
    ];

    if (!isTechnician && pingIncludePostCheckout) {
      const closedAtt = state.attendances.find((a) => a.check_out_time !== null);
      if (closedAtt && closedAtt.check_out_time) {
        const postCheckoutIso = addMinutesIso(
          closedAtt.check_out_time,
          state.trackingMaxToleranceMinutes + 8
        );
        pings.push({
          ping_id: generateUniqueId('ping-postcheckout'),
          user_id: closedAtt.user_id,
          attendance_id: closedAtt.id,
          latitude: closedAtt.check_in_lat,
          longitude: closedAtt.check_in_lng,
          accuracy: 12,
          battery_level: 74,
          is_mock: false,
          fix_at: postCheckoutIso,
          recorded_at: postCheckoutIso,
        });
      }
    }

    const res = onIngestPings(pings);
    setPingResult(res);
  };

  const visibleBasecamps =
    isTechnician && session.basecamp ? [session.basecamp] : state.basecamps;

  const canEditBasecamp =
    !isTechnician &&
    Boolean(onUpdateBasecampLocation) &&
    canUpdateBasecampLocation(session.role.code, activeBasecamp.id, session.basecamp?.id ?? null)
      .allowed;

  const openBasecampModal = () => {
    setBcCoordPaste('');
    setBcLat(activeLocation ? String(activeLocation.lat) : '-5.158113');
    setBcLng(activeLocation ? String(activeLocation.lng) : '119.47826');
    setBcRadius(String(activeLocation?.radius ?? 200));
    setBcError(null);
    setBasecampModalOpen(true);
  };

  const handleSaveBasecampCoords = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateBasecampLocation) return;
    const res = onUpdateBasecampLocation(activeBasecamp.id, {
      lat: bcLat.trim() === '' ? Number.NaN : Number(bcLat),
      lng: bcLng.trim() === '' ? Number.NaN : Number(bcLng),
      radius: bcRadius.trim() === '' ? Number.NaN : Number(bcRadius),
    });
    if (res.error) {
      setBcError(res.error);
      return;
    }
    setBcError(null);
    setBasecampModalOpen(false);
    setBcFeedback(
      `Lokasi ${activeLocation?.name ?? activeBasecamp.name} disimpan di ${Number(bcLat).toFixed(6)}, ${Number(bcLng).toFixed(6)} (radius ${Math.round(Number(bcRadius))} m).`
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pelacakan Langsung"
        subtitle={
          isTechnician
            ? 'Pelacakan lokasi Anda selama sesi absensi aktif'
            : `Pelacakan aktif selama absensi belum ditutup · ${activeOpenCount} teknisi aktif hari ini`
        }
        action={
          DEMO_MODE ? (
            <button
              type="button"
              onClick={() => {
                setPingResult(null);
                setPingModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Radio className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Simulasi Kirim Lokasi</span>
            </button>
          ) : undefined
        }
      />

      {bcFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-medium text-[#083C73] flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{bcFeedback}</span>
          </span>
          <button
            type="button"
            onClick={() => setBcFeedback(null)}
            className="text-[11px] font-semibold hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
          <span className="text-[#64748B]">Basecamp</span>
          <select
            value={effectiveBasecampId}
            disabled={isTechnician}
            onChange={(e) => {
              if (isTechnician) return;
              const id = Number(e.target.value);
              setSelectedBasecampId(id);
              setBcFeedback(null);
            }}
            className="font-semibold text-[#0F172A] bg-transparent focus:outline-none disabled:opacity-80"
          >
            {visibleBasecamps.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs text-[#475569]">
          <span>Toleransi pasca absen pulang:</span>
          <span className="font-mono font-semibold text-[#0F172A]">
            {state.trackingMaxToleranceMinutes} menit
          </span>
        </div>

        {canEditBasecamp && (
          <button
            type="button"
            onClick={openBasecampModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#0A4B8F] transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Atur Lokasi Basecamp</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <section className="lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Peta Radius Absensi · {activeLocation?.name ?? activeBasecamp.name}
            </h2>
            <span className="text-xs text-[#64748B] font-mono tabular-nums whitespace-nowrap shrink-0">
              {activeLocation ? `${activeLocation.lat.toFixed(6)}, ${activeLocation.lng.toFixed(6)} · ` : ''}
              Radius {activeLocation?.radius ?? 200} m
            </span>
          </div>

          <div className="relative h-[420px] bg-[#F2F3EE] overflow-hidden">
            <LiveTrackingGoogleMap
              basecampName={activeLocation?.name ?? activeBasecamp.name}
              center={{
                lat: activeLocation?.lat ?? -5.158113,
                lng: activeLocation?.lng ?? 119.47826,
              }}
              radiusMeters={activeLocation?.radius ?? 200}
              technicians={basecampTechRows.map((row) => ({
                user: row.user,
                initials: row.initials,
                latestTrack: row.latestTrack,
                isTrackingActive: row.isTrackingActive,
                distM: row.distM,
                outsideRadius: row.outsideRadius,
                isStaleFix: row.isStaleFix,
                attendanceId: row.attendance?.id,
              }))}
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
              networkOnline={state.networkOnline}
            />
          </div>
        </section>

        <section className="lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Teknisi di {activeBasecamp.name}</h2>
            <span className="text-xs text-[#64748B] tabular-nums">{basecampTechRows.length} teknisi</span>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {basecampTechRows.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                Belum ada teknisi ditempatkan di basecamp ini.
              </div>
            ) : (
              basecampTechRows.map((row) => {
                const tr = row.latestTrack;
                const selected = row.user.id === selectedUserId;
                return (
                  <div
                    key={row.user.id}
                    onClick={() => setSelectedUserId(row.user.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      selected ? 'bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: row.outsideRadius
                              ? '#E61E25'
                              : row.isTrackingActive
                              ? '#0A4B8F'
                              : '#686D67',
                          }}
                        >
                          {row.initials}
                        </span>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-[#0F172A] truncate">
                            {row.user.full_name}
                          </span>
                          {tr ? (
                            <span className="block text-xs text-[#475569] tabular-nums">
                              pembaruan {formatTimeWita(tr.recorded_at)} ·{' '}
                              <BatteryCharging className="inline w-3 h-3 text-[#0A4B8F]" aria-hidden="true" />{' '}
                              {formatPercent(tr.battery_level, 0)} · {row.distM ?? '—'} m · Absensi #{tr.attendance_id}
                            </span>
                          ) : (
                            <span className="block text-xs text-[#64748B]">Belum ada pembaruan lokasi hari ini</span>
                          )}
                          {row.isStaleFix && tr && (
                            <span className="block text-[11px] font-medium text-[#B45309]">
                              GPS tertunda: waktu GPS {formatTimeWita(tr.fix_at)} berbeda dari waktu kirim{' '}
                              {formatTimeWita(tr.recorded_at)} (catatan tetap tersimpan)
                            </span>
                          )}
                        </div>
                      </div>

                      {row.outsideRadius ? (
                        <StatusLabel tone="red" icon="error" label="Di luar radius" />
                      ) : row.isTrackingActive ? (
                        <StatusLabel tone="green" icon="check" label="Aktif" />
                      ) : row.attendance?.check_out_time ? (
                        <StatusLabel tone="gray" label="Absen Pulang" />
                      ) : (
                        <StatusLabel tone="amber" label="Belum absen" />
                      )}
                    </div>

                    <div className="mt-2 pl-11 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('jejak_teknisi', String(row.user.id));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A4B8F] hover:underline"
                      >
                        <RouteIcon className="w-3 h-3" aria-hidden="true" />
                        <span>Lihat jejak</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('rekap_kehadiran');
                        }}
                        className="text-xs font-semibold text-[#334155] hover:underline"
                      >
                        Tinjau absensi
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Batch Ping Modal (DEMO_MODE only) */}
      <Modal
        open={DEMO_MODE && pingModalOpen}
        onClose={() => setPingModalOpen(false)}
        ariaLabelledBy="ping-modal-title"
        maxWidthClass="max-w-lg"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 id="ping-modal-title" className="text-base font-bold text-[#0F172A]">
              Simulasi Pengiriman Lokasi
            </h3>
            <p className="text-xs text-[#475569] mt-0.5">
              Terima sebagian data lokasi valid, cegah duplikasi per waktu, dan tolak lokasi di luar toleransi absen pulang.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPingModalOpen(false)}
            className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
            aria-label="Tutup dialog pengiriman lokasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRunPingSimulator} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isTechnician ? (
              <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="block text-[11px] font-semibold text-[#64748B]">Akun Teknisi</span>
                <span className="block text-sm font-bold text-[#0F172A] mt-0.5 truncate">
                  {session.user.full_name}
                </span>
                <span className="block text-[11px] text-[#475569] truncate">
                  {(() => {
                    const ownOpenAtt = state.attendances.find(
                      (a) =>
                        a.user_id === session.user.id &&
                        a.work_date === state.currentDate &&
                        a.check_out_time === null
                    );
                    return ownOpenAtt
                      ? `Absensi aktif #${ownOpenAtt.id}`
                      : 'Belum ada absensi aktif hari ini';
                  })()}
                </span>
              </div>
            ) : (
              <label className="block">
                <span className="block text-xs font-semibold text-[#334155] mb-1">Teknisi (absensi aktif)</span>
                <select
                  value={pingUserId}
                  onChange={(e) => setPingUserId(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white"
                >
                  {state.attendances
                    .filter((a) => a.work_date === state.currentDate && a.check_out_time === null)
                    .map((a) => {
                      const u = state.users.find((us) => us.id === a.user_id);
                      return (
                        <option key={a.id} value={a.user_id}>
                          {u?.full_name} (Absensi #{a.id})
                        </option>
                      );
                    })}
                </select>
              </label>
            )}

            <label className="block">
              <span className="block text-xs font-semibold text-[#334155] mb-1">Tingkat baterai (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={pingBattery}
                onChange={(e) => setPingBattery(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm tabular-nums"
              />
            </label>
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pingStaleFix}
                onChange={(e) => setPingStaleFix(e.target.checked)}
              />
              <span>Simulasi GPS tertunda (waktu GPS 15 menit lebih lama — catatan tetap disimpan)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pingIsMock}
                onChange={(e) => setPingIsMock(e.target.checked)}
              />
              <span>Tandai sebagai lokasi palsu</span>
            </label>
            {!isTechnician && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pingIncludePostCheckout}
                  onChange={(e) => setPingIncludePostCheckout(e.target.checked)}
                />
                <span>Sertakan lokasi pasca absen pulang Rizky Pratama (uji penolakan sebagian)</span>
              </label>
            )}
          </div>

          {pingResult && (
            <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs space-y-1 text-[#083C73]">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                <span>
                  Diterima: {pingResult.accepted_ids.length} · Ditolak: {pingResult.rejected_ids.length}
                </span>
              </div>
              {pingResult.rejected_ids.map((rj) => (
                <p key={rj.ping_id} className="text-[#E61E25]">
                  Ditolak ({rj.ping_id}): {rj.reason}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPingModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
            >
              Tutup
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0A4B8F] text-white text-xs font-semibold hover:bg-[#083C73]"
            >
              Kirim Lokasi
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Basecamp Location Modal (Management / Manajer Area / Koordinator own basecamp) */}
      <Modal
        open={basecampModalOpen}
        onClose={() => setBasecampModalOpen(false)}
        ariaLabelledBy="basecamp-loc-modal-title"
        maxWidthClass="max-w-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="basecamp-loc-modal-title" className="text-base font-bold text-[#0F172A]">
              Atur Lokasi {activeLocation?.name ?? activeBasecamp.name}
            </h3>
            <p className="text-xs text-[#475569] mt-0.5">
              Koordinat ini menjadi pusat peta dan batas radius absensi teknisi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBasecampModalOpen(false)}
            className="p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
            aria-label="Tutup pengaturan lokasi basecamp"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveBasecampCoords} className="space-y-3.5">
          <label className="block">
            <span className="block text-xs font-semibold text-[#334155] mb-1">
              Tempel koordinat atau tautan Google Maps (opsional)
            </span>
            <input
              type="text"
              value={bcCoordPaste}
              placeholder="Contoh: -5.158113, 119.478260 atau URL Google Maps"
              onChange={(e) => {
                const val = e.target.value;
                setBcCoordPaste(val);
                const parsed = parseCoordinateInput(val);
                if (parsed) {
                  setBcLat(parsed.lat.toFixed(6));
                  setBcLng(parsed.lng.toFixed(6));
                  setBcError(null);
                }
              }}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-xs font-mono"
            />
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block">
              <span className="block text-xs font-semibold text-[#334155] mb-1">Lintang</span>
              <input
                type="text"
                value={bcLat}
                onChange={(e) => setBcLat(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg border border-[#E2E8F0] text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-[#334155] mb-1">Bujur</span>
              <input
                type="text"
                value={bcLng}
                onChange={(e) => setBcLng(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg border border-[#E2E8F0] text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-[#334155] mb-1">Radius (m)</span>
              <input
                type="number"
                value={bcRadius}
                onChange={(e) => setBcRadius(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg border border-[#E2E8F0] text-xs font-mono"
              />
            </label>
          </div>

          {bcError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#E61E25]"
            >
              {bcError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setBasecampModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#475569]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0A4B8F] hover:bg-[#083C73] text-white text-xs font-semibold"
            >
              Simpan Lokasi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
