import React, { useState, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { AppState } from '../types';
import { MapIcon, Search, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import RouteAnalytics from './RouteAnalytics';

export default function ZonesView({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  // Extract unique cities (zones) from all clients
  const allZones = useMemo(() => {
    const zonesSet = new Set<string>();
    state.clients.forEach(c => {
      const city = c.city ? c.city.toLowerCase().trim() : "desconocida";
      if (city) zonesSet.add(city);
    });
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


  const handleZoneOverrideChange = async (zone, field, value) => {
    // Optimistic UI update
    setState(prev => {
      const zOverrides = { ...(prev.zoneOverrides || {}) };
      if (!zOverrides[zone]) zOverrides[zone] = {};
      
      if (value === "") {
        delete zOverrides[zone][field];
      } else {
        zOverrides[zone][field] = field === 'assignedRouteId' ? parseInt(value) : value;
      }
      return { ...prev, zoneOverrides: zOverrides };
    });

    try {
      const val = value === "" ? undefined : (field === 'assignedRouteId' ? parseInt(value) : value);
      await apiFetch(`/api/settings/zone-overrides/${encodeURIComponent(zone)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val })
      });
    } catch(e) {
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
        setSuccessMsg("Zonas actualizadas. Recuerda sincronizar para aplicar los cambios.");
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8">
      
      {/* Nuevo módulo predictivo con Recharts */}
      <RouteAnalytics state={state} />

      <div className="flex items-center justify-between mb-4 mt-12">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <MapIcon className="w-6 h-6 text-blue-600" />
            Gestión de Zonas (Ciudades)
          </h2>
          <p className="text-slate-500 mt-1">Activa o desactiva zonas para incluirlas o excluirlas de la próxima sincronización del planificador.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
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
                return (
                  <div key={zone} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 capitalize">{zone}</h4>
                      <p className="text-xs text-slate-500">{count} clientes en esta zona</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500">Ruta:</label>
                        <select
                          value={state.zoneOverrides?.[zone]?.assignedRouteId || ""}
                          onChange={(e) => handleZoneOverrideChange(zone, 'assignedRouteId', e.target.value)}
                          className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[140px]"
                        >
                          <option value="">Cualquiera</option>
                          {state.routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500">Día:</label>
                        <select
                          value={state.zoneOverrides?.[zone]?.assignedDay || ""}
                          onChange={(e) => handleZoneOverrideChange(zone, 'assignedDay', e.target.value)}
                          className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Cualquiera</option>
                          <option value="Lunes">Lunes</option>
                          <option value="Martes">Martes</option>
                          <option value="Miércoles">Miércoles</option>
                          <option value="Jueves">Jueves</option>
                          <option value="Viernes">Viernes</option>
                          <option value="Sábado">Sábado</option>
                        </select>
                      </div>

                      <button
                        onClick={() => toggleZone(zone)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors min-w-[100px] ${
                          isDisabled 
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {isDisabled && <EyeOff className="w-3 h-3" />}
                        {!isDisabled && <Eye className="w-3 h-3" />}
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
