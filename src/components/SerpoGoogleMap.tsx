/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Circle,
  InfoWindow,
  Map as GoogleMap,
  Polyline,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { Crosshair, Home, Layers, Minus, Plus, WifiOff } from 'lucide-react';
import { LocationTrack, User } from '../types/serpo';
import { formatPercent, formatTimeWita } from '../utils/serpoLogic';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];
const DEMO_MAP_ID = 'DEMO_MAP_ID';

export interface LiveTechPinItem {
  user: User;
  initials: string;
  latestTrack: LocationTrack | undefined;
  isTrackingActive: boolean;
  distM: number | null;
  outsideRadius: boolean;
  isStaleFix: boolean;
  attendanceId?: number;
}

interface LiveTrackingGoogleMapProps {
  basecampName: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  technicians: LiveTechPinItem[];
  selectedUserId: number;
  onSelectUser: (userId: number) => void;
  networkOnline: boolean;
}

interface TechRouteGoogleMapProps {
  techName: string;
  routeDate: string;
  basecampName?: string;
  basecampCenter?: { lat: number; lng: number };
  radiusMeters?: number;
  tracks: LocationTrack[];
  networkOnline: boolean;
}

function getMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';
}

const MapStatusFallback: React.FC<{
  title: string;
  description: string;
  coordsLabel?: string;
}> = ({ title, description, coordsLabel }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-[#F1F5F9] text-center px-6 py-6 gap-2.5">
    <div className="w-10 h-10 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0A4B8F] shadow-xs">
      <WifiOff className="w-5 h-5" aria-hidden="true" />
    </div>
    <p className="text-sm font-bold text-[#0F172A]">{title}</p>
    <p className="text-xs text-[#475569] max-w-sm leading-relaxed">{description}</p>
    {coordsLabel && (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] font-mono text-[11px] text-[#334155]">
        {coordsLabel}
      </span>
    )}
  </div>
);

interface MapControlsProps {
  mapType: 'roadmap' | 'hybrid';
  onToggleMapType: () => void;
  onRecenter: () => void;
}

const SerpoMapControls: React.FC<MapControlsProps> = ({
  mapType,
  onToggleMapType,
  onRecenter,
}) => {
  const map = useMap();

  const handleZoom = (delta: number) => {
    if (!map) return;
    const current = map.getZoom() ?? 16;
    map.setZoom(Math.max(4, Math.min(20, current + delta)));
  };

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => handleZoom(1)}
        className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center text-[#0F172A] hover:bg-[#F8FAFC]"
        aria-label="Perbesar peta"
        title="Perbesar peta"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => handleZoom(-1)}
        className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center text-[#0F172A] hover:bg-[#F8FAFC]"
        aria-label="Perkecil peta"
        title="Perkecil peta"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onRecenter}
        className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center text-[#0A4B8F] hover:bg-[#F8FAFC]"
        aria-label="Pusatkan peta"
        title="Pusatkan peta"
      >
        <Crosshair className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onToggleMapType}
        className={`w-8 h-8 rounded-lg border shadow-xs flex items-center justify-center transition-colors ${
          mapType === 'hybrid'
            ? 'bg-[#0A4B8F] border-[#0A4B8F] text-white'
            : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'
        }`}
        aria-label={mapType === 'hybrid' ? 'Tampilan peta jalan' : 'Tampilan satelit'}
        title={mapType === 'hybrid' ? 'Peta jalan' : 'Satelit'}
      >
        <Layers className="w-4 h-4" />
      </button>
    </div>
  );
};

interface LiveBoundsSyncProps {
  center: { lat: number; lng: number };
  radiusMeters: number;
  points: { lat: number; lng: number }[];
  selectedPoint: { lat: number; lng: number } | null;
  recenterTick: number;
}

const LiveCameraManager: React.FC<LiveBoundsSyncProps> = ({
  center,
  radiusMeters,
  points,
  selectedPoint,
  recenterTick,
}) => {
  const map = useMap();
  const prevCenterKeyRef = useRef<string>('');
  const prevRecenterRef = useRef<number>(0);

  const fitAllPoints = useCallback(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(center);

    // Include geofence radius envelope so circle always stays well framed
    const latOffset = radiusMeters / 111_111;
    const lngOffset =
      radiusMeters / (111_111 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
    bounds.extend({ lat: center.lat + latOffset, lng: center.lng + lngOffset });
    bounds.extend({ lat: center.lat - latOffset, lng: center.lng - lngOffset });

    for (const pt of points) {
      bounds.extend(pt);
    }

    map.fitBounds(bounds, { top: 64, right: 56, bottom: 36, left: 36 });
  }, [map, center, radiusMeters, points]);

  useEffect(() => {
    if (!map) return;
    const centerKey = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${radiusMeters}`;
    if (prevCenterKeyRef.current !== centerKey || prevRecenterRef.current !== recenterTick) {
      prevCenterKeyRef.current = centerKey;
      prevRecenterRef.current = recenterTick;
      fitAllPoints();
    }
  }, [map, center, radiusMeters, recenterTick, fitAllPoints]);

  useEffect(() => {
    if (!map || !selectedPoint) return;
    const currentBounds = map.getBounds();
    if (currentBounds && !currentBounds.contains(selectedPoint)) {
      map.panTo(selectedPoint);
    }
  }, [map, selectedPoint]);

  return null;
};

interface LiveMapInnerProps extends Omit<LiveTrackingGoogleMapProps, 'networkOnline'> {}

const LiveTrackingMapInner: React.FC<LiveMapInnerProps> = ({
  basecampName,
  center,
  radiusMeters,
  technicians,
  selectedUserId,
  onSelectUser,
}) => {
  const status = useApiLoadingStatus();
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [recenterTick, setRecenterTick] = useState(0);
  const [infoUserId, setInfoUserId] = useState<number | null>(null);
  const markerRefs = useRef<Record<number, google.maps.marker.AdvancedMarkerElement | null>>({});

  const trackPoints = useMemo(
    () =>
      technicians
        .filter((t) => Boolean(t.latestTrack))
        .map((t) => ({
          lat: t.latestTrack!.latitude,
          lng: t.latestTrack!.longitude,
        })),
    [technicians]
  );

  const selectedTech = useMemo(
    () => technicians.find((t) => t.user.id === selectedUserId) ?? null,
    [technicians, selectedUserId]
  );

  const selectedPoint = selectedTech?.latestTrack
    ? { lat: selectedTech.latestTrack.latitude, lng: selectedTech.latestTrack.longitude }
    : null;

  const infoTech = useMemo(
    () => technicians.find((t) => t.user.id === infoUserId && t.latestTrack) ?? null,
    [technicians, infoUserId]
  );

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <MapStatusFallback
        title="Peta Google Maps tidak dapat dimuat"
        description="Periksa koneksi internet atau konfigurasi kunci Google Maps Platform."
        coordsLabel={`${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}
      />
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="relative flex-1 min-h-0 w-full">
        <GoogleMap
          mapId={DEMO_MAP_ID}
          defaultCenter={center}
          defaultZoom={16}
          mapTypeId={mapType}
          gestureHandling="greedy"
          disableDefaultUI={true}
          clickableIcons={false}
          internalUsageAttributionIds={ATTRIBUTION_IDS}
          style={{ width: '100%', height: '100%' }}
          aria-label={`Peta Google Maps radius absensi ${basecampName}`}
        >
          <LiveCameraManager
            center={center}
            radiusMeters={radiusMeters}
            points={trackPoints}
            selectedPoint={selectedPoint}
            recenterTick={recenterTick}
          />

          <SerpoMapControls
            mapType={mapType}
            onToggleMapType={() => setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))}
            onRecenter={() => setRecenterTick((v) => v + 1)}
          />

          <Circle
            center={center}
            radius={radiusMeters}
            strokeColor="#0A4B8F"
            strokeOpacity={0.85}
            strokeWeight={2}
            fillColor="#0A4B8F"
            fillOpacity={0.1}
            clickable={false}
          />

          <AdvancedMarker
            position={center}
            title={`${basecampName} (Titik Absen · Radius ${radiusMeters} m)`}
            zIndex={5}
          >
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-white border-2 border-white shadow-md flex items-center justify-center">
              <Home className="w-4 h-4" aria-hidden="true" />
            </div>
          </AdvancedMarker>

          {technicians.map((row) => {
            const tr = row.latestTrack;
            if (!tr) return null;
            const pos = { lat: tr.latitude, lng: tr.longitude };
            const isAlert = row.outsideRadius || tr.is_mock;
            const pinColor = isAlert
              ? '#E61E25'
              : row.isTrackingActive
              ? '#0A4B8F'
              : '#686D67';
            const selected = row.user.id === selectedUserId;

            return (
              <React.Fragment key={row.user.id}>
                {row.outsideRadius && (
                  <Polyline
                    path={[center, pos]}
                    strokeColor="#E61E25"
                    strokeOpacity={0.75}
                    strokeWeight={2}
                    geodesic={true}
                  />
                )}
                <AdvancedMarker
                  ref={(el) => {
                    markerRefs.current[row.user.id] = el;
                  }}
                  position={pos}
                  title={`${row.user.full_name} · ${row.distM ?? '—'} m`}
                  zIndex={selected ? 30 : 15}
                  onClick={() => {
                    onSelectUser(row.user.id);
                    setInfoUserId(row.user.id);
                  }}
                >
                  <div className="relative flex flex-col items-center cursor-pointer">
                    <div
                      className={`w-9 h-9 rounded-full text-white text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-md transition-transform ${
                        selected ? 'scale-110 ring-2 ring-offset-1' : 'hover:scale-105'
                      }`}
                      style={{
                        backgroundColor: pinColor,
                        boxShadow: selected ? `0 0 0 2px ${pinColor}` : undefined,
                      }}
                    >
                      {row.initials}
                    </div>
                  </div>
                </AdvancedMarker>
              </React.Fragment>
            );
          })}

          {infoTech && infoTech.latestTrack && markerRefs.current[infoTech.user.id] && (
            <InfoWindow
              anchor={markerRefs.current[infoTech.user.id]}
              onCloseClick={() => setInfoUserId(null)}
              maxWidth={240}
            >
              <div className="text-xs text-[#0F172A] space-y-1 pr-1">
                <p className="font-bold text-sm leading-tight">{infoTech.user.full_name}</p>
                <p className="text-[11px] text-[#475569] tabular-nums">
                  Pembaruan {formatTimeWita(infoTech.latestTrack.recorded_at)} · Baterai{' '}
                  {formatPercent(infoTech.latestTrack.battery_level, 0)}
                </p>
                <p className="text-[11px] text-[#334155] tabular-nums">
                  Jarak: <strong>{infoTech.distM ?? '—'} m</strong> · Akurasi{' '}
                  {infoTech.latestTrack.accuracy} m
                </p>
                <p
                  className={`text-[11px] font-semibold ${
                    infoTech.outsideRadius || infoTech.latestTrack.is_mock
                      ? 'text-[#E61E25]'
                      : infoTech.isTrackingActive
                      ? 'text-[#0A4B8F]'
                      : 'text-[#686D67]'
                  }`}
                >
                  {infoTech.latestTrack.is_mock
                    ? 'Indikasi lokasi palsu'
                    : infoTech.outsideRadius
                    ? 'Di luar radius absen'
                    : infoTech.isTrackingActive
                    ? 'Absensi aktif & dalam radius'
                    : 'Sudah absen pulang / nonaktif'}
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      <div className="shrink-0 bg-white border-t border-[#E2E8F0] px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0A4B8F] shrink-0" />
          <span className="text-[#334155]">Absensi aktif & dalam radius</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#686D67] shrink-0" />
          <span className="text-[#334155]">Sudah absen pulang / nonaktif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E61E25] shrink-0" />
          <span className="text-[#334155]">Di luar radius / lokasi palsu</span>
        </div>
      </div>
    </div>
  );
};

export const LiveTrackingGoogleMap: React.FC<LiveTrackingGoogleMapProps> = ({
  networkOnline,
  ...props
}) => {
  const apiKey = getMapsApiKey();

  if (!networkOnline) {
    return (
      <MapStatusFallback
        title="Mode Offline Aktif"
        description="Peta interaktif Google Maps memerlukan koneksi internet. Aktifkan kembali mode Online untuk memuat peta basecamp dan pin teknisi."
        coordsLabel={`${props.basecampName} · ${props.center.lat.toFixed(4)}, ${props.center.lng.toFixed(4)}`}
      />
    );
  }

  if (!apiKey) {
    return (
      <MapStatusFallback
        title="Kunci Google Maps Belum Tersedia"
        description="Kunci API Google Maps belum dikonfigurasi pada lingkungan aplikasi ini."
        coordsLabel={`${props.basecampName} · ${props.center.lat.toFixed(4)}, ${props.center.lng.toFixed(4)}`}
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="id" region="ID" libraries={['marker', 'maps']}>
      <LiveTrackingMapInner {...props} />
    </APIProvider>
  );
};

interface RouteBoundsSyncProps {
  tracks: LocationTrack[];
  basecampCenter?: { lat: number; lng: number };
  recenterTick: number;
}

const RouteCameraManager: React.FC<RouteBoundsSyncProps> = ({
  tracks,
  basecampCenter,
  recenterTick,
}) => {
  const map = useMap();
  const keyRef = useRef<string>('');
  const recenterRef = useRef<number>(0);

  const fitRoute = useCallback(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    if (tracks.length === 0 && !basecampCenter) return;

    const bounds = new google.maps.LatLngBounds();
    if (basecampCenter) {
      bounds.extend(basecampCenter);
    }
    for (const tr of tracks) {
      bounds.extend({ lat: tr.latitude, lng: tr.longitude });
    }

    if (tracks.length <= 1 && !basecampCenter && tracks[0]) {
      map.setCenter({ lat: tracks[0].latitude, lng: tracks[0].longitude });
      map.setZoom(16);
      return;
    }

    map.fitBounds(bounds, { top: 44, right: 48, bottom: 36, left: 36 });
  }, [map, tracks, basecampCenter]);

  useEffect(() => {
    if (!map) return;
    const key = `${tracks.map((t) => t.id).join(',')}|${basecampCenter?.lat ?? ''}`;
    if (keyRef.current !== key || recenterRef.current !== recenterTick) {
      keyRef.current = key;
      recenterRef.current = recenterTick;
      fitRoute();
    }
  }, [map, tracks, basecampCenter, recenterTick, fitRoute]);

  return null;
};

interface TechRouteInnerProps extends Omit<TechRouteGoogleMapProps, 'networkOnline'> {}

const TechRouteMapInner: React.FC<TechRouteInnerProps> = ({
  techName,
  routeDate,
  basecampName,
  basecampCenter,
  radiusMeters,
  tracks,
}) => {
  const status = useApiLoadingStatus();
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [recenterTick, setRecenterTick] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const markerRefs = useRef<Record<number, google.maps.marker.AdvancedMarkerElement | null>>({});

  const defaultCenter = useMemo(() => {
    if (tracks.length > 0) {
      return { lat: tracks[0].latitude, lng: tracks[0].longitude };
    }
    return basecampCenter ?? { lat: -5.158113, lng: 119.47826 };
  }, [tracks, basecampCenter]);

  const routePath = useMemo(
    () => tracks.map((t) => ({ lat: t.latitude, lng: t.longitude })),
    [tracks]
  );

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? null,
    [tracks, selectedTrackId]
  );

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <MapStatusFallback
        title="Peta jejak Google Maps tidak dapat dimuat"
        description="Periksa koneksi internet atau konfigurasi kunci Google Maps Platform."
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapId={DEMO_MAP_ID}
        defaultCenter={defaultCenter}
        defaultZoom={16}
        mapTypeId={mapType}
        gestureHandling="greedy"
        disableDefaultUI={true}
        clickableIcons={false}
        internalUsageAttributionIds={ATTRIBUTION_IDS}
        style={{ width: '100%', height: '100%' }}
        aria-label={`Peta Google Maps rute ${techName} tanggal ${routeDate}`}
      >
        <RouteCameraManager
          tracks={tracks}
          basecampCenter={basecampCenter}
          recenterTick={recenterTick}
        />

        <SerpoMapControls
          mapType={mapType}
          onToggleMapType={() => setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))}
          onRecenter={() => setRecenterTick((v) => v + 1)}
        />

        {basecampCenter && radiusMeters && (
          <>
            <Circle
              center={basecampCenter}
              radius={radiusMeters}
              strokeColor="#0A4B8F"
              strokeOpacity={0.65}
              strokeWeight={1.5}
              fillColor="#0A4B8F"
              fillOpacity={0.07}
              clickable={false}
            />
            <AdvancedMarker position={basecampCenter} title={basecampName ?? 'Basecamp'} zIndex={5}>
              <div className="w-7 h-7 rounded-lg bg-[#0F172A] text-white border-2 border-white shadow-md flex items-center justify-center">
                <Home className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
            </AdvancedMarker>
          </>
        )}

        {routePath.length >= 2 && (
          <Polyline
            path={routePath}
            strokeColor="#0A4B8F"
            strokeOpacity={0.85}
            strokeWeight={3}
            geodesic={true}
          />
        )}

        {tracks.map((t, index) => {
          const isStale = t.fix_at !== t.recorded_at;
          const color = t.is_mock ? '#E61E25' : isStale ? '#B45309' : '#0A4B8F';
          return (
            <AdvancedMarker
              key={t.id}
              ref={(el) => {
                markerRefs.current[t.id] = el;
              }}
              position={{ lat: t.latitude, lng: t.longitude }}
              title={`${formatTimeWita(t.recorded_at)} · Titik #${index + 1}`}
              zIndex={15 + index}
              onClick={() => setSelectedTrackId(t.id)}
            >
              <div className="flex items-center gap-1 cursor-pointer">
                <span
                  className="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {index + 1}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/95 border border-[#E2E8F0] text-[10px] font-semibold text-[#0F172A] shadow-xs tabular-nums">
                  {formatTimeWita(t.recorded_at)}
                </span>
              </div>
            </AdvancedMarker>
          );
        })}

        {selectedTrack && markerRefs.current[selectedTrack.id] && (
          <InfoWindow
            anchor={markerRefs.current[selectedTrack.id]}
            onCloseClick={() => setSelectedTrackId(null)}
            maxWidth={240}
          >
            <div className="text-xs text-[#0F172A] space-y-1 pr-1">
              <p className="font-bold">
                Waktu {formatTimeWita(selectedTrack.recorded_at)} WITA
              </p>
              {selectedTrack.fix_at !== selectedTrack.recorded_at && (
                <p className="text-[11px] text-[#B45309]">
                  Waktu GPS: {formatTimeWita(selectedTrack.fix_at)} WITA (tertunda)
                </p>
              )}
              <p className="text-[11px] text-[#475569] tabular-nums">
                Baterai {formatPercent(selectedTrack.battery_level, 0)} · Akurasi{' '}
                {selectedTrack.accuracy} m
              </p>
              <p className="text-[11px] font-mono text-[#64748B]">
                {selectedTrack.latitude.toFixed(5)}, {selectedTrack.longitude.toFixed(5)}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export const TechRouteGoogleMap: React.FC<TechRouteGoogleMapProps> = ({
  networkOnline,
  ...props
}) => {
  const apiKey = getMapsApiKey();

  if (!networkOnline) {
    return (
      <MapStatusFallback
        title="Mode Offline Aktif"
        description="Peta jejak Google Maps memerlukan koneksi internet. Tabel riwayat koordinat tetap tersedia di sebelah kanan."
      />
    );
  }

  if (!apiKey) {
    return (
      <MapStatusFallback
        title="Kunci Google Maps Belum Tersedia"
        description="Kunci API Google Maps belum dikonfigurasi pada lingkungan aplikasi ini."
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="id" region="ID" libraries={['marker', 'maps']}>
      <TechRouteMapInner {...props} />
    </APIProvider>
  );
};
