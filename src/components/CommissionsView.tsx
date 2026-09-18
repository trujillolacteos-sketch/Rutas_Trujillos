import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from '../lib/api';
import {
  DollarSign,
  Users,
  Briefcase,
  RefreshCw,
  Calculator,
  Calendar,
  Map as MapIcon
} from "lucide-react";
import { AppState } from "../types";

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

export default function CommissionsView({ token, state }: { token: string; state: AppState }) {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  const currentWeekStr = "Semana " + getWeekNumber(new Date());
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStr);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const weeks = useMemo(() => {
    const w = new Set<string>();
    for (const c of commissions || []) {
      w.add(`Semana ${getWeekNumber(c.dateOrder)}`);
    }
    
    w.add(currentWeekStr);
    return Array.from(w).sort((a, b) => parseInt(b.split(" ")[1]) - parseInt(a.split(" ")[1]));
  }, [commissions]);



  const [baseSalaries, setBaseSalaries] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem("base_salaries");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    fetchCommissions();
  }, [token]);

  const fetchCommissions = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      const res = await apiFetch("/api/commissions", { headers });
      if (res.ok) {
        const data = await res.json();
        setCommissions(Array.isArray(data) ? data : []);
      } else {
        setCommissions([]);
        setErrorMsg(`Error ${res.status}: ${res.statusText}`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      await apiFetch("/api/commissions/sync", {
        method: "POST",
        headers,
      });
      await fetchCommissions();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    }
    setSyncing(false);
  };

  
  const handleLiquidate = async (id: number) => {
    try {
      const res = await apiFetch(`/api/commissions/${id}/liquidate`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (res.ok) {
        fetchCommissions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleClientType = async (id: number, clientId: number, currentType: string) => {
    try {
      const newType = currentType === "company" ? "person" : "company";
      setCommissions((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, clientType: newType } : c,
        ),
      );

      const res = await apiFetch(`/api/commissions/${id}/toggle-type`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ clientType: newType, clientId }),
      });
      if (res.ok) {
        fetchCommissions();
      }
    } catch (e) {
      console.error(e);
      fetchCommissions();
    }
  };

  const handleSalaryChange = (routeId: string, val: string) => {
    const num = parseFloat(val) || 0;
    const newSalaries = { ...baseSalaries, [routeId]: num };
    setBaseSalaries(newSalaries);
    localStorage.setItem("base_salaries", JSON.stringify(newSalaries));
  };

  const routeStats = useMemo(() => {
    const stats: Record<string, { total: number; ind: number; comp: number }> = {};
    
    // Initialize all authorized routes from state
    (state?.routes || []).forEach(r => {
      if (r.isAuthorized) {
        const routeName = r.name || `Ruta ${r.id}`;
        stats[routeName] = { total: 0, ind: 0, comp: 0 };
      }
    });

    for (const c of commissions || []) {
      const routeObj = (state?.routes || []).find(r => r.id === c.routeId);
      let rid = routeObj?.name || `Ruta ${c.routeId || "Sin Asignar"}`;
      
      // Keep it in stats if not there
      if (!stats[rid]) stats[rid] = { total: 0, ind: 0, comp: 0 };

      if (c.isLiquidated === false) continue;
      const week = `Semana ${getWeekNumber(c.dateOrder)}`;
      if (selectedWeek && selectedWeek !== "ALL" && week !== selectedWeek) continue;

      stats[rid].total += c.commissionAmount;
      if (c.clientType === "company") stats[rid].comp += c.commissionAmount;
      else stats[rid].ind += c.commissionAmount;
    }
    return stats;
  }, [commissions, selectedWeek, state?.routes]);

  const summary = useMemo(() => {
    let ind = 0;
    let comp = 0;
    let total = 0;
    for (const route in routeStats) {
      ind += routeStats[route].ind;
      comp += routeStats[route].comp;
      total += routeStats[route].total;
    }
    return { individual: ind, company: comp, total };
  }, [routeStats]);

  if (loading) return <div className="p-8">Cargando nóminas y comisiones...</div>;
  if (errorMsg) return <div className="p-8 text-red-500">Error al cargar: {errorMsg}. Por favor, recarga la página para refrescar tu sesión.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Nómina y Comisiones
          </h2>
          <p className="text-slate-500 mt-1">
            Calcula el pago final de tus repartidores según comisiones y ajustes de clientes.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-10 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="ALL">Todas las semanas</option>
              {weeks.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Odoo"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
               <Calculator className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-slate-500">Comisiones Totales</p>
               <p className="text-2xl font-black text-slate-800">${(summary.total).toFixed(2)}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
               <Briefcase className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-slate-500">De Empresas ({state.settings?.commissionRateCompany ?? 1.0}%)</p>
               <p className="text-xl font-black text-slate-800">${(summary.company).toFixed(2)}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
               <Users className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-slate-500">De Individuales ({state.settings?.commissionRatePerson ?? 2.0}%)</p>
               <p className="text-xl font-black text-slate-800">${(summary.individual).toFixed(2)}</p>
            </div>
         </div>
      </div>

      {/* TABS PARA RUTAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
           <button 
             onClick={() => setActiveTab('ALL')}
             className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'ALL' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
           >
             <MapIcon className="w-4 h-4" />
             Resumen General
           </button>
           {Object.keys(routeStats).map(route => (
             <button 
               key={route}
               onClick={() => setActiveTab(route)}
               className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors ${activeTab === route ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               {route}
             </button>
           ))}
        </div>

        <div className="p-6 bg-slate-50">
          {activeTab === 'ALL' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(routeStats).map(([route, stat]) => {
                const base = baseSalaries[route] || 0;
                const total = base + stat.total;
                return (
                  <div
                    key={route}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4 relative overflow-hidden"
                  >
                    <h3 className="font-bold text-lg text-slate-800">{route}</h3>

                    <div className="space-y-3 relative z-10">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">
                          Sueldo Base Semanal ($)
                        </label>
                        <input
                          type="number"
                          value={base || ""}
                          onChange={(e) => handleSalaryChange(route, e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-500">Total Comisiones:</span>
                        <span className="font-semibold text-emerald-600">
                          +${stat.total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center relative z-10">
                      <span className="font-bold text-slate-900">A Pagar al Repartidor:</span>
                      <span className="text-xl font-black text-emerald-600">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-3xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h3 className="text-xl font-bold text-slate-800 mb-6">Nómina de {activeTab}</h3>
               <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-slate-500 block mb-2">
                      Sueldo Base Semanal ($)
                    </label>
                    <input
                      type="number"
                      value={baseSalaries[activeTab] || ""}
                      onChange={(e) => handleSalaryChange(activeTab, e.target.value)}
                      placeholder="0.00"
                      className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                       <p className="text-xs font-bold text-sky-600 mb-1">Individuales ({state.settings?.commissionRatePerson ?? 2.0}%)</p>
                       <p className="text-lg font-black text-sky-700">${(routeStats[activeTab]?.ind || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                       <p className="text-xs font-bold text-indigo-600 mb-1">Empresas ({state.settings?.commissionRateCompany ?? 1.0}%)</p>
                       <p className="text-lg font-black text-indigo-700">${(routeStats[activeTab]?.comp || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                       <p className="text-xs font-bold text-emerald-600 mb-1">Total Comisiones</p>
                       <p className="text-lg font-black text-emerald-700">+${(routeStats[activeTab]?.total || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl shadow-inner">
                       <p className="text-xs font-bold text-slate-400 mb-1">Pago Total (Fin de Ruta)</p>
                       <p className="text-xl font-black text-white">${((baseSalaries[activeTab] || 0) + (routeStats[activeTab]?.total || 0)).toFixed(2)}</p>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Detalle de Tickets y Reglas de Clientes</h3>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            const grouped = (commissions || []).reduce((acc, c) => {
              const week = `Semana ${getWeekNumber(c.dateOrder)}`;
              if (selectedWeek && selectedWeek !== "ALL" && week !== selectedWeek && c.isLiquidated !== false) return acc;
              
              const routeObj = (state?.routes || []).find(r => r.id === c.routeId);
              const routeName = routeObj?.name || `Ruta ${c.routeId || "Sin Asignar"}`;
              if (activeTab !== "ALL" && routeName !== activeTab) return acc;

              if (!acc[week]) acc[week] = [];
              acc[week].push(c);
              return acc;
            }, {} as Record<string, any[]>);

            const sortedWeeks = Object.keys(grouped).sort(
              (a, b) => parseInt(b.split(" ")[1]) - parseInt(a.split(" ")[1]),
            );

            if (sortedWeeks.length === 0) {
              return (
                <div className="p-8 text-center text-slate-500 font-medium">
                  No hay comisiones registradas para {activeTab !== 'ALL' ? activeTab : 'este periodo'}.
                </div>
              );
            }

            return sortedWeeks.map((week) => (
              <div key={week} className="mb-6">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 uppercase tracking-wider text-xs flex justify-between items-center">
                  <span>{week}</span>
                  <span>{grouped[week].length} Tickets</span>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Ruta</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Tipo / Regla</th>
                      <th className="px-4 py-3 text-right">Monto Venta</th>
                      <th className="px-4 py-3 text-right">Comisión</th>
                      <th className="px-4 py-3 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {grouped[week].map((c) => {
                      const routeObj = (state?.routes || []).find(r => r.id === c.routeId);
                      const routeName = routeObj?.name || `Ruta ${c.routeId || "Sin Asignar"}`;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(c.dateOrder).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {c.orderName || "N/A"}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {routeName}
                          </td>
                          <td className="px-4 py-3 truncate max-w-[250px]" title={c.clientName}>
                            {c.clientName}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleClientType(c.id, c.clientId, c.clientType)}
                              className="hover:opacity-80 transition-opacity"
                              title="Click para cambiar regla de comisión"
                            >
                              {c.clientType === "company" ? (
                                <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs font-bold cursor-pointer">
                                  <Briefcase className="w-3 h-3" /> Empresa ({state.settings?.commissionRateCompany ?? 1.0}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sky-600 bg-sky-50 px-2 py-1 rounded-md text-xs font-bold cursor-pointer">
                                  <Users className="w-3 h-3" /> Individual ({state.settings?.commissionRatePerson ?? 2.0}%)
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">
                            ${c.orderTotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            ${c.commissionAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.isLiquidated === false ? (
                              <button
                                onClick={() => handleLiquidate(c.id)}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap"
                                title="Crédito pendiente. Click para liquidar y asignar a la semana actual."
                              >
                                Liquidar
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                Pagado
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
