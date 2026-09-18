const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const getClientVisits = (c) => `Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)))`;

let balancerBody = code.substring(code.indexOf('function balancearRutasAlgoritmo'), code.indexOf('function kMeansClustering'));

balancerBody = balancerBody.replace(
  `const targetSize = activeClients.length / routes.length;`,
  `const totalExpectedVisits = activeClients.reduce((sum, c) => sum + Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1))), 0);
  const targetSize = totalExpectedVisits / routes.length;`
);

balancerBody = balancerBody.replace(
  `routeCounts[rIdx]++;`,
  `routeCounts[rIdx] += Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));`
);

balancerBody = balancerBody.replace(
  `const avgLng = sumLng / groupClients.length;`,
  `const avgLng = sumLng / groupClients.length;
    const groupVisits = groupClients.reduce((sum, c) => sum + Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1))), 0);`
);

balancerBody = balancerBody.replace(
  `return { cityName, groupClients, avgLat, avgLng, customRoute, anchorDistances };`,
  `return { cityName, groupClients, avgLat, avgLng, customRoute, anchorDistances, groupVisits };`
);

// Replace `routeCounts[rIdx] += toTake.length;`
// Wait, we need to know what `toTake` is in the original code. Let's find out what's there.
