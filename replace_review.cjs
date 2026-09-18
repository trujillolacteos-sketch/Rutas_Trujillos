const fs = require('fs');
let code = fs.readFileSync('src/components/ReviewView.tsx', 'utf8');

// Replace activeFilter state
code = code.replace(
  `const [activeFilter, setActiveFilter] = useState<"all" | "duplicates" | "employees" | "no_seller" | "out_of_bounds" | "misspelled_city">("all");`,
  `const [activeFilter, setActiveFilter] = useState<"all" | "duplicates" | "employees" | "no_seller" | "out_of_bounds" | "isolated_no_sales">("all");`
);

// Move calcularDistancia out of the component or define it earlier
const distanceFn = `const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * cVal;
};
`;
if (!code.includes(distanceFn.split('\\n')[0])) {
   // Already moved or something
}

// Just insert a fast distance function inside the useMemo for flaggedClients if not there.
const oldFlaggedClients = `// Compile list of clients with any of the issues
  const flaggedClients = useMemo(() => {
    return userClients.map(c => {`;

const newFlaggedClients = `// Compile list of clients with any of the issues
  const flaggedClients = useMemo(() => {
    const activeClients = userClients.filter(c => c.activo);
    
    // Fast approx distance for filtering (not exact km, but good enough for relative checks if needed, but we'll use exact)
    const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; 
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return userClients.map(c => {
      // Find closest active client
      let minDist = Infinity;
      if (c.activo) {
        activeClients.forEach(ac => {
          if (ac.id !== c.id) {
            const d = getDist(c.latitud, c.longitud, ac.latitud, ac.longitud);
            if (d < minDist) minDist = d;
          }
        });
      }`;

code = code.replace(oldFlaggedClients, newFlaggedClients);

// Replace the anomalies definition
code = code.replace(
  `isMisspelledCity: c.ciudadOdoo !== undefined && c.ciudadOdoo !== c.ciudad,`,
  `isIsolatedNoSales: c.activo && c.ventaPromedio === 0 && minDist > 2,` // 2 km away, 0 sales
);

code = code.replace(
  `duplicateCount: duplicates.length + 1,`,
  `isolatedDistance: minDist === Infinity ? 0 : minDist,
        duplicateCount: duplicates.length + 1,`
);

code = code.replace(
  `const hasAnyAnomaly = anomalies.isDuplicate || anomalies.isEmployee || anomalies.isNoSeller || anomalies.isOutOfBounds || anomalies.isMisspelledCity;`,
  `const hasAnyAnomaly = anomalies.isDuplicate || anomalies.isEmployee || anomalies.isNoSeller || anomalies.isOutOfBounds || anomalies.isIsolatedNoSales;`
);

code = code.replace(
  `let misspelledCityCount = 0;`,
  `let isolatedNoSalesCount = 0;`
);

code = code.replace(
  `if (item.anomalies.isMisspelledCity) misspelledCityCount++;`,
  `if (item.anomalies.isIsolatedNoSales) isolatedNoSalesCount++;`
);

code = code.replace(
  `misspelledCityCount`,
  `isolatedNoSalesCount`
);

code = code.replace(
  `if (activeFilter === "misspelled_city" && !item.anomalies.isMisspelledCity) return false;`,
  `if (activeFilter === "isolated_no_sales" && !item.anomalies.isIsolatedNoSales) return false;`
);

// Replace UI card
const oldMisspelledCard = `{/* Misspelled City Card */}
        <button
          onClick={() => setActiveFilter("misspelled_city")}
          className={\`text-left p-4 rounded-2xl border transition-all cursor-pointer \${
            activeFilter === "misspelled_city"
              ? "bg-amber-600 text-white border-amber-600 shadow-md"
              : "bg-white text-slate-700 border-slate-100 hover:border-slate-200 shadow-xs"
          }\`}
        >
          <div className="flex justify-between items-center">
            <span className={\`text-[10px] font-bold uppercase tracking-wider \${activeFilter === "misspelled_city" ? "text-amber-100" : "text-slate-400"}\`}>
              Municipio Incorrecto / Odoo
            </span>
            <AlertTriangle className={\`w-4 h-4 \${activeFilter === "misspelled_city" ? "text-amber-100" : "text-amber-500"}\`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black">{metrics.misspelledCityCount}</span>
            <span className={\`text-[10px] font-medium \${activeFilter === "misspelled_city" ? "text-amber-100" : "text-slate-400"}\`}>A Corregir</span>
          </div>
        </button>`;

const newIsolatedCard = `{/* Isolated No Sales Card */}
        <button
          onClick={() => setActiveFilter("isolated_no_sales")}
          className={\`text-left p-4 rounded-2xl border transition-all cursor-pointer \${
            activeFilter === "isolated_no_sales"
              ? "bg-fuchsia-600 text-white border-fuchsia-600 shadow-md"
              : "bg-white text-slate-700 border-slate-100 hover:border-slate-200 shadow-xs"
          }\`}
        >
          <div className="flex justify-between items-center">
            <span className={\`text-[10px] font-bold uppercase tracking-wider \${activeFilter === "isolated_no_sales" ? "text-fuchsia-100" : "text-slate-400"}\`}>
              Retirados Sin Venta
            </span>
            <AlertTriangle className={\`w-4 h-4 \${activeFilter === "isolated_no_sales" ? "text-fuchsia-100" : "text-fuchsia-500"}\`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black">{metrics.isolatedNoSalesCount}</span>
            <span className={\`text-[10px] font-medium \${activeFilter === "isolated_no_sales" ? "text-fuchsia-100" : "text-slate-400"}\`}>A Revisar</span>
          </div>
        </button>`;

code = code.replace(oldMisspelledCard, newIsolatedCard);

// Replace UI labels
code = code.replace(
  `{activeFilter === "misspelled_city" && "✍️ Municipio con Errores en Odoo"}`,
  `{activeFilter === "isolated_no_sales" && "🧐 Clientes Distantes Sin Ventas"}`
);

// Replace Item details
const oldWarn = `{/* Misspelled City / Municipality Warn */}
                          {item.anomalies.isMisspelledCity && (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 leading-relaxed">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-extrabold text-amber-900">Nombre de Municipio no estándar o mal escrito en Odoo</p>
                                <p className="text-amber-700 mt-0.5 font-medium font-semibold">
                                  Registrado en Odoo como <strong className="underline font-black text-amber-900">"{c.ciudadOdoo}"</strong>, pero sus coordenadas corresponden a <strong className="underline font-black text-amber-900">"{c.ciudad}"</strong>.
                                </p>
                                <p className="text-[10px] text-amber-600 mt-1.5 italic font-semibold">
                                  La aplicación corrigió automáticamente la ruta y visualización. Para arreglarlo permanentemente, corrija el campo Municipio en Odoo ERP a: <strong className="bg-amber-100 px-1 py-0.5 rounded font-black text-amber-950">"{c.ciudad}"</strong>.
                                </p>
                              </div>
                            </div>
                          )}`;

const newWarn = `{/* Isolated No Sales Warn */}
                          {item.anomalies.isIsolatedNoSales && (
                            <div className="p-3 bg-fuchsia-50 border border-fuchsia-100 rounded-xl flex items-start gap-2.5 text-xs text-fuchsia-800 leading-relaxed">
                              <AlertTriangle className="w-4 h-4 text-fuchsia-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-extrabold text-fuchsia-900">Cliente distante sin historial de ventas</p>
                                <p className="text-fuchsia-700 mt-0.5 font-medium font-semibold">
                                  No ha registrado compras y se encuentra a <strong className="font-black text-fuchsia-900">{item.anomalies.isolatedDistance.toFixed(1)} km</strong> del cliente activo más cercano.
                                </p>
                                <p className="text-[10px] text-fuchsia-600 mt-1.5 italic font-semibold">
                                  Sugerencia: Revisar si la ubicación es correcta o si conviene dar de baja para no afectar las rutas.
                                </p>
                              </div>
                            </div>
                          )}`;

code = code.replace(oldWarn, newWarn);

// Remove the inline UI changes for misspelled city if needed, or leave them (they won't show if we changed the condition or we can just replace them)
const oldUI = `{c.ciudadOdoo && c.ciudadOdoo !== c.ciudad && (
                              <div className="flex justify-between border-b border-slate-100 pb-1 bg-amber-50/50 p-1 rounded">
                                <span className="text-amber-700 font-bold">Municipio Odoo:</span>
                                <span className="text-amber-900 font-black line-through">{c.ciudadOdoo}</span>
                              </div>
                            )}`;

const newUI = ``;

code = code.replace(oldUI, newUI);

fs.writeFileSync('src/components/ReviewView.tsx', code, 'utf8');
console.log("Replaced successfully");
