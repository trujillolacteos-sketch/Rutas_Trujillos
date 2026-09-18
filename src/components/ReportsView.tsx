import React, { useState } from 'react';
import { AppState } from '../types';
import { Clock, MapPin, Search, CheckCircle, Navigation, TrendingUp, AlertCircle } from 'lucide-react';


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

export default function ReportsView({ state }: { state: AppState }) {

  const [selectedRoute, setSelectedRoute] = useState<number | null>(state.routes.length > 0 ? state.routes[0].id : null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Toda la semana");
  const [selectedWeek, setSelectedWeek] = useState<string>("Semana " + getWeekNumber(new Date()));

  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  // Calculate available weeks from trackingLogs
    const availableWeeks = new Set<string>();
  const currentWeekNum = getWeekNumber(new Date());
  
  if (state.trackingLogs) {
    state.trackingLogs.forEach(l => {
        availableWeeks.add("Semana " + getWeekNumber(l.timestamp));
    });
  } else {
    availableWeeks.add("Semana " + currentWeekNum);
  }
  
  let weeksList = Array.from(availableWeeks).sort((a, b) => parseInt(b.split(" ")[1]) - parseInt(a.split(" ")[1]));
  if (weeksList.length === 0) weeksList.push("Semana " + currentWeekNum);

  // Filter logs by route, week and day
  const logs = state.trackingLogs?.filter(l => {
    if (l.routeId !== selectedRoute) return false;
    
    // Week filter
    const logWeekStr = "Semana " + getWeekNumber(l.timestamp);
    if (selectedWeek !== logWeekStr) return false;

    if (selectedPeriod !== "Toda la semana") {
      const logDay = days[new Date(l.timestamp).getDay()];
      if (logDay !== selectedPeriod) return false;
    }
    return true;
  }) || [];


  // Filter visits by route and day
  const routeVisits = state.visits.filter(v => v.routeId === selectedRoute);
  const periodVisits = routeVisits.filter(v => selectedPeriod === "Toda la semana" || v.day === selectedPeriod);

  const completedVisits = periodVisits.filter(v => v.status !== 'PENDIENTE');
  const compliancePct = periodVisits.length > 0 ? Math.round((completedVisits.length / periodVisits.length) * 100) : 0;

  // Calculate anomalous stops (> 15 min)
  const anomalousStops = logs.filter(l => l.type === 'parada' && l.duration && l.duration > 15 * 60);
  const evasions = logs.filter(l => l.type === 'evasion');

  // Apego a la ruta (Adherence)
  // Penalize by anomalous stops and non-compliance
  let adherence = compliancePct;
  if (anomalousStops.length > 0) {
    adherence = Math.max(0, adherence - (anomalousStops.length * 5));
  }
  if (evasions.length > 0) {
    adherence = Math.max(0, adherence - (evasions.length * 15));
  }

  // Calculate time in route
  let timeInRouteStr = "0h 0m";
  if (logs.length > 0) {
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const firstLog = new Date(sortedLogs[0].timestamp);
    const lastLog = new Date(sortedLogs[sortedLogs.length - 1].timestamp);
    
    // Si los logs abarcan múltiples días (ej. Toda la semana), el tiempo total en ruta es la suma de los tiempos diarios.
    // Para simplificar, si es "Toda la semana" mostramos un cálculo sumado, o el lapso total.
    if (selectedPeriod !== "Toda la semana") {
      const diffMs = lastLog.getTime() - firstLog.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      timeInRouteStr = `${diffHrs}h ${diffMins}m`;
    } else {
      // Suma de tiempo si es toda la semana (estimado a groso modo por las diferencias diarias)
      timeInRouteStr = "N/A (Seleccione un día)";
    }
  }

  const exportToCSV = () => {
    if (logs.length === 0) return;
    const headers = ["Fecha/Hora", "Día", "Tipo", "Notas", "Latitud", "Longitud", "Duracion(min)"];
    const rows = logs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      days[new Date(l.timestamp).getDay()],
      l.type,
      '"' + (l.notes || '') + '"',
      l.lat,
      l.lng,
      l.duration ? Math.round(l.duration / 60) : 0
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_gps_${selectedRoute}_${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reportes y KPIs de Ruta</h2>
          <p className="text-slate-500 text-sm mt-1">Evalúa el desempeño, cumplimiento y bitácora del rutero</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl px-4 py-2 transition-colors flex-1 md:flex-none">
            Descargar CSV
          </button>
          
                    <select 
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium flex-1 md:flex-none"
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
          >
            {weeksList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          <select 
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium flex-1 md:flex-none"
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
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
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium flex-1 md:flex-none"
            value={selectedRoute || ''}
            onChange={e => setSelectedRoute(Number(e.target.value))}
          >
            {state.routes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-medium text-sm">Cumplimiento</span>
            <CheckCircle className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-3xl font-bold text-slate-800">{compliancePct}%</span>
          <span className="text-xs text-slate-400 mt-1">{completedVisits.length} de {periodVisits.length} visitas</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-medium text-sm">Apego a Ruta</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <span className={`text-3xl font-bold ${adherence >= 80 ? 'text-emerald-600' : adherence >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
            {adherence}%
          </span>
          <span className="text-xs text-slate-400 mt-1">Estimado de adherencia</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-medium text-sm">Tiempo en Ruta</span>
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <span className="text-2xl font-bold text-slate-800">{timeInRouteStr}</span>
          <span className="text-xs text-slate-400 mt-1">Actividad detectada</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-medium text-sm">Paradas Anómalas</span>
            <AlertCircle className="w-5 h-5 text-rose-500" />
          </div>
          <span className="text-3xl font-bold text-rose-600">{anomalousStops.length}</span>
          <span className="text-xs text-slate-400 mt-1">Detenciones &gt; 15 min</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-medium text-sm">Evasiones</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-3xl font-bold text-red-600">{evasions.length}</span>
          <span className="text-xs text-slate-400 mt-1">Intentos de evasión</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex-1 flex flex-col min-h-0">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-slate-400" />
          Bitácora GPS ({logs.length} registros)
        </h3>
        
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Search className="w-12 h-12 mb-3 text-slate-200" />
              <p>No hay registros GPS para los filtros seleccionados.</p>
            </div>
          ) : (
            (() => {
              const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              const grouped = sortedLogs.reduce((acc, log) => {
                const week = `Semana ${getWeekNumber(log.timestamp)}`;
                if (!acc[week]) acc[week] = [];
                acc[week].push(log);
                return acc;
              }, {} as Record<string, any[]>);
              
              const sortedWeeks = Object.keys(grouped).sort((a, b) => parseInt(b.split(' ')[1]) - parseInt(a.split(' ')[1]));
              
              return sortedWeeks.map(week => (
                <div key={week} className="space-y-4">
                  <div className="sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-10">
                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {week}
                    </span>
                  </div>
                  {grouped[week].map(log => {
                    const minutes = log.duration ? Math.round(log.duration / 60) : 0;
                    const isAnomalous = minutes > 15;
                    const isEvasion = log.type === 'evasion';
                    return (
                      <div key={log.id} className={`p-4 rounded-2xl border flex items-start gap-4 ${isEvasion ? 'border-red-300 bg-red-50' : isAnomalous ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className={`p-2 rounded-lg mt-1 shrink-0 ${isEvasion ? 'bg-red-100 text-red-700' : isAnomalous ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <h4 className={`font-bold ${isEvasion ? 'text-red-800' : isAnomalous ? 'text-amber-800' : 'text-slate-800'}`}>
                              {log.notes || 'Registro de posición'}
                            </h4>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(log.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                            <MapPin className="w-4 h-4 shrink-0" />
                            Coord: {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                          </p>
                          
                          {minutes > 0 && (
                            <p className={`text-sm font-bold mt-2 ${isEvasion ? 'text-red-600' : isAnomalous ? 'text-amber-600' : 'text-slate-600'}`}>
                              Duración: {minutes} {minutes === 1 ? 'minuto' : 'minutos'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>
      </div>
    </div>
  );
}
