const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const oldFallback = `    if(!lat || !lng) return fallback || "Sin Ubicación";`;

const newFallback = `
    if (fallback && fallback.toLowerCase().includes("san juan de l")) {
        fallback = "San Juan de los Lagos";
    }
    if(!lat || !lng) return fallback || "Sin Ubicación";
`;

code = code.replace(oldFallback, newFallback);

fs.writeFileSync('server/algorithm.ts', code);
