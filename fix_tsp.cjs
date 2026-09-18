const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /function nearestNeighborTSP\(clients: Client\[\], startLat: number, startLng: number\) {[\s\S]*?\/\/ Weekly schedule planner/g;

const replacement = `function calculatePathDistance(path: Client[]): number {
  let dist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dLat = path[i].latitud - path[i+1].latitud;
    const dLng = path[i].longitud - path[i+1].longitud;
    dist += Math.sqrt(dLat * dLat + dLng * dLng);
  }
  return dist;
}

function nearestNeighborTSP(clients: Client[], startLat: number, startLng: number) {
  if (clients.length === 0) return [];
  if (clients.length <= 2) return [...clients];
  
  let bestRoute: Client[] = [];
  let bestDist = Infinity;

  // Try starting from every client to find the absolute shortest path connecting them all
  // This prevents the "start in the middle and zigzag" problem
  for (let startIdx = 0; startIdx < clients.length; startIdx++) {
    const unvisited = [...clients];
    const route: Client[] = [];
    
    // Start at this specific client
    const firstClient = unvisited.splice(startIdx, 1)[0];
    route.push(firstClient);
    let currentPos = { lat: firstClient.latitud, lng: firstClient.longitud };

    // Build initial route using Nearest Neighbor
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

    // Apply 2-Opt heuristic
    let improved = true;
    let iterations = 0;
    const maxIterations = 200; // Keeping 200 is fast enough for all N starts
    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      
      for (let i = 1; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const A = route[i - 1];
          const B = route[i];
          const C = route[k];
          const D = route[k + 1];

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
            const sectionToReverse = route.slice(i, k + 1).reverse();
            route.splice(i, k - i + 1, ...sectionToReverse);
            improved = true;
          }
        }
      }
    }
    
    // Evaluate total route distance
    const totalDist = calculatePathDistance(route);
    
    // Add distance from CEDIS to the first node to tie-break or prioritize closer starts
    const dLatCedis = startLat - route[0].latitud;
    const dLngCedis = startLng - route[0].longitud;
    const distFromCedis = Math.sqrt(dLatCedis * dLatCedis + dLngCedis * dLngCedis);
    
    const score = totalDist + (distFromCedis * 0.1); // Weight CEDIS distance lightly

    if (score < bestDist) {
      bestDist = score;
      bestRoute = [...route];
    }
  }

  // To make it even better, check if reversing the best route makes the start closer to CEDIS
  if (bestRoute.length > 1) {
    const firstNode = bestRoute[0];
    const lastNode = bestRoute[bestRoute.length - 1];
    
    const d1 = Math.pow(startLat - firstNode.latitud, 2) + Math.pow(startLng - firstNode.longitud, 2);
    const d2 = Math.pow(startLat - lastNode.latitud, 2) + Math.pow(startLng - lastNode.longitud, 2);
    
    if (d2 < d1) {
      bestRoute.reverse();
    }
  }

  return bestRoute;
}

// Weekly schedule planner`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Updated TSP to avoid middle-start zigzags!");
} else {
  console.log("Regex not found!");
}
