const fs = require('fs');
let code = fs.readFileSync('src/components/PlannerView.tsx', 'utf8');

const regex = /\{filteredVisits\.length > 1 && \([\s\S]*?Optimizar Ruta[\s\S]*?<\/button>\n\s+\)\}/;
code = code.replace(regex, "");

fs.writeFileSync('src/components/PlannerView.tsx', code);
