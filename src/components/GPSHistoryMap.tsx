import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TrackingLog } from '../types';
import { Clock, MapPin, AlertTriangle, AlertCircle, Navigation, Play, Flag, Truck } from 'lucide-react';

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      try {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch (e) {
        console.error("Map bounds error", e);
      }
    }
  }, [positions, map]);
  return null;
}

// Custom markers using L.divIcon
const createCustomMarkerIcon = (type: 'start' | 'end' | 'stop' | 'anomalous' | 'evasion', label?: string) => {
  let bgClass = 'bg-blue-600';
  let borderClass = 'border-white';
  let iconSvg = '';

  if (type === 'start') {
    bgClass = 'bg-emerald-600';
    iconSvg = '🟢';
  } else if (type === 'end') {
    bgClass = 'bg-indigo-600';
    iconSvg = '🚚';
  } else if (type === 'anomalous') {
    bgClass = 'bg-amber-500 ring-4 ring-amber-300/60';
    iconSvg = '⚠️';
  } else if (type === 'evasion') {
    bgClass = 'bg-red-600 ring-4 ring-red-300/60';
    iconSvg = '🚨';
  } else {
    bgClass = 'bg-blue-600';
    iconSvg = '⏱️';
  }

  return L.divIcon({
    className: 'custom-gps-marker',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:${type === 'start' ? '#059669' : type === 'end' ? '#4f46e5' : type === 'anomalous' ? '#d97706' : type === 'evasion' ? '#dc2626' : '#2563eb'};color:white;font-weight:bold;font-size:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.2),0 2px 4px -2px rgba(0,0,0,0.2);border:2px solid white;">
        ${label || iconSvg}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

interface GPSHistoryMapProps {
  logs: TrackingLog[];
  selectedFilter?: 'all' | 'paradas' | 'anomalous' | 'evasions';
}

export default function GPSHistoryMap({ logs, selectedFilter = 'all' }: GPSHistoryMapProps) {
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [logs]);

  const polylineCoords = useMemo(() => {
    return sortedLogs.map(l => [l.lat, l.lng] as [number, number]);
  }, [sortedLogs]);

  const markers = useMemo(() => {
    let stopIdx = 1;
    return sortedLogs.map((log, index) => {
      const isFirst = index === 0;
      const isLast = index === sortedLogs.length - 1;
      const durationMins = log.duration ? Math.round(log.duration / 60) : 0;
      const isAnomalous = durationMins > 15;
      const isEvasion = log.type === 'evasion';
      const isStop = log.type === 'parada' || durationMins > 0;

      let type: 'start' | 'end' | 'stop' | 'anomalous' | 'evasion' = 'stop';
      if (isFirst) type = 'start';
      else if (isLast) type = 'end';
      else if (isEvasion) type = 'evasion';
      else if (isAnomalous) type = 'anomalous';

      return {
        log,
        index,
        type,
        isStop,
        isAnomalous,
        isEvasion,
        isFirst,
        isLast,
        durationMins,
        stopNumber: isStop && !isFirst && !isLast ? stopIdx++ : undefined,
      };
    });
  }, [sortedLogs]);

  const filteredMarkers = useMemo(() => {
    if (selectedFilter === 'paradas') {
      return markers.filter(m => m.isStop || m.isFirst || m.isLast);
    }
    if (selectedFilter === 'anomalous') {
      return markers.filter(m => m.isAnomalous);
    }
    if (selectedFilter === 'evasions') {
      return markers.filter(m => m.isEvasion);
    }
    return markers;
  }, [markers, selectedFilter]);

  const defaultCenter: [number, number] = polylineCoords.length > 0 ? polylineCoords[0] : [21.2511, -102.3252];

  if (logs.length === 0) {
    return (
      <div className="w-full h-80 rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 border border-slate-200">
        <Navigation className="w-10 h-10 mb-2 text-slate-300" />
        <p className="font-medium text-sm">Sin coordenadas registradas para este periodo y ruta.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[450px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds positions={polylineCoords} />

        {/* Trajectory Polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
              dashArray: '8, 8',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Small motion trail dots */}
        {sortedLogs.map((log, idx) => (
          <CircleMarker
            key={`dot-${log.id || idx}`}
            center={[log.lat, log.lng]}
            radius={3}
            pathOptions={{
              fillColor: '#2563eb',
              color: '#ffffff',
              weight: 1,
              fillOpacity: 0.6,
            }}
          />
        ))}

        {/* Highlighted Event Markers */}
        {filteredMarkers.map(({ log, type, durationMins, isAnomalous, isEvasion, isFirst, isLast, stopNumber }, idx) => (
          <Marker
            key={`marker-${log.id || idx}`}
            position={[log.lat, log.lng]}
            icon={createCustomMarkerIcon(type, stopNumber ? `${stopNumber}` : undefined)}
          >
            <Popup>
              <div className="p-1 space-y-2 min-w-[200px] font-sans">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isEvasion ? 'text-red-600' : isAnomalous ? 'text-amber-600' : 'text-blue-600'}`}>
                    {isFirst ? '🚀 Inicio de Trayecto' : isLast ? '🏁 Posición Actual / Fin' : isEvasion ? '🚨 Evasión Detectada' : isAnomalous ? '⚠️ Parada Excesiva' : '📍 Parada Registrada'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-sm font-bold text-slate-800">
                  {log.notes || 'Registro GPS'}
                </p>

                {durationMins > 0 && (
                  <p className={`text-xs font-bold flex items-center gap-1 ${isAnomalous ? 'text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200' : 'text-slate-600'}`}>
                    <Clock className="w-3.5 h-3.5" /> Detenido: {durationMins} min
                  </p>
                )}

                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>GPS: {log.lat.toFixed(5)}, {log.lng.toFixed(5)}</span>
                  <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
