const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /function balancearRutasAlgoritmo\([\s\S]*?\/\/ 4\. Assign inactive clients \(prospects\)/;
const replacement = `function balancearRutasAlgoritmo(clients: Client[], config: SystemConfig): Client[] {
  const routes = ["Ruta 1", "Ruta 2", "Ruta 3", "Ruta 4"];
  const activeClients = clients.filter(c => c.activo);

  if (activeClients.length === 0) return clients;

  // Define 4 geographic anchor coordinates corresponding to our 4 main territories
  const anchors = [
    { name: "Ruta 1", lat: 20.6744, lng: -103.3872 },      // Guadalajara
    { name: "Ruta 2", lat: 21.8810, lng: -102.2960 },      // Aguascalientes
    { name: "Ruta 3", lat: 21.3538, lng: -101.9298 },      // Lagos de Moreno
    { name: "Ruta 4", lat: config.cedis.lat, lng: config.cedis.lng }   // Rancho La Estrella (CEDIS)
  ];

  // Helper to get number of visits
  const getVisits = (c: Client) => Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));

  // Calculate target capacity per route in terms of total expected visits
  const totalExpectedVisits = activeClients.reduce((sum, c) => sum + getVisits(c), 0);
  const targetSize = totalExpectedVisits / routes.length;

  // Flexibility percentage. E.g. 0.25 means a route can have up to 25% more than the average.
  const flexibility = config.flexibilidadRutas !== undefined ? config.flexibilidadRutas : 0.25;
  const maxCapacity = Math.ceil(targetSize * (1 + flexibility));

  const routeCounts = [0, 0, 0, 0];
  const assignedActive = new Set<string>();

  // 1. Force active metropolitan zone clients to their respective assigned route
  activeClients.forEach(c => {
    const zone = findClientMetropolitanZone(c.ciudad, config, c.estado);
    if (zone) {
      c.rutaActual = zone.assignedRoute;
      const rIdx = routes.indexOf(zone.assignedRoute);
      if (rIdx !== -1) {
        routeCounts[rIdx] += getVisits(c);
      }
      assignedActive.add(c.id);
    }
  });

  // 2. Group remaining active regional clients by normalized city (municipio) to avoid overlapping routes
  const nonMetroActive = activeClients.filter(c => !findClientMetropolitanZone(c.ciudad, config, c.estado));
  
  const cityGroups: { [key: string]: Client[] } = {};
  nonMetroActive.forEach(c => {
    const key = (c.ciudad || "Sin Ciudad").toLowerCase().trim().replace(/\\.$/, "").trim();
    if (!cityGroups[key]) {
      cityGroups[key] = [];
    }
    cityGroups[key].push(c);
  });

  // Calculate geometric centers and anchor distances for each city group
  const cityData = Object.entries(cityGroups).map(([cityName, groupClients]) => {
    const sumLat = groupClients.reduce((sum, c) => sum + c.latitud, 0);
    const sumLng = groupClients.reduce((sum, c) => sum + c.longitud, 0);
    const avgLat = sumLat / groupClients.length;
    const avgLng = sumLng / groupClients.length;
    
    const customRoute = findCustomRouteForCity(cityName, config);

    const dists = anchors.map((a, idx) => {
      const dLat = avgLat - a.lat;
      const dLng = avgLng - a.lng;
      let d = dLat * dLat + dLng * dLng;

      // If a custom route is configured for this city, give it high priority (negative distance)
      if (customRoute && a.name === customRoute) {
        d = -1.0;
      }
      return { routeIdx: idx, dist: d };
    });

    // Sort anchors by proximity or configuration priority
    dists.sort((a, b) => a.dist - b.dist);

    // Regret = second closest distance - closest distance
    const regret = dists[1].dist - dists[0].dist;
    const totalGroupVisits = groupClients.reduce((sum, c) => sum + getVisits(c), 0);

    return {
      cityName,
      clients: groupClients,
      dists,
      regret,
      count: totalGroupVisits
    };
  });

  // Sort cities by size descending to handle large municipalities (e.g. San Juan de los Lagos) first
  cityData.sort((a, b) => b.count - a.count);

  // 3. Assign each city block to its closest available route anchor
  cityData.forEach(city => {
    let clientsToAssign = [...city.clients];

    // Attempt to assign clients of this city to its preferred (closest) routes
    for (const anchorDist of city.dists) {
      if (clientsToAssign.length === 0) break;

      const rIdx = anchorDist.routeIdx;
      const routeName = routes[rIdx];
      const remainingCapacity = maxCapacity - routeCounts[rIdx];

      if (remainingCapacity > 0) {
        // Take as many clients as possible to fill the route up to maxCapacity (measuring by visits)
        let takenCount = 0;
        let takenVisits = 0;
        
        for (let i = 0; i < clientsToAssign.length; i++) {
          const clientVisits = getVisits(clientsToAssign[i]);
          if (takenVisits + clientVisits <= remainingCapacity || takenCount === 0) {
            takenCount++;
            takenVisits += clientVisits;
          } else {
            break;
          }
        }

        const toTake = clientsToAssign.slice(0, takenCount);
        toTake.forEach(c => {
          c.rutaActual = routeName;
          assignedActive.add(c.id);
        });
        
        routeCounts[rIdx] += takenVisits;
        clientsToAssign = clientsToAssign.slice(takenCount);
      }
    }

    // Fallback: if there are any leftover clients due to absolute capacity limits across all routes
    if (clientsToAssign.length > 0) {
      clientsToAssign.forEach(c => {
        let minRouteIdx = 0;
        let minCount = Infinity;

        routeCounts.forEach((cnt, idx) => {
          if (cnt < minCount) {
            minCount = cnt;
            minRouteIdx = idx;
          }
        });

        const routeName = routes[minRouteIdx];
        c.rutaActual = routeName;
        routeCounts[minRouteIdx] += getVisits(c);
        assignedActive.add(c.id);
      });
    }
  });

  // 4. Assign inactive clients (prospects)`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Successfully replaced balancearRutasAlgoritmo.");
} else {
  console.log("Regex not found!");
}
