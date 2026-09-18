const fs = require('fs');
let code = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

code = code.replace(/<div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">\n\s+<div className="flex justify-between items-start mb-2">\n\s+<span className="text-slate-500 font-medium text-sm">Paradas Anómalas<\/span>\n\s+<AlertCircle className="w-5 h-5 text-rose-500" \/>\n\s+<\/div>\n\s+<span className="text-3xl font-bold text-rose-600">\{anomalousStops\.length\}<\/span>\n\s+<span className="text-xs text-slate-400 mt-1">Detenciones &gt; 15 min<\/span>\n\s+<\/div>\n\s+<\/div>\n\s+<div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">\n\s+<div className="flex justify-between items-start mb-2">\n\s+<span className="text-slate-500 font-medium text-sm">Evasiones<\/span>\n\s+<AlertCircle className="w-5 h-5 text-red-600" \/>\n\s+<\/div>\n\s+<span className="text-3xl font-bold text-red-600">\{evasions\.length\}<\/span>\n\s+<span className="text-xs text-slate-400 mt-1">Intentos de evasión<\/span>\n\s+<\/div>\n\s+<\/div>/,
`<div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
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
      </div>`);

fs.writeFileSync('src/components/ReportsView.tsx', code);
