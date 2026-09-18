const fs = require('fs');
let code = fs.readFileSync('src/components/CommissionsView.tsx', 'utf8');

// 1. Add handleLiquidate
if (!code.includes('handleLiquidate')) {
  const handler = `
  const handleLiquidate = async (id: number) => {
    try {
      const res = await apiFetch(\`/api/commissions/\$\{id\}/liquidate\`, {
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

  const toggleClientType = `;
  code = code.replace(/const toggleClientType = /, handler);
}

// 2. Change routeStats
const routeStatsRegex = /const week = \`Semana \$\{getWeekNumber\(c\.dateOrder\)\}\`;/;
code = code.replace(routeStatsRegex, `if (c.isLiquidated === false) continue;
      const week = \`Semana \$\{getWeekNumber(c.dateOrder)}\`;`);

// 3. Update the table headers
code = code.replace(
  /<th className="px-4 py-3 text-right">Comisión<\/th>/,
  '<th className="px-4 py-3 text-right">Comisión</th>\n                      <th className="px-4 py-3 text-right">Estado</th>'
);

// 4. Update the table row
code = code.replace(
  /<td className="px-4 py-3 text-right font-bold text-emerald-600">\s*\$\{c\.commissionAmount\.toFixed\(2\)\}\s*<\/td>/,
  `<td className="px-4 py-3 text-right font-bold text-emerald-600">
                            \${c.commissionAmount.toFixed(2)}
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
                          </td>`
);

fs.writeFileSync('src/components/CommissionsView.tsx', code);
console.log('Patched CommissionsView');
