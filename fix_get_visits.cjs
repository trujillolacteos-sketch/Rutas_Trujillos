const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex1 = /const getVisits = \(c: Client\) => Math\.max\(1, Math\.min\(3, Math\.round\(c\.promedioDiasCompra \|\| 1\)\)\);/;
const replace1 = `const getVisits = (c: Client) => {
    const isMetro = findClientMetropolitanZone(c.ciudad, config, c.estado) !== null;
    if (!isMetro) return 1; // Foreign clients get exactly 1 visit
    return Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));
  };`;

if (regex1.test(code)) {
  code = code.replace(regex1, replace1);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed getVisits in balancer.");
} else {
  console.log("Regex 1 not found!");
}
