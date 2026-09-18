const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetRegex = /function nearestNeighborTSP[\s\S]*?return route;\n\}/;

const replaceContent = `function nearestNeighborTSP(clients: Client[], startLat: number, startLng: number) {
  if (clients.length === 0) return [];
  
  const unvisited = [...clients];
  const route: Client[] = [];
  let currentPos = { lat: startLat, lng: startLng };

  // 1. Build initial route using Nearest Neighbor
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    unvisited.forEach((c, idx) => {
      const dLat = c.latitud - currentPos.lat;
      const dLng = c.longitud - currentPos.lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });

    const nextClient = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextClient);
    currentPos = { lat: nextClient.latitud, lng: nextClient.longitud };
  }

  // 2. Apply 2-Opt heuristic to uncross the path and remove zig-zags
  // We keep the first element (closest to start point) fixed, and optimize the rest
  if (route.length > 3) {
    let improved = true;
    let iterations = 0;
    const maxIterations = 50;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      
      for (let i = 1; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const A = route[i - 1];
          const B = route[i];
          const C = route[k];
          const D = route[k + 1]; // Can be undefined if k is the last node

          const dLatAB = A.latitud - B.latitud;
          const dLngAB = A.longitud - B.longitud;
          const distAB = Math.sqrt(dLatAB * dLatAB + dLngAB * dLngAB);

          const dLatAC = A.latitud - C.latitud;
          const dLngAC = A.longitud - C.longitud;
          const distAC = Math.sqrt(dLatAC * dLatAC + dLngAC * dLngAC);

          let distCD = 0;
          let distBD = 0;
          if (D) {
            const dLatCD = C.latitud - D.latitud;
            const dLngCD = C.longitud - D.longitud;
            distCD = Math.sqrt(dLatCD * dLatCD + dLngCD * dLngCD);

            const dLatBD = B.latitud - D.latitud;
            const dLngBD = B.longitud - D.longitud;
            distBD = Math.sqrt(dLatBD * dLatBD + dLngBD * dLngBD);
          }

          if (distAC + distBD < distAB + distCD - 0.000001) {
            // Swap section
            const sectionToReverse = route.slice(i, k + 1).reverse();
            route.splice(i, k - i + 1, ...sectionToReverse);
            improved = true;
          }
        }
      }
    }
  }

  return route;
}`;

if (targetRegex.test(code)) {
  code = code.replace(targetRegex, replaceContent);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Successfully replaced nearestNeighborTSP.");
} else {
  console.log("Regex not found for TSP!");
}
