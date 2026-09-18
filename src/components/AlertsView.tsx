import React, { useState } from 'react';
import { AppState, ClientData } from '../types';
import { AlertTriangle, MapPinOff, Copy, AlertCircle, Search, CalendarCheck, X, History, MapPin, Store, TrendingUp, Clock } from 'lucide-react';

export default function AlertsView({ state, setState }: { state: AppState, setState: (state: AppState) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);

  // Frequent Visits (>1 visit per week)
  const frequentVisits = state.clients.filter(c => c.visitFrequency > 1);

  // Client Analysis Filtering
  const filteredClients = state.clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Anomalies: Routes > 100 visits
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const visitsPerRouteAndDay = new Map<string, number>();
  state.visits.forEach(v => {
    const key = `${v.routeId}-${v.day}`;
    visitsPerRouteAndDay.set(key, (visitsPerRouteAndDay.get(key) || 0) + 1);
  });
  
  const overloadedRoutes = Array.from(visitsPerRouteAndDay.entries())
    .filter(([_, count]) => count > 100)
    .map(([key, count]) => {
      const [routeIdStr, day] = key.split('-');
      const routeId = parseInt(routeIdStr, 10);
      const routeName = state.routes.find(r => r.id === routeId)?.name || `Ruta ${routeId}`;
      return { routeId, routeName, day, count, key };
    });

  const handleRedistribute = () => {
    const newVisits = [...state.visits];
    const maxVisitsPerDay = 100;
    const currentCounts = new Map<string, number>();
    
    newVisits.forEach(v => {
       const key = `${v.routeId}-${v.day}`;
       currentCounts.set(key, (currentCounts.get(key) || 0) + 1);
    });

    for (let i = 0; i < newVisits.length; i++) {
       const v = newVisits[i];
       const key = `${v.routeId}-${v.day}`;
       const count = currentCounts.get(key) || 0;
       
       if (count > maxVisitsPerDay) {
          const availableRoute = state.routes.find(r => {
             const rKey = `${r.id}-${v.day}`;
             return (currentCounts.get(rKey) || 0) < maxVisitsPerDay - 10;
          });
          
          if (availableRoute) {
             currentCounts.set(key, count - 1);
             const rKey = `${availableRoute.id}-${v.day}`;
             currentCounts.set(rKey, (currentCounts.get(rKey) || 0) + 1);
             
             newVisits[i] = {
               ...v,
               routeId: availableRoute.id,
               routeName: availableRoute.name
             };
          } else {
             const availableDay = DAYS.find(d => {
                const dKey = `${v.routeId}-${d}`;
                return (currentCounts.get(dKey) || 0) < maxVisitsPerDay - 10;
             });
             if (availableDay) {
                currentCounts.set(key, count - 1);
                const dKey = `${v.routeId}-${availableDay}`;
                currentCounts.set(dKey, (currentCounts.get(dKey) || 0) + 1);
                
                newVisits[i] = {
                  ...v,
                  day: availableDay
                };
             }
          }
       }
    }
    
    setState({
      ...state,
      visits: newVisits
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Centro de Inteligencia</h2>
        <p className="text-slate-500 text-sm mt-1">Análisis de actividad y rendimiento general de clientes</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">Múltiples Visitas</h3>
              <p className="text-xs text-slate-500 truncate">&gt;1 visita semanal</p>
            </div>
            <div className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-md shrink-0">
              {frequentVisits.length}
            </div>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '200px' }}>
            {frequentVisits.length === 0 ? (
              <p className="text-sm text-slate-400">Todo en orden.</p>
            ) : (
              frequentVisits.map(c => {
                const clientVisits = state.visits.filter(v => v.clientId === c.id);
                const completed = clientVisits.filter(v => v.status === 'SURTIDO' || v.status === 'VISITADO').length;
                return (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700 truncate mr-2" title={c.name}>{c.name}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{c.visitFrequency} visitas/sem</span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        {completed}/{clientVisits.length} cumplidas
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">Alta Rentabilidad</h3>
              <p className="text-xs text-slate-500 truncate">Top volumen</p>
            </div>
          </div>
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            En análisis...
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">Sobrecarga</h3>
              <p className="text-xs text-slate-500 truncate">&gt; 100 visitas/día</p>
            </div>
            {overloadedRoutes.length > 0 && (
              <div className="ml-auto bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-md shrink-0">
                {overloadedRoutes.length}
              </div>
            )}
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '200px' }}>
            {overloadedRoutes.length === 0 ? (
              <p className="text-sm text-slate-400">Sin anomalías detectadas.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {overloadedRoutes.map(r => (
                  <div key={r.key} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700 truncate mr-2">{r.routeName} - {r.day}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                        {r.count} visitas
                      </span>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={handleRedistribute}
                  className="w-full mt-2 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Redistribuir Visitas
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Analysis Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Directorio y Análisis General</h3>
            <p className="text-sm text-slate-500">Visualiza y filtra toda la cartera activa de Odoo ({state.clients.length} clientes)</p>
          </div>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o ciudad..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ciudad / Zona</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ventas (Histórico)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Visitas Semanales</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado de Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map(client => {
                const hasLocation = client.lat !== 0 && client.lng !== 0;
                return (
                  <tr 
                    key={client.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">{client.street}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {client.city}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900">${(client.salesVolume || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                      {client.visitFrequency}
                    </td>
                    <td className="px-6 py-4">
                      {hasLocation ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Registrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                          <AlertTriangle className="w-3 h-3" /> Faltante
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                    No se encontraron clientes con esos criterios de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Profile Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{selectedClient.name}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedClient.city}</span>
                  <span className="flex items-center gap-1"><Store className="w-4 h-4" /> Vol: ${selectedClient.salesVolume.toLocaleString()}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClient(null)}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-lg">Últimas 5 visitas (Histórico)</h3>
                </div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (i + 1) * 3); // Mocking past dates
                    const isSuccess = Math.random() > 0.3; // 70% success rate
                    const status = isSuccess ? 'SURTIDO' : 'FALLIDO';
                    const comments = isSuccess ? 'Entrega completada sin incidencias.' : 'Local cerrado al momento de la visita.';
                    
                    return (
                      <div key={`hist-${i}`} className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm gap-3">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          <p className="text-sm text-slate-500 mt-1">{comments}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg ${
                            status === 'SURTIDO' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-lg">Visitas Planificadas (Generadas)</h3>
              </div>
              
              <div className="space-y-3">
                {state.visits.filter(v => v.clientId === selectedClient.id).length === 0 ? (
                  <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl">No hay visitas planificadas para este cliente.</p>
                ) : (
                  state.visits
                    .filter(v => v.clientId === selectedClient.id)
                    .map((visit, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm gap-3">
                      <div>
                        <p className="font-bold text-slate-800">{visit.day}</p>
                        <p className="text-xs text-slate-500">Ruta: {visit.routeName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg ${
                          visit.status === 'SURTIDO' ? 'bg-emerald-100 text-emerald-700' :
                          visit.status === 'VISITADO' ? 'bg-blue-100 text-blue-700' :
                          visit.status === 'PENDIENTE' ? 'bg-slate-100 text-slate-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {visit.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

