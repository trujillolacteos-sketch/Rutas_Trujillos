const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Gather all clients for this route grouped by the days they should be visited[\s\S]*?\/\/ 3\. NOW run TSP on each day independently to avoid zigzagging/g;

const replacement = `// Gather all clients for this route grouped by the days they should be visited
    const clientsByDay: Record<string, Client[]> = {
      "Lunes": [], "Martes": [], "Miércoles": [], "Jueves": [], "Viernes": [], "Sábado": []
    };

    // Divide the route into 2 Macro-Clusters to prevent zigzagging across the entire city
    const macroClusters = kMeansClustering(routeClients, 2);
    const macroDays = [
      ["Lunes", "Miércoles", "Viernes"],
      ["Martes", "Jueves", "Sábado"]
    ];

    macroClusters.forEach((macroCluster, mIdx) => {
      const days = macroDays[mIdx];
      
      // Sub-divide the macro-cluster into 3 micro-clusters for the 3 days
      const microClusters = kMeansClustering(macroCluster, 3);
      
      microClusters.forEach((microCluster, uIdx) => {
        const primaryDay = days[uIdx];
        
        microCluster.forEach(c => {
          const isMetro = findClientMetropolitanZone(c.ciudad, config, c.estado) !== null;
          const targetVisits = isMetro ? Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1))) : 1;
          
          if (targetVisits === 3) {
            clientsByDay[days[0]].push(c);
            clientsByDay[days[1]].push(c);
            clientsByDay[days[2]].push(c);
          } else if (targetVisits === 2) {
            clientsByDay[days[uIdx]].push(c);
            clientsByDay[days[(uIdx + 1) % 3]].push(c);
          } else {
            clientsByDay[primaryDay].push(c);
          }
        });
      });
    });

    // 3. NOW run TSP on each day independently to avoid zigzagging`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Subzoning applied!");
} else {
  console.log("Regex not found!");
}
