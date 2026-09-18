const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex2 = /\/\/ 1\. Assign metropolitan clients[\s\S]*?\/\/ 3\. NOW run TSP on each day independently/;

const replace2 = `// 1. Assign metropolitan clients
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
          // FOREIGN CLIENTS GET EXACTLY 1 VISIT!
          const targetVisits = 1;
          const days = getVisitDays(primaryDay, targetVisits);
          days.forEach(d => {
            clientsByDay[d].push(c);
          });
        });
      }
    }

    // 3. NOW run TSP on each day independently`;

if (regex2.test(code)) {
  code = code.replace(regex2, replace2);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed planner visits.");
} else {
  console.log("Regex 2 not found!");
}
