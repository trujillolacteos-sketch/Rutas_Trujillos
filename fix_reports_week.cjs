const fs = require('fs');
let code = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

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
  "export default function ReportsView({ state }: { state: AppState }) {",
  getWeekFn + "\nexport default function ReportsView({ state }: { state: AppState }) {"
);

// We need to replace the logs mapping
const logsRegex = /<div className="flex-1 overflow-y-auto pr-2 space-y-4">[\s\S]*?(?:<\/div>\s*<\/div>\s*<\/div>\s*\);)/m;

const newLogsContent = `
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
                const week = \`Semana \${getWeekNumber(log.timestamp)}\`;
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
                      <div key={log.id} className={\`p-4 rounded-2xl border flex items-start gap-4 \${isEvasion ? 'border-red-300 bg-red-50' : isAnomalous ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}\`}>
                        <div className={\`p-2 rounded-lg mt-1 shrink-0 \${isEvasion ? 'bg-red-100 text-red-700' : isAnomalous ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}\`}>
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <h4 className={\`font-bold \${isEvasion ? 'text-red-800' : isAnomalous ? 'text-amber-800' : 'text-slate-800'}\`}>
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
                            <p className={\`text-sm font-bold mt-2 \${isEvasion ? 'text-red-600' : isAnomalous ? 'text-amber-600' : 'text-slate-600'}\`}>
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
`;

code = code.replace(
  /<div className="flex-1 overflow-y-auto pr-2 space-y-4">[\s\S]*/m,
  newLogsContent
);

fs.writeFileSync('src/components/ReportsView.tsx', code);
