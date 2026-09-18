const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ 1\. Process metropolitan clients grouped onto their assigned day and route them using TSP to avoid zig-zags[\s\S]*?orderedChunk\.forEach\(c => \{[\s\S]*?\}\);[\s\S]*?\}\);[\s\S]*?\}\);[\s\S]*?\}\);[\s\S]*?\}/;

const replacement = `// Gather all clients for this route grouped by the days they should be visited
    const clientsByDay: Record<string, Client[]> = {
      "Lunes": [], "Martes": [], "Miércoles": [], "Jueves": [], "Viernes": [], "Sábado": []
    };

    // 1. Assign metropolitan clients
    if (metroClients.length > 0) {
      metroClients.forEach(c => {
        const zone = findClientMetropolitanZone(c.ciudad, config, c.estado);
        if (zone) {
          const targetVisits = Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));
          const days = getVisitDays(zone.assignedDay, targetVisits);
          days.forEach(d => {
            clientsByDay[d].push(c);
          });
        }
      });
    }

    // 2. Assign non-metropolitan clients using K-Means
    if (nonMetroClients.length > 0) {
      const metroDays = Array.from(new Set(metroClients.map(c => findClientMetropolitanZone(c.ciudad, config, c.estado)?.assignedDay).filter(Boolean)));
      const remainingDays = dias.filter(d => !metroDays.includes(d as string));
      const targetDays = remainingDays.length > 0 ? remainingDays : dias;
      
      const k = targetDays.length;
      
      // Cluster the clients into K distinct geographic regions
      const clusters = kMeansClustering(nonMetroClients, k);
      
      for (let i = 0; i < k; i++) {
        const primaryDay = targetDays[i];
        const chunk = clusters[i] || [];
        
        chunk.forEach(c => {
          const targetVisits = Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));
          const days = getVisitDays(primaryDay, targetVisits);
          days.forEach(d => {
            clientsByDay[d].push(c);
          });
        });
      }
    }

    // 3. NOW run TSP on each day independently to avoid zigzagging across the entire route mix
    dias.forEach(day => {
      const clientsForDay = clientsByDay[day];
      if (clientsForDay.length > 0) {
        // Run TSP on all clients for this day (both metro and non-metro) starting from CEDIS
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
      }
    });`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Successfully replaced planner logic for days.");
} else {
  console.log("Regex not found for planner logic.");
}
