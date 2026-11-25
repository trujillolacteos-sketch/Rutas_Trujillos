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
    const cOverride = clientOverrides[c.id] || {};
    const zOverride = getZoneOverride(zoneOverrides, cityStr);

    if (cOverride.isActive !== void 0) {
      isActive = cOverride.isActive;
    }
    if (cOverride.visitFrequency !== void 0) {
      freq = cOverride.visitFrequency;
    }

    const permanentRouteId = cOverride.permanentRouteId !== void 0 ? cOverride.permanentRouteId : (c.permanentRouteId || undefined);
    const permanentDay = cOverride.permanentDay !== void 0 ? cOverride.permanentDay : (c.permanentDay || undefined);
    const permanentDays = cOverride.permanentDays !== void 0 ? cOverride.permanentDays : (c.permanentDays || undefined);
    const assignedDays = cOverride.assignedDays !== void 0 ? cOverride.assignedDays : (c.assignedDays || undefined);
    
    // Si tiene días permanentes o asignados, la frecuencia mínima coincide con la cantidad de días
    const explicitDays = (permanentDays && permanentDays.length > 0) ? permanentDays : (assignedDays && assignedDays.length > 0 ? assignedDays : undefined);
    if (explicitDays && explicitDays.length > 0) {
      freq = Math.max(freq, explicitDays.length);
    }

    const finalRouteId = permanentRouteId !== void 0 ? permanentRouteId : (cOverride.assignedRouteId !== void 0 ? cOverride.assignedRouteId : zOverride.assignedRouteId);
    const primaryAssignedDay = (explicitDays && explicitDays.length > 0) ? explicitDays[0] : (cOverride.assignedDay !== void 0 ? cOverride.assignedDay : zOverride.assignedDay);
    const finalDay = permanentDay !== void 0 ? permanentDay : primaryAssignedDay;

    return {
      id: c.id,
      isActive,
      assignedRouteId: finalRouteId,
      permanentRouteId: permanentRouteId,
      assignedDay: finalDay,
      permanentDay: permanentDay,
      assignedDays: explicitDays || (finalDay ? [finalDay] : undefined),
      permanentDays: permanentDays,
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
    addLog("warning", "Se encontraron " + invalidClients.length + " clientes sin coordenadas. Se agruparán al final.");
  }
  const activeRoutes = routes.filter((r) => r.isDelivery && r.isAuthorized);
  const k = activeRoutes.length;
  if (k === 0 || validClients.length === 0) {
    addLog("error", "No hay rutas activas o clientes.");
    return { clients: allClients, visits: [], routes, logs };
  }

  // Mapeo canónico de municipios foráneos a su corredor geográfico natural
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

  // Helper para resolver la ruta de una zona en un día específico (soporta routePerDay)
  function resolveRouteForZoneDay(zOverride: any, dayName: string, fallbackRoute: any) {
    if (zOverride) {
      if (zOverride.routePerDay && zOverride.routePerDay[dayName] !== undefined && zOverride.routePerDay[dayName] !== null && zOverride.routePerDay[dayName] !== '') {
        const rId = Number(zOverride.routePerDay[dayName]);
        const match = activeRoutes.find((r: any) => r.id === rId);
        if (match) return match;
      }
      if (zOverride.assignedRouteId !== undefined && zOverride.assignedRouteId !== null && zOverride.assignedRouteId !== '') {
        const rId = Number(zOverride.assignedRouteId);
        const match = activeRoutes.find((r: any) => r.id === rId);
        if (match) return match;
      }
    }
    return fallbackRoute;
  }

  // Matriz de visitas diarias por ruta: routeDailyVisits[routeId][dayIdx] = [clients...]
  const routeDailyVisits: Record<number, any[][]> = {};
  activeRoutes.forEach((r: any) => {
    routeDailyVisits[r.id] = Array(6).fill(null).map(() => []);
  });

  // Conjunto de IDs de clientes ya programados
  const scheduledClientIds = new Set<number>();

  // Helper para espaciar días cuando un cliente tiene freq > 1 pero días automáticos
  function getSpacedDays(freq: number, startDay?: string): string[] {
    if (freq <= 1) return startDay && DAYS.includes(startDay) ? [startDay] : ['Lunes'];
    if (freq === 2) {
      if (startDay === 'Martes') return ['Martes', 'Viernes'];
      if (startDay === 'Miércoles') return ['Miércoles', 'Sábado'];
      if (startDay === 'Jueves') return ['Lunes', 'Jueves'];
      if (startDay === 'Viernes') return ['Martes', 'Viernes'];
      if (startDay === 'Sábado') return ['Miércoles', 'Sábado'];
      return ['Lunes', 'Jueves'];
    }
    if (freq === 3) {
      if (startDay === 'Martes') return ['Martes', 'Jueves', 'Sábado'];
      return ['Lunes', 'Miércoles', 'Viernes'];
    }
    if (freq === 4) return ['Lunes', 'Martes', 'Jueves', 'Viernes'];
    if (freq === 5) return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    return DAYS.slice(0, 6);
  }

  // 1. PRIORIDAD 1: CLIENTES CON DÍAS FIJOS INDIVIDUALES (permanentDays, assignedDays, permanentDay, assignedDay)
  validClients.forEach((c: any) => {
    const cOverride = clientOverrides[c.id] || {};
    const zOverride = getZoneOverride(zoneOverrides, c.city);

    const explicitDays = (c.permanentDays && c.permanentDays.length > 0)
      ? c.permanentDays.filter((d: string) => DAYS.includes(d))
      : (cOverride.assignedDays && cOverride.assignedDays.length > 0)
      ? cOverride.assignedDays.filter((d: string) => DAYS.includes(d))
      : (c.permanentDay && DAYS.includes(c.permanentDay))
      ? [c.permanentDay]
      : (cOverride.assignedDay && DAYS.includes(cOverride.assignedDay))
      ? [cOverride.assignedDay]
      : [];

    if (explicitDays.length === 0) return;

    let targetDays = [...explicitDays];
    const freq = Math.max(c.visitFrequency || 1, targetDays.length);
    if (freq > targetDays.length) {
      targetDays = getSpacedDays(freq, targetDays[0]);
    }

    targetDays.forEach((dayName: string) => {
      const dIdx = DAYS.indexOf(dayName);
      if (dIdx === -1) return;

      // Resolver ruta
      let targetR: any = null;
      if (c.permanentRouteId) {
        targetR = activeRoutes.find((r: any) => r.id === c.permanentRouteId);
      }
      if (!targetR && cOverride.assignedRouteId) {
        targetR = activeRoutes.find((r: any) => r.id === cOverride.assignedRouteId);
      }
      if (!targetR) {
        const corridor = getCorridorInfo(c.city);
        const fallbackR = corridor ? getRouteForName(corridor.targetName, 0) : r1Route;
        targetR = resolveRouteForZoneDay(zOverride, dayName, fallbackR);
      }
      if (!targetR) targetR = r1Route;

      routeDailyVisits[targetR.id][dIdx].push({
        ...c,
        assignedDay: dayName,
        assignedRouteId: targetR.id
      });
    });

    scheduledClientIds.add(c.id);
  });

  // 2. PRIORIDAD 2: CLIENTES DE ZONAS CONFIGURADAS EN zoneOverrides (assignedDays, assignedDay, routePerDay)
  // Agrupar clientes no programados por zona
  const unscheduledByZone = new Map<string, any[]>();
  validClients.forEach((c: any) => {
    if (scheduledClientIds.has(c.id)) return;
    const normCity = normalizeZoneKey(c.city || '');
    if (!unscheduledByZone.has(normCity)) {
      unscheduledByZone.set(normCity, []);
    }
    unscheduledByZone.get(normCity)!.push(c);
  });

  unscheduledByZone.forEach((zoneClients, normCity) => {
    if (zoneClients.length === 0) return;
    const sampleClient = zoneClients[0];
    const zOverride = getZoneOverride(zoneOverrides, sampleClient.city);

    const rawZDays = Array.isArray(zOverride.assignedDays) && zOverride.assignedDays.length > 0
      ? zOverride.assignedDays
      : (zOverride.assignedDay ? [zOverride.assignedDay] : []);
    const validZDays = rawZDays.filter((d: string) => DAYS.includes(d));

    if (validZDays.length === 0) return; // Se procesará más adelante

    const corridor = getCorridorInfo(sampleClient.city);
    const fallbackR = corridor ? getRouteForName(corridor.targetName, 0) : r1Route;

    if (validZDays.length === 1) {
      // Toda la zona en un solo día
      const dayName = validZDays[0];
      const dIdx = DAYS.indexOf(dayName);
      if (dIdx !== -1) {
        const targetR = resolveRouteForZoneDay(zOverride, dayName, fallbackR);
        zoneClients.forEach((c: any) => {
          routeDailyVisits[targetR.id][dIdx].push({
            ...c,
            assignedDay: dayName,
            assignedRouteId: targetR.id
          });
          scheduledClientIds.add(c.id);
        });
      }
    } else {
      // Zona con múltiples días (ej. Encarnación de Díaz: Lunes y Jueves, con ruta por día)
      // Se ordenan por proximidad TSP para agrupar microzonas continuas y se reparten equitativamente
      const orderedZoneClients = nearestNeighborTSP(zoneClients, DEPOT.lat, DEPOT.lng);

      // Separar clientes con visitas múltiples (visitFrequency >= validZDays.length)
      const multiVisit = orderedZoneClients.filter((c: any) => (c.visitFrequency || 1) >= validZDays.length);
      const singleVisit = orderedZoneClients.filter((c: any) => (c.visitFrequency || 1) < validZDays.length);

      // Clientes multidía se visitan en TODOS los días de la zona
      multiVisit.forEach((c: any) => {
        validZDays.forEach((dayName: string) => {
          const dIdx = DAYS.indexOf(dayName);
          if (dIdx !== -1) {
            const targetR = resolveRouteForZoneDay(zOverride, dayName, fallbackR);
            routeDailyVisits[targetR.id][dIdx].push({
              ...c,
              assignedDay: dayName,
              assignedRouteId: targetR.id
            });
          }
        });
        scheduledClientIds.add(c.id);
      });

      // Clientes de una visita se reparten equitativamente entre los días asignados a la zona
      const perDay = Math.ceil(singleVisit.length / validZDays.length);
      validZDays.forEach((dayName: string, step: number) => {
        const dIdx = DAYS.indexOf(dayName);
        if (dIdx !== -1) {
          const targetR = resolveRouteForZoneDay(zOverride, dayName, fallbackR);
          const slice = singleVisit.slice(step * perDay, (step + 1) * perDay);
          slice.forEach((c: any) => {
            routeDailyVisits[targetR.id][dIdx].push({
              ...c,
              assignedDay: dayName,
              assignedRouteId: targetR.id
            });
            scheduledClientIds.add(c.id);
          });
        }
      });
    }
  });

  // 3. PRIORIDAD 3: FORÁNEOS RESTANTES CON CORREDOR GEOGRÁFICO
  validClients.forEach((c: any) => {
    if (scheduledClientIds.has(c.id)) return;
    const corridor = getCorridorInfo(c.city);
    if (!corridor) return;

    const targetR = getRouteForName(corridor.targetName, 0);
    const prefDay = corridor.preferredDay || 'Lunes';
    const freq = c.visitFrequency || 1;
    const daysToAssign = getSpacedDays(freq, prefDay);

    daysToAssign.forEach((dayName: string) => {
      const dIdx = DAYS.indexOf(dayName);
      if (dIdx !== -1) {
        routeDailyVisits[targetR.id][dIdx].push({
          ...c,
          assignedDay: dayName,
          assignedRouteId: targetR.id
        });
      }
    });

    scheduledClientIds.add(c.id);
  });

  // 4. PRIORIDAD 4: CLIENTES FLEXIBLES (SAN JUAN DE LOS LAGOS Y ZONAS RESTANTES)
  // Water-Filling inteligente con SUPER-PRIORIDAD a slots con 0 visitas
  // Garantiza:
  // a) NINGUNA RUTA Y NINGÚN DÍA SE QUEDA CON 0 CLIENTES (incluyendo Miércoles y Jueves en Ruta 1)
  // b) Balanceo equitativo de carga diaria y semanal entre rutas
  // c) Continuidad geográfica por cuadrantes radiales de San Juan de los Lagos
  const flexiblePool = validClients.filter((c: any) => !scheduledClientIds.has(c.id));

  // Asignar bearing radial para clientes locales
  flexiblePool.forEach((c: any) => {
    c.bearing = getBearing(SJ_CENTER.lat, SJ_CENTER.lng, c.lat, c.lng);
  });

  // Ordenar pool flexible por proximidad geográfica continua
  const orderedFlexible = nearestNeighborTSP(flexiblePool, DEPOT.lat, DEPOT.lng);

  // Mapear afinidad de cuadrantes radiales de San Juan a rutas:
  // Norte (315° a 45°) -> Ruta 1
  // Sur (135° a 225°) -> Ruta 2
  // Oeste (225° a 315°) -> Ruta 3
  // Este (45° a 135°) -> Ruta 4
  function getPreferredRouteForBearing(bearing: number): any {
    if (bearing >= 315 || bearing < 45) return r1Route;
    if (bearing >= 135 && bearing < 225) return r2Route;
    if (bearing >= 225 && bearing < 315) return r3Route;
    return r4Route;
  }

  orderedFlexible.forEach((c: any) => {
    const freq = Math.min(c.visitFrequency || 1, 3);
    const assignedDaysForClient: number[] = [];

    for (let visitNum = 0; visitNum < freq; visitNum++) {
      let bestRouteId = activeRoutes[0].id;
      let bestDayIdx = 0;
      let minScore = Infinity;

      activeRoutes.forEach((r: any) => {
        const totalInRoute = routeDailyVisits[r.id].reduce((acc, d) => acc + d.length, 0);

        for (let d = 0; d < 6; d++) {
          // No repetir el mismo día para el mismo cliente
          if (assignedDaysForClient.includes(d)) continue;

          const currentDayLoad = routeDailyVisits[r.id][d].length;
          // SUPER-PRIORIDAD ABSOLUTA: si una ruta no tiene clientes en ese día, score es fuertemente negativo
          let score = currentDayLoad === 0 ? -10000 : (currentDayLoad * 3 + totalInRoute);

          // Bonificación por afinidad de cuadrante
          const preferredR = getPreferredRouteForBearing(c.bearing || 0);
          if (preferredR && preferredR.id === r.id) {
            score -= 10;
          }

          if (score < minScore) {
            minScore = score;
            bestRouteId = r.id;
            bestDayIdx = d;
          }
        }
      });

      assignedDaysForClient.push(bestDayIdx);
      const chosenDayName = DAYS[bestDayIdx];
      routeDailyVisits[bestRouteId][bestDayIdx].push({
        ...c,
        assignedDay: chosenDayName,
        assignedRouteId: bestRouteId
      });
    }

    scheduledClientIds.add(c.id);
  });

  // 5. GENERACIÓN FINAL DE VISITAS CON OPTIMIZACIÓN TSP (2-OPT) POR RUTA Y POR DÍA
  const allVisits: any[] = [];

  activeRoutes.forEach((route: any) => {
    for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
      const clientsInDay = routeDailyVisits[route.id][dayIdx];
      if (clientsInDay.length === 0) continue;

      const actualDay = DAYS[dayIdx];
      const orderedDay = nearestNeighborTSP(clientsInDay, DEPOT.lat, DEPOT.lng);

      orderedDay.forEach((c: any, vIdx: number) => {
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
    }
  });

  // 6. SINCRONIZAR ASIGNACIONES EN allClients PARA PERSISTENCIA
  allClients.forEach((mc: any) => {
    const visitsForClient = allVisits.filter((v: any) => v.clientId === mc.id);
    if (visitsForClient.length > 0) {
      mc.assignedRouteId = visitsForClient[0].routeId;
      mc.assignedDay = visitsForClient[0].day;
      mc.assignedDays = Array.from(new Set(visitsForClient.map((v: any) => v.day)));
      mc.visitFrequency = visitsForClient.length;
    }
  });

  if (invalidClients.length > 0) {
    addLog("warning", "Se excluyeron " + invalidClients.length + " clientes anómalos (sin GPS) de las rutas.");
    const supRouteIdx = routes.findIndex((r) => r.id === 999999);
    if (supRouteIdx !== -1) {
      routes.splice(supRouteIdx, 1);
    }
  }

  addLog("success", "Planificador geográfico y por esfuerzo generado. Total visitas: " + allVisits.length);
  return { clients: allClients, visits: allVisits, routes, logs };
}
