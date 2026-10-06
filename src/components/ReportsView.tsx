import React, { useState, useMemo } from 'react';
import { AppState } from '../types';
import {
  Clock,
  MapPin,
  Search,
  CheckCircle,
  Navigation,
  TrendingUp,
  AlertCircle,
  Map as MapIcon,
  ListFilter,
  Download,
  Activity,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import GPSHistoryMap from './GPSHistoryMap';

const getWeekNumber = (d: string | Date | number) => {
  if (!d) return 0;
  try {
    const date = typeof d === 'string' && !d.includes('T') ? new Date(d + 'T00:00:00') : new Date(d);
    date.setHours(0, 0, 0, 0);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    const pastDaysOfYear = Math.round((date.getTime() - startOfYear.getTime()) / 86400000);
    return Math.floor((pastDaysOfYear + startOfYear.getDay()) / 7) + 1;
  } catch {
    return 0;
  }
};

function calculateTotalDistanceKm(logs: { lat: number; lng: number }[]): number {
  if (logs.length < 2) return 0;
  let totalKm = 0;
  for (let i = 1; i < logs.length; i++) {
    const lat1 = logs[i - 1].lat;
    const lon1 = logs[i - 1].lng;
    const lat2 = logs[i].lat;
    const lon2 = logs[i].lng;
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }
  return Math.round(totalKm * 10) / 10;
}

export default function ReportsView({ state }: { state: AppState }) {
  const [selectedRoute, setSelectedRoute] = useState<number | null>(
    state.routes.length > 0 ? state.routes[0].id : null
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Toda la semana');
  const [selectedWeek, setSelectedWeek] = useState<string>('Semana ' + getWeekNumber(new Date()));
  const [activeTab, setActiveTab] = useState<'map' | 'bitacora'>('map');
  const [eventFilter, setEventFilter] = useState<'all' | 'paradas' | 'anomalous' | 'evasions'>('all');

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Calculate available weeks from trackingLogs
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    const currentWeekNum = getWeekNumber(new Date());
    if (state.trackingLogs) {
      state.trackingLogs.forEach((l) => {
        weeks.add('Semana ' + getWeekNumber(l.timestamp));
      });
    } else {
      weeks.add('Semana ' + currentWeekNum);
    }
    const sorted = Array.from(weeks).sort((a, b) => parseInt(b.split(' ')[1]) - parseInt(a.split(' ')[1]));
    if (sorted.length === 0) sorted.push('Semana ' + currentWeekNum);
    return sorted;
  }, [state.trackingLogs]);

  // Filter logs by route, week and day
  const logs = useMemo(() => {
    return (
      state.trackingLogs?.filter((l) => {
        if (l.routeId !== selectedRoute) return false;

        // Week filter
        const logWeekStr = 'Semana ' + getWeekNumber(l.timestamp);
        if (selectedWeek !== logWeekStr) return false;

        if (selectedPeriod !== 'Toda la semana') {
          const logDay = days[new Date(l.timestamp).getDay()];
          if (logDay !== selectedPeriod) return false;
        }
        return true;
      }) || []
    );
  }, [state.trackingLogs, selectedRoute, selectedWeek, selectedPeriod]);

  // Filter visits by route and day
  const routeVisits = state.visits.filter((v) => v.routeId === selectedRoute);
  const periodVisits = routeVisits.filter(
    (v) => selectedPeriod === 'Toda la semana' || v.day === selectedPeriod
  );

  const completedVisits = periodVisits.filter((v) => v.status !== 'PENDIENTE');
  const compliancePct =
    periodVisits.length > 0 ? Math.round((completedVisits.length / periodVisits.length) * 100) : 0;

  // Anomalous stops (> 15 min) and evasions
  const anomalousStops = logs.filter((l) => l.type === 'parada' && l.duration && l.duration > 15 * 60);
  const evasions = logs.filter((l) => l.type === 'evasion');
  const normalStops = logs.filter((l) => l.type === 'parada' && (!l.duration || l.duration <= 15 * 60));

  // Adherence
  let adherence = compliancePct;
  if (anomalousStops.length > 0) {
    adherence = Math.max(0, adherence - anomalousStops.length * 5);
  }
  if (evasions.length > 0) {
    adherence = Math.max(0, adherence - evasions.length * 15);
  }

  // Calculate time in route
  let timeInRouteStr = '0h 0m';
  if (logs.length > 0) {
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const firstLog = new Date(sortedLogs[0].timestamp);
    const lastLog = new Date(sortedLogs[sortedLogs.length - 1].timestamp);

    if (selectedPeriod !== 'Toda la semana') {
      const diffMs = lastLog.getTime() - firstLog.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      timeInRouteStr = `${diffHrs}h ${diffMins}m`;
    } else {
      timeInRouteStr = 'Multi-día';
    }
  }

  const distanceKm = useMemo(() => calculateTotalDistanceKm(logs), [logs]);

  const exportToCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Fecha/Hora', 'Día', 'Tipo', 'Notas', 'Latitud', 'Longitud', 'Duracion(min)'];
    const rows = logs.map((l) =>
      [
        new Date(l.timestamp).toLocaleString(),
        days[new Date(l.timestamp).getDay()],
        l.type,
        '"' + (l.notes || '') + '"',
        l.lat,
        l.lng,
        l.duration ? Math.round(l.duration / 60) : 0,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_gps_${selectedRoute}_${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogsList = useMemo(() => {
    if (eventFilter === 'paradas') {
      return logs.filter((l) => l.type === 'parada' || (l.duration && l.duration > 0));
    }
    if (eventFilter === 'anomalous') {
      return logs.filter((l) => l.type === 'parada' && l.duration && l.duration > 15 * 60);
    }
    if (eventFilter === 'evasions') {
      return logs.filter((l) => l.type === 'evasion');
    }
    return logs;
  }, [logs, eventFilter]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto h-full flex flex-col font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Navigation className="w-6 h-6 text-blue-600" />
            Histórico GPS y KPIs de Ruta
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Visualiza el recorrido exacto en mapa, bitácora de paradas y tiempos del conductor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={exportToCSV}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-bold rounded-xl px-4 py-2 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" /> CSV
          </button>

          <select
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {availableWeeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          <select
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="Toda la semana">Toda la semana</option>
            <option value="Lunes">Lunes</option>
            <option value="Martes">Martes</option>
            <option value="Miércoles">Miércoles</option>
            <option value="Jueves">Jueves</option>
            <option value="Viernes">Viernes</option>
            <option value="Sábado">Sábado</option>
          </select>

          <select
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
            value={selectedRoute || ''}
            onChange={(e) => setSelectedRoute(Number(e.target.value))}
          >
            {state.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* KPIs Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-1">
            <span className="text-slate-500 font-semibold text-xs">Cumplimiento</span>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-bold text-slate-800">{compliancePct}%</span>
          <span className="text-[11px] text-slate-400">
            {completedVisits.length} de {periodVisits.length} visitas
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-1">
            <span className="text-slate-500 font-semibold text-xs">Apego a Ruta</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span
            className={`text-2xl font-bold ${
              adherence >= 80 ? 'text-emerald-600' : adherence >= 50 ? 'text-amber-500' : 'text-rose-500'
            }`}
          >
            {adherence}%
          </span>
          <span className="text-[11px] text-slate-400">Eficiencia calculada</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-1">
            <span className="text-slate-500 font-semibold text-xs">Tiempo en Ruta</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-xl font-bold text-slate-800">{timeInRouteStr}</span>
          <span className="text-[11px] text-slate-400">Duración jornada</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-1">
            <span className="text-slate-500 font-semibold text-xs">Recorrido GPS</span>
            <Activity className="w-4 h-4 text-cyan-500" />
          </div>
          <span className="text-2xl font-bold text-cyan-700">{distanceKm} km</span>
          <span className="text-[11px] text-slate-400">Distancia estimada</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-1">
            <span className="text-slate-500 font-semibold text-xs">Paradas &gt; 15m</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-amber-600">{anomalousStops.length}</span>
          <span className="text-[11px] text-slate-400">Paradas excesivas</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-1">
            <span className="text-slate-500 font-semibold text-xs">Evasiones</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-2xl font-bold text-red-600">{evasions.length}</span>
          <span className="text-[11px] text-slate-400">Alertas de desvío</span>
        </div>
      </div>

      {/* Tabs & Map / Log View */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                activeTab === 'map'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MapIcon className="w-4 h-4" /> Mapa de Trayectoria
            </button>
            <button
              onClick={() => setActiveTab('bitacora')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                activeTab === 'bitacora'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ListFilter className="w-4 h-4" /> Bitácora Detallada ({logs.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Filtrar Eventos:</span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="all">Todos los registros ({logs.length})</option>
              <option value="paradas">Solo Paradas ({normalStops.length + anomalousStops.length})</option>
              <option value="anomalous">⚠️ Paradas &gt; 15 min ({anomalousStops.length})</option>
              <option value="evasions">🚨 Evasiones ({evasions.length})</option>
            </select>
          </div>
        </div>

        {activeTab === 'map' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-600"></div> Inicio
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div> Parada Normal
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div> Parada &gt; 15m
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div> Evasión
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-600"></div> Posición Final
                </span>
              </div>
              <span className="text-slate-400 font-mono">
                {logs.length} puntos trazados
              </span>
            </div>
            <GPSHistoryMap logs={logs} selectedFilter={eventFilter} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-2">
            {filteredLogsList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Search className="w-10 h-10 mb-2 text-slate-200" />
                <p>No hay eventos que coincidan con los filtros seleccionados.</p>
              </div>
            ) : (
              (() => {
                const sortedLogs = [...filteredLogsList].sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                return sortedLogs.map((log) => {
                  const minutes = log.duration ? Math.round(log.duration / 60) : 0;
                  const isAnomalous = minutes > 15;
                  const isEvasion = log.type === 'evasion';
                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                        isEvasion
                          ? 'border-red-300 bg-red-50'
                          : isAnomalous
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                          isEvasion
                            ? 'bg-red-100 text-red-700'
                            : isAnomalous
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                          <h4
                            className={`font-bold text-sm ${
                              isEvasion
                                ? 'text-red-800'
                                : isAnomalous
                                ? 'text-amber-800'
                                : 'text-slate-800'
                            }`}
                          >
                            {log.notes || 'Registro de posición GPS'}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs">
                              {new Date(log.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          Coordenadas: {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                        </p>

                        {minutes > 0 && (
                          <p
                            className={`text-xs font-bold mt-1.5 ${
                              isEvasion
                                ? 'text-red-600'
                                : isAnomalous
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            Duración: {minutes} {minutes === 1 ? 'minuto' : 'minutos'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
}
