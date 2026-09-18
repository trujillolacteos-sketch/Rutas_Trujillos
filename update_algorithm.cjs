const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const macroZonesSnippet = `
const KNOWN_CITIES = [
    { name: "Guadalajara", lat: 20.6596, lng: -103.3496 },
    { name: "Aguascalientes", lat: 21.8852, lng: -102.2915 },
    { name: "San Juan de los Lagos", lat: 21.2447, lng: -102.3330 },
    { name: "Encarnación de Díaz", lat: 21.5269, lng: -102.2405 },
    { name: "Jesús María", lat: 21.9610, lng: -102.3438 },
    { name: "San Miguel el Alto", lat: 21.0294, lng: -102.4042 },
    { name: "Jalostotitlán", lat: 21.1213, lng: -102.4658 },
    { name: "Lagos de Moreno", lat: 21.3551, lng: -101.9304 },
    { name: "Yahualica", lat: 21.1319, lng: -102.9017 },
    { name: "Tepatitlán", lat: 20.8066, lng: -102.7601 },
    { name: "Arandas", lat: 20.7047, lng: -102.3467 },
    { name: "Valle de Guadalupe", lat: 21.0867, lng: -102.5513 },
    { name: "Ojocaliente", lat: 22.6480, lng: -102.2881 }
];

function getCityFromCoords(lat, lng, fallback) {
    if(!lat || !lng) return fallback || "Sin Ubicación";
    let closest = null;
    let minD = Infinity;
    for(let c of KNOWN_CITIES) {
        let d = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2)) * 111;
        if(d < minD) { minD = d; closest = c; }
    }
    if(closest && minD < 25) {
        return closest.name;
    }
    return fallback || "Región Desconocida";
}
`;

const oldCityMapping = `    const distKm = Math.sqrt((lat - DEPOT.lat)**2 + (lng - DEPOT.lng)**2) * 111;
    const cityStr = (c.city || "Desconocida").toLowerCase();`;

const newCityMapping = `    const distKm = Math.sqrt((lat - DEPOT.lat)**2 + (lng - DEPOT.lng)**2) * 111;
    // Asignación estricta de municipio/zona metropolitana por coordenadas
    const cityStr = getCityFromCoords(lat, lng, c.city);
    c.city = cityStr; // Ensure we override Odoo's potentially wrong city`;

if (!code.includes('function getCityFromCoords')) {
    code = code.replace('const DEPOT = { lat: 21.343263, lng: -102.264407 };', macroZonesSnippet + '\nconst DEPOT = { lat: 21.343263, lng: -102.264407 };');
}
code = code.replace(oldCityMapping, newCityMapping);


// NOW FIX THE CLUSTERING ASSIGNMENT!
const oldGeoLoad = `                            const score = tempLoads.reduce((sum, val) => sum + (val * val), 0);
              const maxLoad = Math.max(...tempLoads);
              
              if (maxLoad < minMaxLoad || (maxLoad === minMaxLoad && score < minScore)) {
                  minScore = score;
                  minMaxLoad = maxLoad;
                  bestBaseDay = b;
              }`;

const newGeoLoad = `              // Calcular dispersión geográfica para este día base (agrupando por coordenadas en vez de esparcir)
              let geoPenalty = 0;
              mz.clients.forEach(c => {
                 const step = Math.max(1, Math.floor(6 / c.freq));
                 for (let v = 0; v < c.freq; v++) {
                    const dayIdx = (b + v * step) % 6;
                    if (dailyVisits[dayIdx].length > 0) {
                        let cLat = 0, cLng = 0;
                        dailyVisits[dayIdx].forEach(ec => { cLat += ec.lat; cLng += ec.lng; });
                        cLat /= dailyVisits[dayIdx].length;
                        cLng /= dailyVisits[dayIdx].length;
                        let dist = Math.sqrt((c.lat - cLat)**2 + (c.lng - cLng)**2) * 111;
                        geoPenalty += (dist * dist); // Penalización exponencial por lejanía
                    }
                 }
              });

              // Ponderamos 80% cercanía geográfica y 20% balance de carga
              const loadScore = tempLoads.reduce((sum, val) => sum + (val * val), 0);
              const maxLoad = Math.max(...tempLoads);
              
              const score = (geoPenalty * 1000) + loadScore;
              
              if (score < minScore && maxLoad <= 45) { // Evitar sobresaturación extrema
                  minScore = score;
                  bestBaseDay = b;
              }`;

if (code.includes('const score = tempLoads.reduce((sum, val) => sum + (val * val), 0);')) {
    code = code.replace(oldGeoLoad, newGeoLoad);
}

// Write file
fs.writeFileSync('server/algorithm.ts', code);
console.log('Algorithm patched successfully');
