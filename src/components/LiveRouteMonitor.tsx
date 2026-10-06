import React, { useState, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { AppState, RouteConfig, TrackingLog } from '../types';
import {
  Navigation,
  RefreshCw,
  MapPin,
  Clock,
  Radio,
  Eye,
  X,
  Truck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Maximize2,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

function MapCentering({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const createLiveVehicleIcon = (routeName: string, isRecent: boolean) => {
  const color = isRecent ? '#2563eb' : '#64748b';
  return L.divIcon({
    className: 'live-vehicle-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="background:${color};color:white;font-weight:bold;font-size:11px;padding:2px 8px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.25);border:2px solid white;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${isRecent ? '#22c55e' : '#cbd5e1'};"></span>
          ${routeName}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color};"></div>
      </div>
    `,
    iconSize: [80, 40],
    iconAnchor: [40, 40],
    popupAnchor: [0, -38],
  });
};

interface LiveRouteMonitorProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function LiveRouteMonitor({ state, setState }: LiveRouteMonitorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState<Date>(new Date());
  const [showLiveMapModal, setShowLiveMapModal] = useState(false);
  const [focusedRouteId, setFocusedRouteId] = useState<number | null>(null);

  // Get current day name for filtering today's visits
  const currentDayName = useMemo(() => {
    const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const currentDay = new Date().getDay();
    return currentDay === 0 ? 'Lunes' : daysMap[currentDay];
  }, []);

  // Compute live status per route
  const routesStatus = useMemo(() => {
    const now = Date.now();
    const authorizedRoutes = state.routes.filter((r) => r.isAuthorized !== false && r.isDelivery !== false);

    return authorizedRoutes.map((route) => {
      // Find all tracking logs for this route
      const routeLogs = (state.trackingLogs || []).filter((l) => l.routeId === route.id);
      
      // Latest GPS log
      let latestLog: TrackingLog | null = null;
      if (routeLogs.length > 0) {
        latestLog = routeLogs.reduce((prev, curr) =>
          new Date(curr.timestamp).getTime() > new Date(prev.timestamp).getTime() ? curr : prev
        );
      }

      // Today's visits
      const todayVisits = state.visits.filter(
        (v) => v.routeId === route.id && (v.day === currentDayName || !v.day)
      );
      const completedVisits = todayVisits.filter((v) => v.status !== 'PENDIENTE');
      const progressPct = todayVisits.length > 0 ? Math.round((completedVisits.length / todayVisits.length) * 100) : 0;
      const nextPendingVisit = todayVisits.find((v) => v.status === 'PENDIENTE');

      // Age of last ping
      let isOnline = false;
      let minutesAgo = -1;
      if (latestLog) {
        const logTime = new Date(latestLog.timestamp).getTime();
        minutesAgo = Math.floor((now - logTime) / 60000);
        isOnline = minutesAgo <= 15;
      }

      return {
        route,
        latestLog,
        minutesAgo,
        isOnline,
        todayVisitsCount: todayVisits.length,
        completedVisitsCount: completedVisits.length,
        progressPct,
        nextPendingVisit,
      };
    });
  }, [state.routes, state.trackingLogs, state.visits, currentDayName]);

  // Request live tracking update on demand
  const handleRequestLiveLocations = async () => {
    setIsRefreshing(true);
    try {
      // Fetch latest state & tracking
      const res = await apiFetch(`/api/data/delta?since=0&version=0&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.visits) {
          setState((prev) => ({
            ...prev,
            visits: data.visits || prev.visits,
            routes: data.routes || prev.routes,
            trackingLogs: data.trackingLogs || prev.trackingLogs,
            stateVersion: data.stateVersion || prev.stateVersion,
          }));
        }
      }
      setLastRequestTime(new Date());
    } catch (e) {
      console.error('Error requesting live updates', e);
    }
    setIsRefreshing(false);
  };

  // Map center coordinates
  const activeLogsWithCoords = routesStatus
    .filter((rs) => rs.latestLog && rs.latestLog.lat && rs.latestLog.lng)
    .map((rs) => rs.latestLog!);

  const defaultCenter: [number, number] =
    activeLogsWithCoords.length > 0
      ? [activeLogsWithCoords[0].lat, activeLogsWithCoords[0].lng]
      : [21.2511, -102.3252];

  const focusedCenter: [number, number] = useMemo(() => {
    if (focusedRouteId) {
      const match = routesStatus.find((rs) => rs.route.id === focusedRouteId);
      if (match?.latestLog?.lat && match?.latestLog?.lng) {
        return [match.latestLog.lat, match.latestLog.lng];
      }
    }
    return defaultCenter;
  }, [focusedRouteId, routesStatus, defaultCenter]);

  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-xs p-4 mb-6 transition-all font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Monitoreo en Tiempo Real (A Solicitud)
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                Admin & Supervisor
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Última actualización solicitada: {lastRequestTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowLiveMapModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Ver Mapa en Vivo
          </button>
          <button
            onClick={handleRequestLiveLocations}
            disabled={isRefreshing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Solicitando...' : 'Solicitar Ubicaciones Ahora'}
          </button>
        </div>
      </div>

      {/* Live Route Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
        {routesStatus.map(({ route, latestLog, minutesAgo, isOnline, todayVisitsCount, completedVisitsCount, progressPct, nextPendingVisit }) => (
          <div
            key={route.id}
            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all hover:shadow-sm ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50/40'
                : latestLog
                ? 'border-slate-200 bg-slate-50/60'
                : 'border-slate-200 bg-white opacity-80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Truck className={`w-4 h-4 ${isOnline ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span className="font-bold text-sm text-slate-800">{route.name}</span>
                </div>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    En Vivo
                  </span>
                ) : latestLog ? (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                    Hace {minutesAgo}m
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Sin pings
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1 mb-2.5">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>Progreso hoy ({currentDayName})</span>
                  <span>{completedVisitsCount}/{todayVisitsCount} ({progressPct}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPct >= 100 ? 'bg-emerald-500' : progressPct > 50 ? 'bg-blue-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, progressPct)}%` }}
                  ></div>
                </div>
              </div>

              {/* Status details */}
              <div className="text-xs text-slate-600 space-y-1">
                {latestLog ? (
                  <p className="truncate text-slate-700 font-medium flex items-center gap-1" title={latestLog.notes || 'Posición en ruta'}>
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{latestLog.notes || `Coord: ${latestLog.lat.toFixed(4)}, ${latestLog.lng.toFixed(4)}`}</span>
                  </p>
                ) : (
                  <p className="text-slate-400 italic">Esperando inicio de jornada...</p>
                )}

                {nextPendingVisit && (
                  <p className="text-[11px] text-slate-500 truncate">
                    Siguiente: <span className="font-semibold text-slate-700">{nextPendingVisit.clientName}</span>
                  </p>
                )}
              </div>
            </div>

            {latestLog && (
              <button
                onClick={() => {
                  setFocusedRouteId(route.id);
                  setShowLiveMapModal(true);
                }}
                className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-slate-600 text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs"
              >
                <Eye className="w-3 h-3" /> Ver Ubicación en Mapa
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Live Full Map Modal */}
      {showLiveMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Posición en Tiempo Real de Todas las Rutas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mostrando última ubicación GPS reportada por los operadores
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRequestLiveLocations}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
                <button
                  onClick={() => setShowLiveMapModal(false)}
                  className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative">
              <MapContainer
                center={focusedCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapCentering center={focusedCenter} zoom={focusedRouteId ? 15 : 13} />

                {routesStatus
                  .filter((rs) => rs.latestLog && rs.latestLog.lat && rs.latestLog.lng)
                  .map(({ route, latestLog, isOnline, minutesAgo, completedVisitsCount, todayVisitsCount, progressPct, nextPendingVisit }) => {
                    if (!latestLog) return null;
                    return (
                      <Marker
                        key={`live-marker-${route.id}`}
                        position={[latestLog.lat, latestLog.lng]}
                        icon={createLiveVehicleIcon(route.name, isOnline)}
                      >
                        <Popup>
                          <div className="p-1 space-y-2 min-w-[200px] font-sans">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                              <span className="font-bold text-sm text-slate-900">{route.name}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isOnline
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isOnline ? 'En Vivo' : `Hace ${minutesAgo} min`}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 font-medium">
                              {latestLog.notes || 'En ruta de entrega'}
                            </p>

                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                              <p className="font-semibold text-slate-600">
                                Avance hoy: {completedVisitsCount} / {todayVisitsCount} ({progressPct}%)
                              </p>
                              {nextPendingVisit && (
                                <p className="text-[11px] text-slate-500 mt-1">
                                  Próxima parada: <span className="font-bold text-slate-700">{nextPendingVisit.clientName}</span>
                                </p>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                              <span>{latestLog.lat.toFixed(5)}, {latestLog.lng.toFixed(5)}</span>
                              <span>{new Date(latestLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
