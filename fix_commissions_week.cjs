const fs = require('fs');
let code = fs.readFileSync('src/components/CommissionsView.tsx', 'utf8');

const getWeekFn = `
const getWeekNumber = (d: Date | string) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
};
`;

code = code.replace(
  "export default function CommissionsView({ token }: { token: string }) {",
  getWeekFn + "\nexport default function CommissionsView({ token }: { token: string }) {"
);

// We need to update routeStats to be per-route and maybe per-week? 
// Or just keep routeStats global, and group the table by week.
// The request says "en todo el historico y venta bloques por semana", probably grouping the table.
// Let's group the table by week.

const tableHeader = `
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-slate-800">Detalle de Tickets de Odoo</h3>
        </div>
`;

const newTableContent = `
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
`;

code = code.replace(
  /[\s\S]*<div className="p-5 border-b border-slate-100 flex justify-between items-center">[\s\S]*<h3 className="font-bold text-slate-800">Detalle de Tickets de Odoo<\/h3>[\s\S]*<\/div>[\s\S]*<div className="overflow-x-auto">[\s\S]*<table className="w-full text-sm text-left">[\s\S]*<\/table>[\s\S]*<\/div>/m,
  newTableContent
);

fs.writeFileSync('src/components/CommissionsView.tsx', code);
