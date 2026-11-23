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
    { name: "Arandas", lat: 20.605, lng: -102.22 }, // Jesús María, Jalisco (región Arandas / Altos Sur)
    { name: "Valle de Guadalupe", lat: 21.0867, lng: -102.5513 },
    { name: "Ojocaliente", lat: 22.648, lng: -102.2881 }
  ];
  function getCityFromCoords(lat: number, lng: number, fallback?: string) {
    const agsMunis = ["aguascalientes", "asientos", "calvillo", "cosío", "cosio", "el llano", "pabellón de arteaga", "pabellon de arteaga", "rincón de romos", "rincon de romos", "san francisco de los romo", "san josé de gracia", "san jose de gracia", "tepezalá", "tepezala"];

    // 1. Las coordenadas GPS mandan de forma estricta:
    if (lat && lng) {
      // Región Jesús María / Arandas, Jalisco (al sur de San Juan de los Lagos, Latitud < 21.0)
      if (lat >= 20.4 && lat <= 20.98 && lng >= -102.6 && lng <= -102.0) {
        return "Arandas";
      }

      // Región Aguascalientes Metropolitana (estrictamente al norte, Latitud >= 21.75)
      if (lat >= 21.75 && lat <= 22.4 && lng >= -102.5 && lng <= -102.0) {
        return "Zona Metropolitana AGS";
      }

      let closest = null;
      let minD = Infinity;
      for (let c of KNOWN_CITIES) {
        let d = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2)) * 111;
        if (d < minD) {
          minD = d;
          closest = c;
        }
      }
      if (closest && minD < 30) {
        // Blindaje: Nunca clasificar como AGS si está al sur de San Juan (lat < 21.4)
        if (closest.name === "Zona Metropolitana AGS" && lat < 21.4) {
          return "Arandas";
        }
        return closest.name;
      }

      // Región Zacatecas por coordenadas (norte de Aguascalientes)
      if (lat >= 22.4 && lat <= 25.0 && lng >= -104.5 && lng <= -100.5) {
        return "Zacatecas";
      }
    }

    // 2. Fallback de texto si no hay GPS preciso:
    if (fallback) {
      const fbLow = fallback.toLowerCase();
      // Distinguir Jesús María, Jalisco vs Jesús María, Aguascalientes
      if (fbLow.includes("jesus maria") || fbLow.includes("jesús maría")) {
        if (lat && lat < 21.4) return "Arandas";
        if (fbLow.includes("jal") || fbLow.includes("jalisco")) return "Arandas";
        if (fbLow.includes("ags") || fbLow.includes("aguascalientes")) return "Zona Metropolitana AGS";
        // Por proximidad al centro de operaciones en Jalisco, asumir Jalisco si no especifica AGS
        return "Arandas";
      }
      if (agsMunis.some((m) => fbLow.includes(m))) {
        if (!lat || lat >= 21.5) return "Zona Metropolitana AGS";
      }
      if (fbLow.includes("san juan de l")) return "San Juan de los Lagos";
      if (fbLow.includes("tepatitlan") || fbLow.includes("tepatitlán")) return "Tepatitlán";
      if (fbLow.includes("cuquio")) return "Cuquio";
      if (fbLow.includes("jalos")) return "Jalostotitlán";
      if (fbLow.includes("san miguel")) return "San Miguel el Alto";
      if (fbLow.includes("valle de g")) return "Valle de Guadalupe";
      if (fbLow.includes("arandas")) return "Arandas";
      if (fbLow.includes("yahualica")) return "Yahualica";
      if (fbLow.includes("lagos de")) return "Lagos de Moreno";
      if (fbLow.includes("encarnaci") || fbLow.includes("chona")) return "Encarnación de Díaz";
    }
    return fallback || "Sin Ubicación";
  }
  const DEPOT = { lat: 21.343263, lng: -102.264407 };
  const safeDisabled = new Set(Array.isArray(disabledZones) ? disabledZones.map((z: any) => String(z).toLowerCase().trim()) : []);
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
    if (safeDisabled.has(cityStr.trim().toLowerCase())) {
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
    const permanentRouteId = cOverride.permanentRouteId !== void 0 ? cOverride.permanentRouteId : (c.permanentRouteId || undefined);
    const permanentDay = cOverride.permanentDay !== void 0 ? cOverride.permanentDay : (c.permanentDay || undefined);
    const finalRouteId = permanentRouteId !== void 0 ? permanentRouteId : (cOverride.assignedRouteId !== void 0 ? cOverride.assignedRouteId : zOverride.assignedRouteId);
    const finalDay = permanentDay !== void 0 ? permanentDay : (cOverride.assignedDay !== void 0 ? cOverride.assignedDay : zOverride.assignedDay);
    return {
      id: c.id,
      isActive,
      assignedRouteId: finalRouteId,
      permanentRouteId: permanentRouteId,
      assignedDay: finalDay,
      permanentDay: permanentDay,
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
  // --- ALGORITMO DE MICROZONAS Y CORREDORES ESTRICTOS (UN SOLO MUNICIPIO AL DÍA) ---
  const SJ_CENTER = { lat: 21.25113, lng: -102.32519 };

  function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
    const y = Math.sin((lng2 - lng1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lng2 - lng1) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // Normalización para comparación de zonas independiente de acentos o mayúsculas
  function normalizeZoneKey(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function getZoneOverride(zoneOverridesObj: Record<string, any>, cityName: string) {
    if (!zoneOverridesObj || !cityName) return {};
    if (zoneOverridesObj[cityName]) return zoneOverridesObj[cityName];
    const lower = cityName.toLowerCase().trim();
    if (zoneOverridesObj[lower]) return zoneOverridesObj[lower];
    const normalized = normalizeZoneKey(cityName);
    for (const [k, v] of Object.entries(zoneOverridesObj)) {
      if (normalizeZoneKey(k) === normalized) {
        return v;
      }
    }
    return {};
  }

  // Mapeo canónico de municipios foráneos a su corredor geográfico natural
  // Ruta 1: Norte (Aguascalientes y Encarnación de Díaz / La Chona)
  // Ruta 2: Sur / Altos (Arandas, Jalostotitlán, Valle de Guadalupe, San Miguel, Tepatitlán)
  // Ruta 3: Oeste (Yahualica y Cuquio)
  // Ruta 4: Este (Lagos de Moreno)
  const CITY_CORRIDORS: Record<string, { targetName: string; corridor: string; preferredDay?: string }> = {
    'zona metropolitana ags': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'zona metropolitana aguascalientes': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'aguascalientes': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'ags': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'jesus maria ags': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'jesús maría ags': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'san francisco de los romo': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'encarnación de díaz': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'encarnacion de diaz': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'encarnacion': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'la chona': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'chona': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'el bajío': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'el bajio': { targetName: 'Ruta 1', corridor: 'NORTE' },
    'zacatecas': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'ojocaliente': { targetName: 'Ruta 1', corridor: 'NORTE', preferredDay: 'Lunes' },
    'arandas': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Miércoles' },
    'jesús maría': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Miércoles' },
    'jesus maria': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Miércoles' },
    'manuel doblado': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Miércoles' },
    'jalostotitlán': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Martes' },
    'jalostotitlan': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Martes' },
    'san miguel el alto': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Martes' },
    'valle de guadalupe': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Martes' },
    'tepatitlán': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Martes' },
    'tepatitlan': { targetName: 'Ruta 2', corridor: 'SUR', preferredDay: 'Martes' },
    'yahualica': { targetName: 'Ruta 3', corridor: 'OESTE', preferredDay: 'Lunes' },
    'cuquio': { targetName: 'Ruta 3', corridor: 'OESTE', preferredDay: 'Lunes' },
    'lagos de moreno': { targetName: 'Ruta 4', corridor: 'ESTE', preferredDay: 'Jueves' }
  };

  function getCorridorInfo(cityName: string) {
    if (!cityName) return null;
    const lower = cityName.toLowerCase().trim();
    if (CITY_CORRIDORS[lower]) return CITY_CORRIDORS[lower];
    const normalized = normalizeZoneKey(cityName);
    if (CITY_CORRIDORS[normalized]) return CITY_CORRIDORS[normalized];
    for (const [k, v] of Object.entries(CITY_CORRIDORS)) {
      if (normalizeZoneKey(k) === normalized) {
        return v;
      }
    }
    return null;
  }

  // Mapear rutas activas por nombre y por índice
  const activeRouteMap: Record<string, any> = {};
  activeRoutes.forEach((r: any, idx: number) => {
    activeRouteMap[r.name] = r;
    activeRouteMap['idx_' + idx] = r;
  });

  const getRouteForName = (name: string, fallbackIdx: number) => {
    return activeRouteMap[name] || activeRoutes[fallbackIdx % activeRoutes.length];
  };

  const r1Route = getRouteForName('Ruta 1', 0);
  const r2Route = getRouteForName('Ruta 2', 1);
  const r3Route = getRouteForName('Ruta 3', 2);
  const r4Route = getRouteForName('Ruta 4', 3);

  // Clasificar clientes entre Rutas según la estricta jerarquía de prioridades:
  // 1. Asignación permanente individual de cliente (permanentRouteId)
  // 2. Asignación manual temporal de cliente (clientOverrides)
  // 3. Asignación de ZONA elegida por el supervisor (zoneOverrides) - ¡PREVALECE SOBRE EL CORREDOR!
  // 4. Corredor predeterminado (CITY_CORRIDORS)
  // 5. Balanceo radial para San Juan de los Lagos y zonas sin asignar
  const routeClientsMap: Record<number, any[]> = {};
  activeRoutes.forEach((r: any) => routeClientsMap[r.id] = []);

  const localClients: any[] = [];

  validClients.forEach((c: any) => {
    // 1. Prioridad 1: Asignación permanente individual
    if (c.permanentRouteId !== undefined && c.permanentRouteId !== null) {
      const matchR = activeRoutes.find((r: any) => r.id === c.permanentRouteId);
      if (matchR) {
        c.assignedRouteId = matchR.id;
        routeClientsMap[matchR.id].push(c);
        return;
      }
    }

    // 2. Prioridad 2: Asignación manual individual (clientOverrides)
    const cOverride = clientOverrides[c.id] || {};
    if (cOverride.assignedRouteId !== undefined && cOverride.assignedRouteId !== null) {
      const matchR = activeRoutes.find((r: any) => r.id === cOverride.assignedRouteId);
      if (matchR) {
        c.assignedRouteId = matchR.id;
        routeClientsMap[matchR.id].push(c);
        return;
      }
    }

    // 3. Prioridad 3: Asignación de ZONA configurada por supervisor (zoneOverrides)
    const normCity = (c.city || '').trim().toLowerCase();
    const zOverride = getZoneOverride(zoneOverrides, normCity);
    if (zOverride.assignedRouteId !== undefined && zOverride.assignedRouteId !== null) {
      const matchR = activeRoutes.find((r: any) => r.id === zOverride.assignedRouteId);
      if (matchR) {
        c.assignedRouteId = matchR.id;
        routeClientsMap[matchR.id].push(c);
        return;
      }
    }

    // 4. Prioridad 4: Corredor Geográfico Predeterminado (CITY_CORRIDORS)
    const corridorInfo = getCorridorInfo(normCity);
    if (corridorInfo) {
      const targetR = getRouteForName(corridorInfo.targetName, 0);
      c.assignedRouteId = targetR.id;
      c.corridor = corridorInfo.corridor;
      if (corridorInfo.preferredDay && !c.assignedDay) {
        c.assignedDay = corridorInfo.preferredDay;
      }
      routeClientsMap[targetR.id].push(c);
      return;
    }

    // 5. Prioridad 5: Clientes locales de San Juan de los Lagos o sin corredor predefinido
    c.bearing = getBearing(SJ_CENTER.lat, SJ_CENTER.lng, c.lat, c.lng);
    localClients.push(c);
  });

  // Balancear clientes locales de San Juan de los Lagos manteniendo continuidad radial
  localClients.sort((a, b) => a.bearing - b.bearing);
  const targetPerRoute = Math.ceil(validClients.length / activeRoutes.length);

  // Orden radial de llenado acorde al cuadrante geográfico de salida de cada ruta
  const routeFillingOrder = [r4Route, r2Route, r3Route, r1Route];
  let currentFillingIdx = 0;

  localClients.forEach((c: any) => {
    while (
      currentFillingIdx < routeFillingOrder.length - 1 &&
      routeClientsMap[routeFillingOrder[currentFillingIdx].id].length >= targetPerRoute
    ) {
      currentFillingIdx++;
    }
    const assignedR = routeFillingOrder[currentFillingIdx];
    c.assignedRouteId = assignedR.id;
    routeClientsMap[assignedR.id].push(c);
  });

  // Blindaje geográfico estricto de seguridad:
  // Solo aplicar a clientes asignados automáticamente (si el supervisor fijó la zona o cliente, se respeta 100%)
  if (routeClientsMap[r1Route.id]) {
    const southClients = routeClientsMap[r1Route.id].filter((c: any) => {
      const hasExplicit = (c.permanentRouteId !== undefined && c.permanentRouteId !== null) || 
                          clientOverrides[c.id]?.assignedRouteId !== undefined || 
                          getZoneOverride(zoneOverrides, (c.city || '')).assignedRouteId !== undefined;
      return !hasExplicit && c.lat && c.lat < 21.2;
    });
    if (southClients.length > 0) {
      routeClientsMap[r1Route.id] = routeClientsMap[r1Route.id].filter((c: any) => {
        const hasExplicit = (c.permanentRouteId !== undefined && c.permanentRouteId !== null) || 
                            clientOverrides[c.id]?.assignedRouteId !== undefined || 
                            getZoneOverride(zoneOverrides, (c.city || '')).assignedRouteId !== undefined;
        return hasExplicit || !c.lat || c.lat >= 21.2;
      });
      southClients.forEach((c: any) => {
        c.assignedRouteId = r2Route.id;
        c.corridor = 'SUR';
        c.city = 'Arandas';
        c.assignedDay = 'Miércoles';
        routeClientsMap[r2Route.id].push(c);
      });
    }
  }

  // Generar visitas diarias por ruta respetando la regla: UN SOLO MUNICIPIO FORÁNEO POR DÍA
  let allVisits: any[] = [];

  activeRoutes.forEach((route: any) => {
    const clientsInRoute = routeClientsMap[route.id] || [];
    if (clientsInRoute.length === 0) return;

    const dailyVisits: any[][] = Array(6).fill(null).map(() => []);

    // Clasificación de clientes en la ruta:
    // A. Clientes con día fijo individual (permanentDay o clientOverrides.assignedDay)
    // B. Clientes de zonas que tienen días asignados en zoneOverrides (assignedDays con 1 o más días, o assignedDay)
    // C. Clientes flexibles (sin día forzado de zona ni de cliente)

    const individualFixedClients: any[] = [];
    const zoneDayClientsMap = new Map<string, { days: string[]; clients: any[] }>();
    const flexibleClients: any[] = [];

    clientsInRoute.forEach((c: any) => {
      const cOverride = clientOverrides[c.id] || {};
      const zOverride = getZoneOverride(zoneOverrides, c.city);

      // 1. Candado individual de cliente
      if (c.permanentDay && DAYS.includes(c.permanentDay)) {
        c.assignedDay = c.permanentDay;
        individualFixedClients.push(c);
        return;
      }
      if (cOverride.assignedDay && DAYS.includes(cOverride.assignedDay)) {
        c.assignedDay = cOverride.assignedDay;
        individualFixedClients.push(c);
        return;
      }

      // 2. Días asignados a la Zona (soporta múltiples días específicos, ej. 2 días para Encarnación de Díaz)
      const rawDays: string[] = Array.isArray(zOverride.assignedDays) && zOverride.assignedDays.length > 0
        ? zOverride.assignedDays
        : (zOverride.assignedDay ? [zOverride.assignedDay] : []);
      const validZDays = rawDays.filter((d: string) => DAYS.includes(d));

      if (validZDays.length > 0) {
        const normCity = normalizeZoneKey(c.city || '');
        if (!zoneDayClientsMap.has(normCity)) {
          zoneDayClientsMap.set(normCity, { days: validZDays, clients: [] });
        }
        zoneDayClientsMap.get(normCity)!.clients.push(c);
        return;
      }

      // 3. Clientes flexibles
      flexibleClients.push(c);
    });

    // 1. Asignar clientes con día individual fijo
    individualFixedClients.forEach((c: any) => {
      const dayIdx = DAYS.indexOf(c.assignedDay);
      if (dayIdx !== -1) {
        dailyVisits[dayIdx].push(c);
      }
    });

    // 2. Asignar clientes de zonas con días específicos (si son 2 o más días, se reparten por TSP entre esos días)
    zoneDayClientsMap.forEach(({ days, clients }) => {
      if (clients.length === 0) return;

      if (days.length === 1) {
        // Toda la zona en un solo día
        const dayIdx = DAYS.indexOf(days[0]);
        if (dayIdx !== -1) {
          clients.forEach((c: any) => c.assignedDay = days[0]);
          dailyVisits[dayIdx].push(...clients);
        }
      } else {
        // Zona con múltiples días (ej. 2 días: Martes y Jueves, o Miércoles y Jueves)
        // Se ordenan por proximidad TSP para agrupar microzonas continuas y se reparten equitativamente
        const orderedClients = nearestNeighborTSP(clients, DEPOT.lat, DEPOT.lng);
        const perDay = Math.ceil(orderedClients.length / days.length);

        days.forEach((dayName: string, step: number) => {
          const dayIdx = DAYS.indexOf(dayName);
          if (dayIdx !== -1) {
            const slice = orderedClients.slice(step * perDay, (step + 1) * perDay);
            slice.forEach((c: any) => c.assignedDay = dayName);
            dailyVisits[dayIdx].push(...slice);
          }
        });
      }
    });

    // 3. Clientes flexibles (distribución dinámica garantizando CERO DÍAS EN CERO):
    const foreignFlexible = flexibleClients.filter((c: any) => {
      const nc = (c.city || '').trim().toLowerCase();
      return nc && !nc.includes('san juan');
    });
    const localFlexible = flexibleClients.filter((c: any) => {
      const nc = (c.city || '').trim().toLowerCase();
      return !nc || nc.includes('san juan');
    });

    // 3.1 Asignar foráneos con corredor preferido si coinciden con esta ruta
    const unassignedForeign: any[] = [];
    foreignFlexible.forEach((c: any) => {
      const nc = (c.city || '').toLowerCase();
      if (route.id === r2Route.id) {
        if (nc.includes('arandas') || nc.includes('jesus') || nc.includes('jesús') || nc.includes('manuel doblado')) {
          c.assignedDay = 'Miércoles';
          dailyVisits[2].push(c);
          return;
        } else if (nc.includes('jalos') || nc.includes('valle') || nc.includes('miguel') || nc.includes('tepa')) {
          c.assignedDay = 'Martes';
          dailyVisits[1].push(c);
          return;
        }
      } else if (route.id === r4Route.id) {
        if (nc.includes('lagos')) {
          c.assignedDay = 'Jueves';
          dailyVisits[3].push(c);
          return;
        }
      }
      unassignedForeign.push(c);
    });

    // 3.2 Agrupar todo el pool flexible restante (locales y foráneos sin día fijo)
    const remainingPool = [...unassignedForeign, ...localFlexible];

    if (remainingPool.length > 0) {
      // Ordenar por cercanía geográfica TSP
      const orderedRemaining = nearestNeighborTSP(remainingPool, DEPOT.lat, DEPOT.lng);

      // Algoritmo Water-Filling con Super-Prioridad a días con 0 paradas
      // Garantiza:
      // a) NINGUNA RUTA Y NINGÚN DÍA SE QUEDA CON 0 CLIENTES
      // b) Carga balanceada equitativamente
      // c) Continuidad geográfica por día
      const numDays = 6;
      const currentCounts = dailyVisits.map(dv => dv.length);
      const toAdd = Array(numDays).fill(0);
      let remainingCount = orderedRemaining.length;

      while (remainingCount > 0) {
        let bestDay = -1;
        let minPriorityLoad = Infinity;

        for (let d = 0; d < numDays; d++) {
          const load = currentCounts[d] + toAdd[d];
          // Días con 0 clientes reciben prioridad absoluta
          const priorityScore = load === 0 ? -10000 : load;
          if (priorityScore < minPriorityLoad) {
            minPriorityLoad = priorityScore;
            bestDay = d;
          }
        }

        toAdd[bestDay]++;
        remainingCount--;
      }

      // Asignar rebanadas continuas de orderedRemaining a los días según toAdd
      let offset = 0;
      for (let d = 0; d < numDays; d++) {
        const count = toAdd[d];
        if (count > 0) {
          const slice = orderedRemaining.slice(offset, offset + count);
          const dayName = DAYS[d];
          slice.forEach((c: any) => c.assignedDay = dayName);
          dailyVisits[d].push(...slice);
          offset += count;
        }
      }
    }

    // 4. Trazar ruta final por día con TSP (nearest-neighbor + 2-opt) y sincronizar asignaciones
    dailyVisits.forEach((clientsInDay: any[], dayIdx: number) => {
      if (clientsInDay.length === 0) return;
      const actualDay = DAYS[dayIdx];
      const orderedDay = nearestNeighborTSP(clientsInDay, DEPOT.lat, DEPOT.lng);

      orderedDay.forEach((c: any, vIdx: number) => {
        c.assignedDay = actualDay;
        c.assignedRouteId = route.id;

        // Actualizar en el catálogo allClients para que se persista en data_store
        const matchedMaster = allClients.find((mc: any) => mc.id === c.id);
        if (matchedMaster) {
          matchedMaster.assignedDay = actualDay;
          matchedMaster.assignedRouteId = route.id;
        }

        const existingV = existingVisits.find((ev: any) => ev.clientId === c.id && ev.day === actualDay);
        let finalStatus = 'PENDIENTE';
        if (existingV && existingV.status && existingV.status !== 'PENDIENTE') {
          finalStatus = existingV.status;
        } else if (c.boughtThisWeek) {
          finalStatus = 'SURTIDO';
        }
        allVisits.push({
          id: existingV ? existingV.id : 'v-' + c.id + '-' + actualDay + '-' + vIdx + '-' + Math.random().toString(36).substr(2, 4),
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
