const fs = require('fs');
const path = 'server/algorithm.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /const allClients: ClientData\[\] = rawClients\.map\(\(c: any\) => \{[\s\S]*?return \{/g;

const newCode = `const allClients: ClientData[] = rawClients.map((c: any) => {
    const sales = salesByClient[c.id] || { volume: 0, orderCount: 0, boughtThisWeek: false };
    const lat = c.partner_latitude || 0;
    const lng = c.partner_longitude || 0;
    
    // Distancia al CEDIS en KM (aprox)
    const distKm = Math.sqrt((lat - DEPOT.lat)**2 + (lng - DEPOT.lng)**2) * 111;
    const cityStr = (c.city || "Desconocida").toLowerCase();
    
    // Foráneo si está a más de 45km y no es San Juan de los Lagos
    const isForeign = distKm > 45 && !cityStr.includes("san juan");
    
    let freq = isForeign ? 1 : Math.min(Math.ceil(sales.orderCount / 14), 3);
    freq = Math.max(1, freq);

    let isActive = true;
    if (disabledZones.includes(cityStr.trim())) {
       isActive = false;
    }
    if (clientOverrides[c.id] && clientOverrides[c.id].isActive !== undefined) {
       isActive = clientOverrides[c.id].isActive;
    }
    if (clientOverrides[c.id] && clientOverrides[c.id].visitFrequency !== undefined) { 
       freq = clientOverrides[c.id].visitFrequency;
    }

    return {`;

code = code.replace(regex, newCode);
fs.writeFileSync(path, code);
