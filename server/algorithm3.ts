import { fetchClients, fetchRoutes, fetchRecentSales } from './odoo.ts';
export const DEPOT = { lat: 20.3831, lng: -99.9828 };
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];



function nearestNeighborTSP(clients, startLat, startLng) {
  if (clients.length === 0) return [];
  const unvisited = [...clients];
  const route = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const c = unvisited[i];
      let d = Math.sqrt(Math.pow(currentLat - c.lat, 2) + Math.pow(currentLng - c.lng, 2));
      
      if (d < minDistance) {
        minDistance = d;
        nearestIdx = i;
      }
    }
    const nextClient = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextClient);
    currentLat = nextClient.lat;
    currentLng = nextClient.lng;
  }
  
  // 2-opt optimization to remove crosses
  let improved = true;
  while (improved) {
      improved = false;
      for (let i = 1; i < route.length - 2; i++) {
          for (let j = i + 1; j < route.length - 1; j++) {
              const p1 = route[i-1];
              const p2 = route[i];
              const p3 = route[j];
              const p4 = route[j+1];
              
              const d1 = Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
              const d2 = Math.sqrt(Math.pow(p3.lat - p4.lat, 2) + Math.pow(p3.lng - p4.lng, 2));
              
              const d3 = Math.sqrt(Math.pow(p1.lat - p3.lat, 2) + Math.pow(p1.lng - p3.lng, 2));
              const d4 = Math.sqrt(Math.pow(p2.lat - p4.lat, 2) + Math.pow(p2.lng - p4.lng, 2));
              
              if (d3 + d4 < d1 + d2) {
                  const temp = [];
                  for (let k = j; k >= i; k--) {
                      temp.push(route[k]);
                  }
                  for (let k = i; k <= j; k++) {
                      route[k] = temp[k - i];
                  }
                  improved = true;
              }
          }
      }
  }

  return route;
}

export async function generateMasterPlan(existingRoutes = [], clientOverrides = {}, disabledZones = [], existingVisits = [], zoneOverrides = {}) {
  const logs = [];
  const addLog = (type, message) => {
    logs.push({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type,
      message
    });
  };
  addLog("info", "Iniciando sincronizaci\xF3n con Odoo...");
  const [rawClients, rawRoutes, rawSales] = await Promise.all([
    fetchClients(),
    fetchRoutes(),
    fetchRecentSales()
  ]);
  addLog("success", `Datos descargados: ${rawClients.length} clientes, ${rawRoutes.length} rutas, ${rawSales.length} ventas recientes.`);
  const routes = rawRoutes.map((r) => {
    const existing = existingRoutes.find((er) => er.id === r.id);
    return {
      id: r.id,
      name: r.name,
      isDelivery: existing ? existing.isDelivery !== void 0 ? existing.isDelivery : true : existingRoutes.length === 0 ? true : false,
      isAuthorized: existing ? existing.isAuthorized !== void 0 ? existing.isAuthorized : true : existingRoutes.length === 0 ? true : false
    };
  });
  const now = /* @__PURE__ */ new Date();
  const currentDay = now.getDay();
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const salesByClient = {};
  rawSales.forEach((s) => {
    if (s.partner_id && s.partner_id[0]) {
      const cId = s.partner_id[0];
      if (!salesByClient[cId]) salesByClient[cId] = { volume: 0, orderCount: 0, boughtThisWeek: false };
      salesByClient[cId].volume += s.amount_total;
      salesByClient[cId].orderCount += 1;
      const orderDate = new Date(s.date_order);
      if (orderDate >= startOfWeek) {
        salesByClient[cId].boughtThisWeek = true;
      }
    }
  });
  const KNOWN_CITIES = [
    { name: "Guadalajara", lat: 20.6596, lng: -103.3496 },
    { name: "Zona Metropolitana AGS", lat: 21.8852, lng: -102.2915 },
    // Aguascalientes
    { name: "San Juan de los Lagos", lat: 21.2447, lng: -102.333 },
    { name: "Encarnaci\xF3n de D\xEDaz", lat: 21.5269, lng: -102.2405 },
    { name: "Zona Metropolitana AGS", lat: 21.961, lng: -102.3438 },
    // Jesús María
    
    { name: "Zona Metropolitana AGS", lat: 21.8464, lng: -102.7186 },
    // Zacatecas
    { name: "Zacatecas", lat: 22.4285, lng: -102.2486 }, // Luis Moya
    { name: "Zacatecas", lat: 22.5699, lng: -102.2536 }, // Ojocaliente

    // Calvillo
    { name: "Zona Metropolitana AGS", lat: 22.2272, lng: -102.3161 },
    // Rincón de Romos
    { name: "Zona Metropolitana AGS", lat: 22.1462, lng: -102.2775 },
    // Pabellón de Arteaga
    { name: "Zona Metropolitana AGS", lat: 22.0747, lng: -102.2703 },
    // San Francisco de los Romo
    { name: "Zona Metropolitana AGS", lat: 22.1506, lng: -102.4158 },
    // San José de Gracia
    { name: "Zona Metropolitana AGS", lat: 22.2272, lng: -102.1794 },
    // Tepezalá
    { name: "Zona Metropolitana AGS", lat: 22.2383, lng: -102.0892 },
    // Asientos
    { name: "Zona Metropolitana AGS", lat: 22.3664, lng: -102.3 },
    // Cosío
    { name: "Zona Metropolitana AGS", lat: 21.9189, lng: -101.9658 },
    // El Llano
    { name: "San Miguel el Alto", lat: 21.0294, lng: -102.4042 },
    { name: "Jalostotitl\xE1n", lat: 21.1213, lng: -102.4658 },
    { name: "Lagos de Moreno", lat: 21.3551, lng: -101.9304 },
    { name: "Yahualica", lat: 21.1319, lng: -102.9017 },
    { name: "Tepatitl\xE1n", lat: 20.8066, lng: -102.7601 },
    { name: "Arandas", lat: 20.7047, lng: -102.3467 },
    { name: "Valle de Guadalupe", lat: 21.0867, lng: -102.5513 },
    { name: "Ojocaliente", lat: 22.648, lng: -102.2881 }
  ];
  function getCityFromCoords(lat, lng, fallback) {
    const agsMunis = ["aguascalientes", "asientos", "calvillo", "cos\xEDo", "cosio", "el llano", "jes\xFAs mar\xEDa", "jesus maria", "pabell\xF3n de arteaga", "pabellon de arteaga", "rinc\xF3n de romos", "rincon de romos", "san francisco de los romo", "san jos\xE9 de gracia", "san jose de gracia", "tepezal\xE1", "tepezala"];
    if (fallback && agsMunis.some((m) => fallback.toLowerCase().includes(m))) {
      return "Zona Metropolitana AGS";
    }
    if (fallback && fallback.toLowerCase().includes("san juan de l")) {
      fallback = "San Juan de los Lagos";
    }
    if (!lat || !lng) return fallback || "Sin Ubicaci\xF3n";
    let closest = null;
    let minD = Infinity;
    for (let c of KNOWN_CITIES) {
      let d = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2)) * 111;
      if (d < minD) {
        minD = d;
        closest = c;
      }
    }
    if (closest && minD < 25) {
      return closest.name;
    }
    return fallback || "Regi\xF3n Desconocida";
  }
  const DEPOT = { lat: 21.343263, lng: -102.264407 };
  const allClients = rawClients.map((c) => {
    const sales = salesByClient[c.id] || { volume: 0, orderCount: 0, boughtThisWeek: false };
    const lat = c.partner_latitude || 0;
    const lng = c.partner_longitude || 0;
    const distKm = Math.sqrt((lat - DEPOT.lat) ** 2 + (lng - DEPOT.lng) ** 2) * 111;
    const cityStr = getCityFromCoords(lat, lng, c.city);
    c.city = cityStr;
    const isForeign = distKm > 45 && !cityStr.includes("san juan");
    let freq = isForeign ? 1 : Math.min(Math.ceil(sales.orderCount / 14), 3);
    freq = Math.max(1, freq);
    const isCompany = c.company_type === "company" || c.is_company;
    const clientType = isCompany ? "company" : "person";
    let isActive = true;
    if (disabledZones.includes(cityStr.trim().toLowerCase())) {
      isActive = false;
    }
    if (clientOverrides[c.id] && clientOverrides[c.id].isActive !== void 0) {
      isActive = clientOverrides[c.id].isActive;
    }
    if (clientOverrides[c.id] && clientOverrides[c.id].visitFrequency !== void 0) {
      freq = clientOverrides[c.id].visitFrequency;
    }
    const normCity = cityStr.trim().toLowerCase();
    const zOverride = zoneOverrides[normCity] || {};
    const cOverride = clientOverrides[c.id] || {};
    const finalRouteId = cOverride.assignedRouteId !== void 0 ? cOverride.assignedRouteId : zOverride.assignedRouteId;
    const finalDay = cOverride.assignedDay !== void 0 ? cOverride.assignedDay : zOverride.assignedDay;
    return {
      id: c.id,
      isActive,
      assignedRouteId: finalRouteId,
      assignedDay: finalDay,
      name: c.name,
      lat,
      lng,
      city: c.city || "Desconocida",
      street: c.street || "",
      salesVolume: sales.volume,
      visitFrequency: freq,
      isForeign,
      distKm: distKm || 0,
      boughtThisWeek: sales.boughtThisWeek,
      clientType
    };
  });
  const validClients = allClients.filter((c) => c.lat !== 0 && c.lng !== 0 && c.isActive !== false);
  const invalidClients = allClients.filter((c) => (c.lat === 0 || c.lng === 0) && c.isActive !== false);
  if (invalidClients.length > 0) {
    addLog("warning", "'Se encontraron ' + invalidClients.length + ' clientes sin coordenadas. Se agrupar\xE1n al final.'");
  }
  const activeRoutes = routes.filter((r) => r.isDelivery && r.isAuthorized);
  const k = activeRoutes.length;
  if (k === 0 || validClients.length === 0) {
    addLog("error", "No hay rutas activas o clientes.");
    return { clients: allClients, visits: [], routes, logs };
  }
  // --- ALGORITMO DE AGRUPAMIENTO ESTRICTO POR COLONIAS ---
  validClients.forEach(c => {
      c.distKm = Math.sqrt((c.lat - DEPOT.lat)**2 + (c.lng - DEPOT.lng)**2) * 111;
      if (c.city === 'Zona Metropolitana AGS' || c.city === 'Guadalajara') c.tier = 1;
      else if (c.city.toLowerCase().includes('san juan')) c.tier = 3;
      else c.tier = 2;
      c.freq = Math.min(6, Math.max(1, c.visitFrequency));
      c.cost = c.freq; 
  });

  const totalCost = validClients.reduce((sum, c) => sum + c.cost, 0);
  const targetCost = totalCost / k;
  
  let routeAssignments = Array(k).fill(null).map(() => []);
  let routeCosts = Array(k).fill(0);

  // 1. Crear MicroZonas (Colonias) usando K-Means con radio máximo constraint
  let colonias = [];
  
  function constrainedKMeans(tierClients, maxRadius, tier) {
      if (tierClients.length === 0) return [];
      let centroids = [{lat: tierClients[0].lat, lng: tierClients[0].lng}];
      let assignments = new Array(tierClients.length).fill(0);
      
      let maxIters = tierClients.length + 50;
      while (maxIters-- > 0) {
          let maxDist = 0;
          let furthestClientIdx = -1;
          
          for (let i = 0; i < tierClients.length; i++) {
              let c = tierClients[i];
              let bestDist = Infinity;
              let bestC = 0;
              for (let j = 0; j < centroids.length; j++) {
                  let d = Math.sqrt((c.lat - centroids[j].lat)**2 + (c.lng - centroids[j].lng)**2) * 111;
                  if (d < bestDist) {
                      bestDist = d;
                      bestC = j;
                  }
              }
              assignments[i] = bestC;
              if (bestDist > maxDist) {
                  maxDist = bestDist;
                  furthestClientIdx = i;
              }
          }
          
          // Si el cliente más lejano supera el radio, agregamos un nuevo centroide en su posición
          if (maxDist > maxRadius && centroids.length < tierClients.length) {
              centroids.push({lat: tierClients[furthestClientIdx].lat, lng: tierClients[furthestClientIdx].lng});
              continue; // Re-asignar puntos
          }
          
          // Actualizar centroides
          let newCentroids = centroids.map(() => ({lat: 0, lng: 0, count: 0}));
          for (let i = 0; i < tierClients.length; i++) {
              let clusterIdx = assignments[i];
              newCentroids[clusterIdx].lat += tierClients[i].lat;
              newCentroids[clusterIdx].lng += tierClients[i].lng;
              newCentroids[clusterIdx].count++;
          }
          
          let shift = 0;
          for (let j = 0; j < centroids.length; j++) {
              if (newCentroids[j].count > 0) {
                  let nLat = newCentroids[j].lat / newCentroids[j].count;
                  let nLng = newCentroids[j].lng / newCentroids[j].count;
                  shift += Math.abs(centroids[j].lat - nLat) + Math.abs(centroids[j].lng - nLng);
                  centroids[j].lat = nLat;
                  centroids[j].lng = nLng;
              }
          }
          if (shift < 0.0001) break;
      }
                  
      let clusters = centroids.map(() => ({tier: tier, clients: [], cost: 0, lat: 0, lng: 0, isForeign: false}));
      for (let i = 0; i < tierClients.length; i++) {
          let clusterIdx = assignments[i];
          let c = tierClients[i];
          clusters[clusterIdx].clients.push(c);
          clusters[clusterIdx].cost += c.cost;
      }
      
      return clusters.filter(cl => cl.clients.length > 0).map(cl => {
          cl.lat = cl.clients.reduce((sum, c) => sum + c.lat, 0) / cl.clients.length;
          cl.lng = cl.clients.reduce((sum, c) => sum + c.lng, 0) / cl.clients.length;
          cl.isForeign = cl.clients[0].distKm > 10;
          return cl;
      });
  }

  [1, 2, 3].forEach(tier => {
      let tierClients = validClients.filter(c => c.tier === tier);
      let radiusLimit = tier === 1 ? 8 : (tier === 2 ? 4 : 0.35); // San Juan = 350m, Foraneo = 4km, Metro = 8km
      
      const byCity = {};
      tierClients.forEach(c => {
          byCity[c.city] = byCity[c.city] || [];
          byCity[c.city].push(c);
      });
      
                  Object.keys(byCity).forEach(city => {
          let cityClusters = constrainedKMeans(byCity[city], radiusLimit, tier);
                    cityClusters.forEach(cl => cl.city = city);
          colonias = colonias.concat(cityClusters);
      });
  });

  // 2. Ordenar TODAS las colonias juntas para un flujo geográfico continuo (evita cruzar municipios y saltos al depot)
  colonias.forEach(col => {
      col.lat = col.clients.reduce((sum, c) => sum + c.lat, 0) / col.clients.length;
      col.lng = col.clients.reduce((sum, c) => sum + c.lng, 0) / col.clients.length;
  });
  
  // Agrupar por macro-municipios para ordenar geográficamente, pero MANTENIENDO TODOS LOS CLUSTERS DEL MUNICIPIO JUNTOS
  let cityMap = {};
  colonias.forEach(col => {
      if (!cityMap[col.city]) {
          cityMap[col.city] = { city: col.city, colonias: [], lat: 0, lng: 0 };
      }
      cityMap[col.city].colonias.push(col);
  });
  
  let macroCities = Object.values(cityMap);
  macroCities.forEach(mc => {
      mc.lat = mc.colonias.reduce((sum, c) => sum + c.lat, 0) / mc.colonias.length;
      mc.lng = mc.colonias.reduce((sum, c) => sum + c.lng, 0) / mc.colonias.length;
  });
  
  
// macroCities = nearestNeighborTSP(macroCities, DEPOT.lat, DEPOT.lng);
console.log('TSP MacroCities:', macroCities.map(m => m.city));

  
  let newColonias = [];
  macroCities.forEach(mc => {
      newColonias = newColonias.concat(mc.colonias);
  });
  
  newColonias.forEach(col => {
      const y = Math.sin((col.lng - DEPOT.lng) * Math.PI/180) * Math.cos(col.lat * Math.PI/180);
      const x = Math.cos(DEPOT.lat * Math.PI/180) * Math.sin(col.lat * Math.PI/180) - Math.sin(DEPOT.lat * Math.PI/180) * Math.cos(col.lat * Math.PI/180) * Math.cos((col.lng - DEPOT.lng) * Math.PI/180);
      let brng = Math.atan2(y, x) * 180 / Math.PI;
      col.bearing = (brng + 360) % 360;
  });
  
  newColonias.sort((a, b) => a.bearing - b.bearing);

  colonias = newColonias;

  // 3. Asignar colonias a rutas equilibrando la carga de forma equitativa (Target Dinámico)
  let currentRIdx = 0;
  
  let unassignedColonias = [];
  colonias.forEach(col => {
      let pending = col.clients.filter(c => !c.assignedRouteId);
      if (pending.length > 0) {
          unassignedColonias.push({ clients: pending, cost: pending.reduce((sum, c) => sum + c.cost, 0), city: col.city });
      }
  });

  let remainingTotalCost = unassignedColonias.reduce((sum, col) => sum + col.cost, 0);
  let remainingRoutesCount = k;
  let dynamicTargetCost = remainingTotalCost / remainingRoutesCount;

  let cityBlocks = [];
  let currentBlock = null;
  unassignedColonias.forEach(col => {
      if (!currentBlock || currentBlock.city !== col.city) {
          if (currentBlock) cityBlocks.push(currentBlock); 
  console.log('CityBlocks generated:', cityBlocks.length);
          currentBlock = { city: col.city, colonias: [], cost: 0 };
      }
      currentBlock.colonias.push(col);
      currentBlock.cost += col.cost;
  });
  if (currentBlock) cityBlocks.push(currentBlock);

  cityBlocks.forEach(block => {
      const isMassive = block.cost > dynamicTargetCost * 0.7;
      
      if (isMassive) {
          block.colonias.forEach(col => {
              if (currentRIdx < k - 1 && routeCosts[currentRIdx] > 0) {
                  const shortfall = dynamicTargetCost - routeCosts[currentRIdx];
                  const excess = (routeCosts[currentRIdx] + col.cost) - dynamicTargetCost;
                  if (excess > shortfall) {
                                            remainingTotalCost -= routeCosts[currentRIdx];
                      remainingRoutesCount--;
                      dynamicTargetCost = remainingTotalCost / remainingRoutesCount;
                      currentRIdx++;
                  }
              }
              col.clients.forEach(c => {
                  c.assignedRouteId = activeRoutes[currentRIdx].id;
                  routeAssignments[currentRIdx].push(c);
                  routeCosts[currentRIdx] += c.cost;
              });
          });
      } else {
          if (currentRIdx < k - 1 && routeCosts[currentRIdx] > 0) {
              const shortfall = dynamicTargetCost - routeCosts[currentRIdx];
              const excess = (routeCosts[currentRIdx] + block.cost) - dynamicTargetCost;
              if (excess > shortfall) {
                  remainingTotalCost -= routeCosts[currentRIdx];
                  remainingRoutesCount--;
                  dynamicTargetCost = remainingTotalCost / remainingRoutesCount;
                  currentRIdx++;
              }
          }
          block.colonias.forEach(col => {
              col.clients.forEach(c => {
                  c.assignedRouteId = activeRoutes[currentRIdx].id;
                  routeAssignments[currentRIdx].push(c);
                  routeCosts[currentRIdx] += c.cost;
              });
          });
      }
  });

  let allVisits = [];
  routeAssignments.forEach((routeClients, rIdx) => {
    const route = activeRoutes[rIdx];
    if (routeClients.length === 0) return;

    const dailyVisits = Array(6).fill(null).map(() => []);
    const dayLoads = Array(6).fill(0);
    
    // Total load considering frequencies
    const totalRouteLoad = routeClients.reduce((sum, c) => sum + Math.min(6, Math.max(1, c.freq)), 0);
    const idealDayLoad = Math.ceil(totalRouteLoad / 6);

    // 1. "Cruza todos los clientes" - Trace a continuous geographic path through ALL clients of the route
    
    // 1. "Cruza todos los clientes" respetando Jerarquía Estricta
    // Primero agrupamos por Tier (1: Metro, 2: Foránea, 3: Local)
    // Luego por MicroZona (proximidad estricta) y finalmente TSP
    const clientsByTier = { 1: [], 2: [], 3: [] };
    routeClients.forEach(c => clientsByTier[c.tier || 3].push(c));
    
    let orderedClients = [];
    
    [1, 2, 3].forEach(tier => {
        const tierClients = clientsByTier[tier];
        if (tierClients.length === 0) return;
        
        // Agrupar en colonias/microzonas para no romper proximidad
        let microZones = [];
        tierClients.forEach(c => {
            let found = false;
            for (let mz of microZones) {
                const d = Math.sqrt((mz.lat - c.lat)**2 + (mz.lng - c.lng)**2) * 111;
                const radiusLimit = tier === 1 ? 8 : (tier === 2 ? 4 : 0.12); // 120 meters for local (roughly one block)
                if (d <= radiusLimit) {
                    mz.clients.push(c);
                    // Update centroid
                    mz.lat = mz.clients.reduce((s, c) => s + c.lat, 0) / mz.clients.length;
                    mz.lng = mz.clients.reduce((s, c) => s + c.lng, 0) / mz.clients.length;
                    found = true;
                    break;
                }
            }
            if (!found) {
                microZones.push({ clients: [c], lat: c.lat, lng: c.lng });
            }
        });
        
        // Agrupar microzonas por MUNICIPIO para evitar intercalarlos
        let mzByCity = {};
        microZones.forEach(mz => {
            let counts = {};
            mz.clients.forEach(c => { counts[c.city] = (counts[c.city] || 0) + 1 });
            mz.city = Object.keys(counts).reduce((a,b) => counts[a] > counts[b] ? a : b);
            mzByCity[mz.city] = mzByCity[mz.city] || [];
            mzByCity[mz.city].push(mz);
        });
        
        let macroMz = Object.keys(mzByCity).map(city => {
            let mzs = mzByCity[city];
            let lat = mzs.reduce((sum, mz) => sum + mz.lat, 0) / mzs.length;
            let lng = mzs.reduce((sum, mz) => sum + mz.lng, 0) / mzs.length;
            return { city, lat, lng, mzs };
        });
        
        macroMz = nearestNeighborTSP(macroMz, DEPOT.lat, DEPOT.lng);
        
        macroMz.forEach(mmz => {
            let orderedZones = nearestNeighborTSP(mmz.mzs, mmz.lat, mmz.lng);
            orderedZones.forEach(mz => {
                const mzOrderedClients = nearestNeighborTSP(mz.clients, mz.lat, mz.lng);
                orderedClients = orderedClients.concat(mzOrderedClients);
            });
        });
    });


    // 2. Frequency distribution patterns
    const patterns = {
        1: [[0], [1], [2], [3], [4], [5]],
        2: [[0,3], [1,4], [2,5]],
        3: [[0,2,4], [1,3,5]],
        4: [[0,1,3,4], [0,2,4,5], [1,2,3,5]], 
        5: [[0,1,2,3,4], [1,2,3,4,5], [0,2,3,4,5], [0,1,3,4,5], [0,1,2,4,5]],
        6: [[0,1,2,3,4,5]]
    };

    let lastDays = [];
    let dayCities = Array(6).fill(null).map(() => new Set());
    let cityCountsInRoute = {};
    orderedClients.forEach(c => { cityCountsInRoute[c.city] = (cityCountsInRoute[c.city] || 0) + 1 });

    orderedClients.forEach((c) => {
        const freq = Math.min(6, Math.max(1, c.freq));
        const availablePatterns = patterns[freq] || patterns[1];
        
        let bestPattern = availablePatterns[0];
        let bestScore = Infinity;

        for (let p of availablePatterns) {
            let overfill = 0;
            let continuityPenalty = 0;
            let balanceScore = 0;

            for (let d of p) {
                let projectedLoad = dayLoads[d] + 1;
                if (projectedLoad > idealDayLoad) {
                    overfill += (projectedLoad - idealDayLoad);
                }
                if (!lastDays.includes(d)) {
                    continuityPenalty += 1;
                }
                
                // Evitar mezclar municipios grandes en el mismo día
                if (dayCities[d].size > 0 && !dayCities[d].has(c.city)) {
                    let hasBigCity = false;
                    dayCities[d].forEach(city => {
                        if (cityCountsInRoute[city] >= 15) hasBigCity = true;
                    });
                    if (cityCountsInRoute[c.city] >= 15 || hasBigCity) {
                        continuityPenalty += 500; // Fuerte penalización para no mezclar si uno es grande
                    }
                }

                balanceScore += dayLoads[d];
            }

            const currentScore = (overfill * 10000) + (continuityPenalty * 100) + balanceScore;
            if (currentScore < bestScore) {
                bestScore = currentScore;
                bestPattern = p;
            }
        }

        lastDays = bestPattern;
        for (let d of bestPattern) {
            dayCities[d].add(c.city);
            dailyVisits[d].push(c);
            dayLoads[d]++;
        }
    });

    // 4. Trace the final route for each specific day
    dailyVisits.forEach((clientsInDay, dayIdx) => {
      if (clientsInDay.length === 0) return;
      const actualDay = DAYS[dayIdx];
      const orderedDay = nearestNeighborTSP(clientsInDay, DEPOT.lat, DEPOT.lng);
      
      orderedDay.forEach((c, vIdx) => {
        const existingV = existingVisits.find((ev) => ev.clientId === c.id && ev.day === actualDay);
        let finalStatus = "PENDIENTE";
        if (existingV && existingV.status && existingV.status !== "PENDIENTE") {
          finalStatus = existingV.status;
        } else if (c.boughtThisWeek) {
          finalStatus = "SURTIDO";
        }
        allVisits.push({
          id: existingV ? existingV.id : "v-" + c.id + "-" + actualDay + "-" + vIdx + "-" + Math.random().toString(36).substr(2, 4),
          clientId: c.id,
          clientName: c.name,
          lat: c.lat,
          lng: c.lng,
          routeId: route.id,
          routeName: route.name,
          day: actualDay,
          status: finalStatus
        });
      });
    });
  });

  if (invalidClients.length > 0) {
    addLog("warning", "Se excluyeron " + invalidClients.length + " clientes an\xF3malos (sin GPS) de las rutas.");
    const supRouteIdx = routes.findIndex((r) => r.id === 999999);
    if (supRouteIdx !== -1) {
      routes.splice(supRouteIdx, 1);
    }
  }
  addLog("success", "Planificador geogr\xE1fico y por esfuerzo generado. Total visitas: " + allVisits.length);
  return { clients: allClients, visits: allVisits, routes, logs };
}
