const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));

let updatedCount = 0;
db.clients.forEach(c => {
    if (c.city === 'Ojocaliente' || (c.city === 'Zona Metropolitana AGS' && c.lat > 22.3)) {
        c.city = 'Zacatecas';
        updatedCount++;
    }
});

fs.writeFileSync('data_store.json', JSON.stringify(db, null, 2));
console.log(`Updated ${updatedCount} clients to Zacatecas zone.`);
