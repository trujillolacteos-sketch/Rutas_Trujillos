const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const moyaClients = db.clientes.filter(c => c.direccion.toLowerCase().includes('luis moya') || c.nombre.toLowerCase().includes('luis moya') || c.municipio.toLowerCase().includes('luis moya'));
console.log(moyaClients);
