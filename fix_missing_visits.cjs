const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const targetVisits = Math\.max\(1, Math\.min\(3, Math\.round\(client\.promedioDiasCompra \|\| 1\)\)\);/;

const replacement = `const isMetro = findClientMetropolitanZone(client.ciudad, config, client.estado) !== null;
        const targetVisits = isMetro ? Math.max(1, Math.min(3, Math.round(client.promedioDiasCompra || 1))) : 1;`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed missing clients visits.");
} else {
  console.log("Regex not found!");
}
