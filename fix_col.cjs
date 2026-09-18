const fs = require('fs');
let content = fs.readFileSync('server/algorithm.ts', 'utf8');

// Remove the console log
content = content.replace("  console.log('Top colonias sizes:', [...colonias].sort((a,b) => b.cost - a.cost).slice(0, 5).map(c=>c.cost));", "");

// Find the centroid update and remove it
content = content.replace(
  "              col.lat = (col.lat * (col.clients.length - 1) + c.lat) / col.clients.length;\n              col.lng = (col.lng * (col.clients.length - 1) + c.lng) / col.clients.length;",
  "              // NO actualizamos el centroide para evitar que el radio abarque toda la ciudad\n              // Limitamos el tamaño de cada colonia a un máximo para que no haya bloques gigantes inmanejables\n"
);

// Add size limit
content = content.replace(
  "          if (d <= radiusLimit) {",
  "          if (d <= radiusLimit && col.cost + c.cost <= 30) {" // Max 30 cost per colonia chunk
);

fs.writeFileSync('server/algorithm.ts', content);
console.log('Fixed colonias');
