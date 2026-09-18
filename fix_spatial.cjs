const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Divide the route into 2 Macro-Clusters to prevent zigzagging across the entire city[\s\S]*?\/\/ 3\. NOW run TSP on each day independently to avoid zigzagging/g;

const replacement = `function balancedSpatialSplit(cList: Client[], numChunks: number): Client[][] {
      if (numChunks <= 1) return [cList];
      if (cList.length <= numChunks) {
        const res: Client[][] = Array(numChunks).fill(0).map(() => []);
        cList.forEach((c, i) => res[i].push(c));
        return res;
      }
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      cList.forEach(c => {
        if (c.latitud < minLat) minLat = c.latitud;
        if (c.latitud > maxLat) maxLat = c.latitud;
        if (c.longitud < minLng) minLng = c.longitud;
        if (c.longitud > maxLng) maxLng = c.longitud;
      });
      const latSpread = maxLat - minLat;
      const lngSpread = maxLng - minLng;
      const sorted = [...cList].sort((a, b) => {
        if (latSpread > lngSpread) return a.latitud - b.latitud;
        return a.longitud - b.longitud;
      });
      const chunks: Client[][] = [];
      const chunkSize = Math.ceil(sorted.length / numChunks);
      for (let i = 0; i < numChunks; i++) {
        chunks.push(sorted.slice(i * chunkSize, (i + 1) * chunkSize));
      }
      return chunks;
    }

    // Divide the route into 2 Macro-Clusters to prevent zigzagging across the entire city
    const macroClusters = balancedSpatialSplit(routeClients, 2);
    const macroDays = [
      ["Lunes", "Miércoles", "Viernes"],
      ["Martes", "Jueves", "Sábado"]
    ];

    macroClusters.forEach((macroCluster, mIdx) => {
      const days = macroDays[mIdx];
      
      // Sub-divide the macro-cluster into 3 micro-clusters for the 3 days
      const microClusters = balancedSpatialSplit(macroCluster, 3);
      
      microClusters.forEach((microCluster, uIdx) => {
        const primaryDay = days[uIdx];
        
        microCluster.forEach(c => {
          const isMetro = findClientMetropolitanZone(c.ciudad, config, c.estado) !== null;
          // Note: mock data generated 5-15, meaning all get 3.
          // Let's make the visit frequency realistic based on IOV and type
          let targetVisits = 1;
          if (isMetro) {
            targetVisits = c.iov > 70 ? 3 : c.iov > 40 ? 2 : 1;
          }
          
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
  console.log("Applied spatial split!");
} else {
  console.log("Regex not found!");
}
