import React, { useState, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { AppState } from '../types';
import { MapIcon, Search, Eye, EyeOff, Save, CheckCircle2, RefreshCw, FileSpreadsheet } from 'lucide-react';
import RouteAnalytics from './RouteAnalytics';

export default function ZonesView({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [restoringSheet, setRestoringSheet] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  // Extract unique cities (zones) from all clients
  const allZones = useMemo(() => {
    const zonesSet = new Set<string>();
    state.clients.forEach(c => {
      const city = c.city ? c.city.toLowerCase().trim() : "desconocida";
      if (city) zonesSet.add(city);
    });
    // Zonas clave aseguradas
    zonesSet.add("zona metropolitana ags");
    zonesSet.add("encarnación de díaz");
    return Array.from(zonesSet).sort();
  }, [state.clients]);

  const [disabledZones, setDisabledZones] = useState<Set<string>>(new Set(state.disabledZones || []));

  const filteredZones = useMemo(() => {
    if (!searchTerm) return allZones;
    return allZones.filter(z => z.includes(searchTerm.toLowerCase()));
  }, [allZones, searchTerm]);

  const toggleZone = (zone: string) => {
    setDisabledZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zone)) {
        newSet.delete(zone);
      } else {
        newSet.add(zone);
      }
      return newSet;
    });
  };

  const handleZoneOverrideChange = async (zone: string, field: string, value: any) => {
    setState(prev => {
      const zOverrides = { ...(prev.zoneOverrides || {}) };
      if (!zOverrides[zone]) zOverrides[zone] = {};
      
      if (value === "" || value === null || value === undefined) {
        delete zOverrides[zone][field];
      } else {
        zOverrides[zone][field] = field === 'assignedRouteId' ? parseInt(value, 10) : value;
      }
      return { ...prev, zoneOverrides: zOverrides };
    });

    try {
      const val = (value === "" || value === null || value === undefined) ? null : (field === 'assignedRouteId' ? parseInt(value, 10) : value);
      await apiFetch(`/api/settings/zone-overrides/${encodeURIComponent(zone)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val })
      });
    } catch(e) {
      console.error(e);
    }
  };

  const toggleZoneDay = async (zone: string, day: string) => {
    const currentOverride = state.zoneOverrides?.[zone] || {};
    const rawDays = Array.isArray(currentOverride.assignedDays) && currentOverride.assignedDays.length > 0
      ? currentOverride.assignedDays
      : (currentOverride.assignedDay ? [currentOverride.assignedDay] : []);

    let newDays: string[];
    if (rawDays.includes(day)) {
      newDays = rawDays.filter(d => d !== day);
    } else {
      newDays = [...rawDays, day];
    }

    const DAYS_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    newDays.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));

    const primaryDay = newDays.length > 0 ? newDays[0] : '';
    const frequency = newDays.length;

    setState(prev => {
      const zOverrides = { ...(prev.zoneOverrides || {}) };
      if (!zOverrides[zone]) zOverrides[zone] = {};
      if (newDays.length === 0) {
        delete zOverrides[zone].assignedDays;
        delete zOverrides[zone].assignedDay;
        delete zOverrides[zone].visitFrequency;
        delete zOverrides[zone].routePerDay;
      } else {
        zOverrides[zone].assignedDays = newDays;
        zOverrides[zone].assignedDay = primaryDay;
        zOverrides[zone].visitFrequency = frequency;
        if (zOverrides[zone].routePerDay) {
          const updatedRpd = { ...zOverrides[zone].routePerDay };
          Object.keys(updatedRpd).forEach(d => {
            if (!newDays.includes(d)) delete updatedRpd[d];
          });
          zOverrides[zone].routePerDay = Object.keys(updatedRpd).length > 0 ? updatedRpd : undefined;
        }
      }
      return { ...prev, zoneOverrides: zOverrides };
    });

    try {
      const currentRpd = { ...(currentOverride.routePerDay || {}) };
      Object.keys(currentRpd).forEach(d => {
        if (!newDays.includes(d)) delete currentRpd[d];
      });

      await apiFetch(`/api/settings/zone-overrides/${encodeURIComponent(zone)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedDays: newDays.length > 0 ? newDays : null,
          assignedDay: primaryDay || null,
          visitFrequency: frequency > 0 ? frequency : null,
          routePerDay: Object.keys(currentRpd).length > 0 ? currentRpd : null
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleZoneRoutePerDayChange = async (zone: string, day: string, routeIdStr: string) => {
    const routeId = routeIdStr === "" ? null : parseInt(routeIdStr, 10);

    setState(prev => {
      const zOverrides = { ...(prev.zoneOverrides || {}) };
      if (!zOverrides[zone]) zOverrides[zone] = {};
      const currentRpd = { ...(zOverrides[zone].routePerDay || {}) };

      if (routeId === null) {
        delete currentRpd[day];
      } else {
        currentRpd[day] = routeId;
      }

      if (Object.keys(currentRpd).length === 0) {
        delete zOverrides[zone].routePerDay;
      } else {
        zOverrides[zone].routePerDay = currentRpd;
      }
      return { ...prev, zoneOverrides: zOverrides };
    });

    try {
      const currentOverride = state.zoneOverrides?.[zone] || {};
      const currentRpd = { ...(currentOverride.routePerDay || {}) };
      if (routeId === null) {
        delete currentRpd[day];
      } else {
        currentRpd[day] = routeId;
      }

      await apiFetch(`/api/settings/zone-overrides/${encodeURIComponent(zone)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routePerDay: Object.keys(currentRpd).length > 0 ? currentRpd : null
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg("");
    try {
      const zonesArray = Array.from(disabledZones);
      const res = await apiFetch('/api/settings/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabledZones: zonesArray })
      });
      if (res.ok) {
        setState(prev => ({ ...prev, disabledZones: zonesArray }));
        setSuccessMsg("Zonas actualizadas y respaldadas en Google Sheets.");
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleRecalculateRoutes = async () => {
    setRecalculating(true);
    setSuccessMsg("");
    try {
      const res = await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routes: state.routes,
          clientOverrides: state.clientOverrides,
          zoneOverrides: state.zoneOverrides
        })
      });
      const data = await res.json();
      if (data.success && data.state) {
        setState(prev => ({ ...data.state, settings: prev.settings }));
        setSuccessMsg("¡Rutas recalculadas con éxito con tus zonas seleccionadas y respaldadas en Google Sheets!");
        setTimeout(() => setSuccessMsg(""), 8000);
      } else {
        alert("Error al recalcular rutas: " + (data.error || "Desconocido"));
      }
    } catch (err: any) {
      alert("Error de conexión al recalcular rutas: " + err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const handleExportSheet = async () => {
    setExportingSheet(true);
    try {
      const [resPlans, resZones] = await Promise.all([
        apiFetch('/api/routes/sync-sheet', { method: 'POST' }),
        apiFetch('/api/settings/zones/sync-sheet', { method: 'POST' })
      ]);
      const dataPlans = await resPlans.json();
      const dataZones = await resZones.json();
      if (dataPlans.success && dataZones.success) {
        setSuccessMsg(`¡${dataPlans.rowsCount} visitas guardadas en 'Planes_Rutas_Semanales' y ${dataZones.count} zonas en 'Predisposicion_Zonas' de Google Sheets!`);
        setTimeout(() => setSuccessMsg(""), 8000);
      } else {
        alert("Resultado: " + (dataPlans.error || dataZones.error || "Guardado completado"));
      }
    } catch (err: any) {
      alert("Error de conexión: " + err.message);
    } finally {
      setExportingSheet(false);
    }
  };

  const handleRestoreFromSheet = async () => {
    setRestoringSheet(true);
    try {
      const res = await apiFetch('/api/settings/zones/restore-sheet', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.zoneOverrides) {
        setState(prev => ({
          ...prev,
          zoneOverrides: data.zoneOverrides,
          disabledZones: data.disabledZones || prev.disabledZones
        }));
        if (data.disabledZones) {
          setDisabledZones(new Set(data.disabledZones));
        }
        setSuccessMsg("¡Predisposiciones de zonas restauradas exitosamente desde Google Sheets!");
        setTimeout(() => setSuccessMsg(""), 8000);
      } else {
        alert("No se pudieron cargar zonas: " + (data.error || ""));
      }
    } catch (err: any) {
      alert("Error restaurando de Sheets: " + err.message);
    } finally {
      setRestoringSheet(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8">
      
      {/* Nuevo módulo predictivo con Recharts */}
      <RouteAnalytics state={state} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 mt-12 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <MapIcon className="w-6 h-6 text-blue-600" />
            Gestión y Predisposición de Zonas
          </h2>
          <p className="text-slate-500 mt-1">Configura la ruta y selecciona uno o varios días de visita para cada zona (ej. Encarnación de Díaz 2 días por semana). Se respaldan automáticamente en Google Sheets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleRestoreFromSheet}
            disabled={restoringSheet}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors border border-slate-200 flex items-center gap-1.5 disabled:opacity-50"
            title="Recuperar la configuración de zonas guardada en la pestaña Predisposicion_Zonas de Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${restoringSheet ? 'animate-spin' : ''}`} />
            {restoringSheet ? 'Cargando...' : 'Restaurar de Sheets'}
          </button>
          <button 
            onClick={handleExportSheet}
            disabled={exportingSheet}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            title="Guardar planes de visitas y predisposición de zonas en Google Sheets"
          >
            <FileSpreadsheet className={`w-4 h-4 ${exportingSheet ? 'animate-bounce' : ''}`} />
            {exportingSheet ? 'Exportando...' : 'Exportar a Sheets'}
          </button>
          <button 
            onClick={handleRecalculateRoutes}
            disabled={recalculating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 hover:shadow-lg"
            title="Recalcula el plan de rutas aplicando de inmediato tus zonas asignadas"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Calculando...' : 'Calcular y Guardar Rutas'}
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Zonas'}
          </button>
        </div>
      </div>
      
      {successMsg && (
        <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-start gap-3 border border-emerald-100">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Buscar zona..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none"
            />
          </div>
        </div>
        
        <div className="p-0">
          {filteredZones.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No se encontraron zonas
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredZones.map(zone => {
                const isDisabled = disabledZones.has(zone);
                const count = state.clients.filter(c => (c.city || "desconocida").toLowerCase().trim() === zone).length;
                const zoneConfig = state.zoneOverrides?.[zone] || {};
                
                const selectedDays: string[] = Array.isArray(zoneConfig.assignedDays) && zoneConfig.assignedDays.length > 0
                  ? zoneConfig.assignedDays
                  : (zoneConfig.assignedDay ? [zoneConfig.assignedDay] : []);

                return (
                  <div key={zone} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-800 capitalize text-base">{zone}</h4>
                        {selectedDays.length > 1 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {selectedDays.length} días de visita
                          </span>
                        )}
                        {selectedDays.length === 1 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Fijo: {selectedDays[0]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{count} clientes en esta zona</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Si tiene 2 o más días seleccionados, permitir asignar una ruta por día */}
                      {selectedDays.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-xs font-bold text-slate-700">Ruta por día:</span>
                          {selectedDays.map(day => {
                            const assignedForDay = zoneConfig.routePerDay?.[day] || zoneConfig.assignedRouteId || "";
                            return (
                              <div key={day} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                <span className="text-xs font-bold text-indigo-700">{day}:</span>
                                <select
                                  value={assignedForDay}
                                  onChange={(e) => handleZoneRoutePerDayChange(zone, day, e.target.value)}
                                  className="text-xs bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                                >
                                  <option value="">⚡ Auto</option>
                                  {state.routes.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Ruta Selector estándar cuando tiene 1 día o ninguno */
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-slate-500">Ruta:</label>
                          <select
                            value={zoneConfig.assignedRouteId || ""}
                            onChange={(e) => handleZoneOverrideChange(zone, 'assignedRouteId', e.target.value)}
                            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[140px]"
                          >
                            <option value="">⚡ Automático</option>
                            {state.routes.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Day Pills (Selección Múltiple interactiva) */}
                      <div className="flex items-center gap-1">
                        <label className="text-xs font-semibold text-slate-500 mr-1">Días:</label>
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(day => {
                          const shortName = day.slice(0, 3);
                          const isSelected = selectedDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleZoneDay(zone, day)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                isSelected 
                                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600 hover:bg-blue-700' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                              title={`Alternar ${day} para ${zone}`}
                            >
                              {shortName}
                            </button>
                          );
                        })}
                      </div>

                      {/* Active/Inactive Toggle */}
                      <button
                        onClick={() => toggleZone(zone)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-w-[90px] ${
                          isDisabled 
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {isDisabled && <EyeOff className="w-3.5 h-3.5" />}
                        {!isDisabled && <Eye className="w-3.5 h-3.5" />}
                        <span>{isDisabled ? 'Inactiva' : 'Activa'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
