const fs = require('fs');

const KNOWN_CITIES = [
    { name: "Zona Metropolitana de Guadalajara", lat: 20.6596, lng: -103.3496, type: 'zona metropolitana' },
    { name: "Zona Metropolitana de Aguascalientes", lat: 21.8852, lng: -102.2915, type: 'zona metropolitana' },
    { name: "San Juan de los Lagos", lat: 21.2447, lng: -102.3330, type: 'municipio' },
    { name: "Encarnación de Díaz", lat: 21.5269, lng: -102.2405, type: 'municipio' },
    { name: "Jesús María", lat: 21.9610, lng: -102.3438, type: 'municipio' }, // Near AGS
    { name: "San Miguel el Alto", lat: 21.0294, lng: -102.4042, type: 'municipio' },
    { name: "Jalostotitlán", lat: 21.1213, lng: -102.4658, type: 'municipio' },
    { name: "Lagos de Moreno", lat: 21.3551, lng: -101.9304, type: 'municipio' },
    { name: "Yahualica", lat: 21.1319, lng: -102.9017, type: 'municipio' },
    { name: "Tepatitlán", lat: 20.8066, lng: -102.7601, type: 'municipio' },
    { name: "Arandas", lat: 20.7047, lng: -102.3467, type: 'municipio' },
    { name: "Valle de Guadalupe", lat: 21.0867, lng: -102.5513, type: 'municipio' },
    { name: "Ojocaliente", lat: 22.6480, lng: -102.2881, type: 'municipio' }
];

function getCityFromCoords(lat, lng) {
    if(!lat || !lng) return "Sin Ubicación";
    let closest = null;
    let minD = Infinity;
    for(let c of KNOWN_CITIES) {
        let d = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2)) * 111;
        if(d < minD) { minD = d; closest = c; }
    }
    // If it's within 20km of the center, assign the name.
    if(closest && minD < 25) {
        return closest.name;
    }
    return "Región Desconocida";
}

const data = require('./data_store.json');
let changed = 0;
data.clients.forEach(c => {
    let newCity = getCityFromCoords(c.lat, c.lng);
    if(newCity !== "Sin Ubicación" && newCity !== "Región Desconocida") {
       c.city = newCity;
       changed++;
    }
});
fs.writeFileSync('./data_store.json', JSON.stringify(data, null, 2));
console.log(`Updated ${changed} clients with coordinate-based zones`);
