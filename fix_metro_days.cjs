const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const metroDays = Array\.from\(new Set\(metroClients\.map\(c => findClientMetropolitanZone\(c\.ciudad, config, c\.estado\)\?\.assignedDay\)\.filter\(Boolean\)\)\);/;

const replacement = `const metroDaysSet = new Set<string>();
      metroClients.forEach(c => {
        const zone = findClientMetropolitanZone(c.ciudad, config, c.estado);
        if (zone) {
          const targetVisits = Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));
          const days = getVisitDays(zone.assignedDay, targetVisits);
          days.forEach(d => metroDaysSet.add(d));
        }
      });
      const metroDays = Array.from(metroDaysSet);`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed metro days overlap.");
} else {
  console.log("Regex not found!");
}
