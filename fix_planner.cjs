const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Gather all clients for this route grouped by the days they should be visited[\s\S]*?\/\/ 3\. NOW run TSP on each day independently/;

const replacement = `// Gather all clients for this route grouped by the days they should be visited
    const clientsByDay: Record<string, Client[]> = {
      "Lunes": [], "Martes": [], "Miércoles": [], "Jueves": [], "Viernes": [], "Sábado": []
    };

    // Cluster all clients in this route into 6 geographic regions for the 6 days
    const clusters = kMeansClustering(routeClients, 6);

    for (let i = 0; i < 6; i++) {
      const primaryDay = dias[i];
      const chunk = clusters[i] || [];
      
      chunk.forEach(c => {
        const isMetro = findClientMetropolitanZone(c.ciudad, config, c.estado) !== null;
        // Metro clients get 1 to 3 visits, non-metro get exactly 1 visit
        const targetVisits = isMetro ? Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1))) : 1;
        const days = getVisitDays(primaryDay, targetVisits);
        days.forEach(d => {
          clientsByDay[d].push(c);
        });
      });
    }

    // 3. NOW run TSP on each day independently`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed planner logic successfully!");
} else {
  console.log("Regex not found!");
}
