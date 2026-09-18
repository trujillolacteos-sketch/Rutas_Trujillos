import fs from 'fs';
const data = JSON.parse(fs.readFileSync('.data/offline_state.json', 'utf8'));
console.log(JSON.stringify(data.routes, null, 2));
