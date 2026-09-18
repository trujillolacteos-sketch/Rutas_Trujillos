const fs = require('fs');
const lines = fs.readFileSync('dist/server.cjs', 'utf8').split('\n');

let inside = false;
let content = `import { fetchClients, fetchRoutes, fetchRecentSales } from './odoo.ts';
export const DEPOT = { lat: 20.3831, lng: -99.9828 };

export async function generateMasterPlan(existingRoutes = [], clientOverrides = {}, disabledZones = [], existingVisits = [], zoneOverrides = {}) {
`;
let braces = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('async function generateMasterPlan')) {
    inside = true;
    braces = 1;
    continue;
  }
  
  if (inside) {
    content += line + '\n';
    if (line.includes('{')) braces += (line.match(/\{/g) || []).length;
    if (line.includes('}')) braces -= (line.match(/\}/g) || []).length;
    
    if (braces <= 0) break;
  }
}

fs.writeFileSync('server/algorithm.ts', content);
