const fs = require('fs');

const code = `
import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, CheckCircle2, Circle, Users, Briefcase, RefreshCw, Calculator } from 'lucide-react';

const getWeekNumber = (d: Date | string) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
};

export default function CommissionsView({ token }: { token: string }) {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Base salary per route
  const [baseSalaries, setBaseSalaries] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('base_salaries');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (token) fetchCommissions();
  }, [token]);

  const fetchCommissions = async () => {
    try {
      const res = await fetch('/api/commissions', { headers: { Authorization: 'Bearer ' + token }});
      if (res.ok) {
        setCommissions(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/commissions/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + token }});
      await fetchCommissions();
    } catch(e) { console.error(e); }
    setSyncing(false);
  };

  const togglePaid = async (id: number, currentPaid: boolean) => {
    try {
      setCommissions(prev => prev.map(c => c.id === id ? { ...c, isPaid: !currentPaid } : c));
      await fetch(\`/api/commissions/\${id}/pay\`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token 
        },
        body: JSON.stringify({ isPaid: !currentPaid })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSalaryChange = (routeId: string, val: string) => {
    const num = parseFloat(val) || 0;
    const newSalaries = { ...baseSalaries, [routeId]: num };
    setBaseSalaries(newSalaries);
    localStorage.setItem('base_salaries', JSON.stringify(newSalaries));
  };

  const routeStats = useMemo(() => {
    const stats: Record<string, { pending: number, paid: number }> = {};
    for (const c of commissions) {
      const rid = \`Ruta \${c.routeId || 'Sin Asignar'}\`;
      if (!stats[rid]) stats[rid] = { pending: 0, paid: 0 };
      
      if (c.isPaid) {
        stats[rid].paid += c.commissionAmount;
      } else {
        stats[rid].pending += c.commissionAmount;
      }
    }
    return stats;
  }, [commissions]);

  if (loading) return <div className="p-8">Cargando nóminas y comisiones...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Nómina y Comisiones
          </h2>
          <p className="text-slate-500 mt-1">Calculadora de nómina base más comisiones desde Odoo.</p>
        </div>
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={\`w-4 h-4 \${syncing ? 'animate-spin' : ''}\`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Odoo'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(routeStats).map(([route, stat]) => {
          const base = baseSalaries[route] || 0;
          const total = base + stat.paid;
          return (
            <div key={route} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Calculator className="w-24 h-24" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">{route}</h3>
              
              <div className="space-y-3 relative z-10">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Salario Base ($)</label>
                  <input 
                    type="number" 
                    value={base || ''}
                    onChange={(e) => handleSalaryChange(route, e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Comisiones Pagadas:</span>
                  <span className="font-semibold text-emerald-600">+\${stat.paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Comisiones Pendientes:</span>
                  <span className="font-medium text-amber-500">\${stat.pending.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center relative z-10">
                <span className="font-bold text-slate-900">Total a Pagar:</span>
                <span className="text-xl font-black text-slate-900">\${total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
        {Object.keys(routeStats).length === 0 && (
          <div className="col-span-full bg-slate-50 p-8 rounded-2xl border border-slate-100 text-center text-slate-500">
            No hay datos de rutas disponibles. Sincroniza desde Odoo para ver los cálculos.
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-slate-800">Detalle de Tickets de Odoo</h3>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            const grouped = commissions.reduce((acc, c) => {
              const week = \`Semana \${getWeekNumber(c.dateOrder)}\`;
              if (!acc[week]) acc[week] = [];
              acc[week].push(c);
              return acc;
            }, {} as Record<string, any[]>);
            const sortedWeeks = Object.keys(grouped).sort((a, b) => parseInt(b.split(' ')[1]) - parseInt(a.split(' ')[1]));

            if (sortedWeeks.length === 0) {
               return <div className="p-8 text-center text-slate-500">No hay comisiones registradas.</div>;
            }

            return sortedWeeks.map(week => (
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
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3 text-right">Monto Ticket</th>
                      <th className="px-4 py-3 text-right">Comisión</th>
                      <th className="px-4 py-3 text-center">Pagado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {grouped[week].map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-500">{new Date(c.dateOrder).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{c.orderName || 'N/A'}</td>
                        <td className="px-4 py-3 font-medium">Ruta {c.routeId || 'Sin Asignar'}</td>
                        <td className="px-4 py-3 truncate max-w-[200px]" title={c.clientName}>{c.clientName}</td>
                        <td className="px-4 py-3">
                          {c.clientType === 'company' ? (
                            <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs font-medium"><Briefcase className="w-3 h-3"/> Empresa (1%)</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium"><Users className="w-3 h-3"/> Individual (2%)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">\${c.orderTotal.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">\${c.commissionAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => togglePaid(c.id, c.isPaid)} className="inline-flex items-center justify-center p-1 rounded-full hover:bg-slate-100 transition-colors" title={c.isPaid ? 'Desmarcar como pagado' : 'Marcar como pagado'}>
                            {c.isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300" />}
                          </button>
                        </td>
                      </tr>
                    ))}
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
`;

fs.writeFileSync('src/components/CommissionsView.tsx', code);
