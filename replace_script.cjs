const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetRegex = /\/\/ 1\. Process metropolitan clients grouped onto their assigned day[\s\S]*?return visits;\n\}/;

const replaceContent = `// 1. Process metropolitan clients grouped onto their assigned day and route them using TSP to avoid zig-zags
    if (metroClients.length > 0) {
      // Group by day first
      const metroByDay = {};
      metroClients.forEach(c => {
        const zone = findClientMetropolitanZone(c.ciudad, config, c.estado);
        if (zone) {
          if (!metroByDay[zone.assignedDay]) metroByDay[zone.assignedDay] = [];
          metroByDay[zone.assignedDay].push(c);
        }
      });

      Object.entries(metroByDay).forEach(([day, clientsForDay]) => {
        // Use TSP nearest neighbor from CEDIS to order visits efficiently
        const orderedClients = nearestNeighborTSP(clientsForDay, config.cedis.lat, config.cedis.lng);
        orderedClients.forEach(c => {
          visits.push({
            id: \`VST-\${1000 + visitCounter++}\`,
            clienteId: c.id,
            nombreCliente: c.nombre,
            ruta: c.rutaActual,
            diaSemana: day,
            estado: "PENDIENTE",
            fechaEjecucion: ""
          });
        });
      });
    }

    // 2. Process non-metropolitan regional clients using K-Means and TSP to avoid zig-zags
    if (nonMetroClients.length > 0) {
      const metroDays = Array.from(new Set(metroClients.map(c => findClientMetropolitanZone(c.ciudad, config, c.estado)?.assignedDay).filter(Boolean)));
      const remainingDays = dias.filter(d => !metroDays.includes(d));
      const targetDays = remainingDays.length > 0 ? remainingDays : dias;
      
      const k = targetDays.length;
      
      // Cluster the clients into K distinct geographic regions
      const clusters = kMeansClustering(nonMetroClients, k);
      
      for (let i = 0; i < k; i++) {
        const assignedDay = targetDays[i];
        const chunk = clusters[i] || [];
        
        // Sort each chunk using TSP Nearest Neighbor to organize an efficient linear sequence and prevent zig-zagging
        const orderedChunk = nearestNeighborTSP(chunk, config.cedis.lat, config.cedis.lng);
        
        orderedChunk.forEach(c => {
          visits.push({
            id: \`VST-\${1000 + visitCounter++}\`,
            clienteId: c.id,
            nombreCliente: c.nombre,
            ruta: c.rutaActual,
            diaSemana: assignedDay,
            estado: "PENDIENTE",
            fechaEjecucion: ""
          });
        });
      }
    }
  });

  return visits;
}`;

if (targetRegex.test(code)) {
  code = code.replace(targetRegex, replaceContent);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Successfully replaced via script.");
} else {
  console.log("Target regex not found!");
}
