const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
const moyaClients = db.clients.filter(c => (c.address && c.address.toLowerCase().includes('luis moya')) || (c.name && c.name.toLowerCase().includes('luis moya')) || (c.municipio && c.municipio.toLowerCase().includes('luis moya')) || (c.colonia && c.colonia.toLowerCase().includes('luis moya')) || (c.zona && c.zona.toLowerCase().includes('luis moya')));
console.log(moyaClients.length + " clients found");
if (moyaClients.length > 0) {
    console.log("Tier:", moyaClients[0].tier, "Municipio:", moyaClients[0].municipio, "Colonia:", moyaClients[0].colonia);
}
