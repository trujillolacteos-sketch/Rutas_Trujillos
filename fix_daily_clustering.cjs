const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Divide the route into 2 Macro-Clusters to prevent zigzagging across the entire city[\s\S]*?\/\/ 3\. NOW run TSP on each day independently to avoid zigzagging/g;

const replacement = `// Cluster all clients in this route into 6 geographic regions for the 6 days using K-Means
    let centroids = kMeansClustering(routeClients, 6).map(cluster => {
      if (cluster.length === 0) return { lat: 0, lng: 0 };
      const sumLat = cluster.reduce((sum, c) => sum + c.latitud, 0);
      const sumLng = cluster.reduce((sum, c) => sum + c.longitud, 0);
      return { lat: sumLat / cluster.length, lng: sumLng / cluster.length };
    });

    // Handle empty centroids if any
    centroids = centroids.filter(c => c.lat !== 0 && c.lng !== 0);
    while (centroids.length < 6 && routeClients.length >= 6) {
      centroids.push({ lat: routeClients[Math.floor(Math.random()*routeClients.length)].latitud, lng: routeClients[Math.floor(Math.random()*routeClients.length)].longitud });
    }

    // Assign clients to the 6 days with a strict capacity limit to ensure balanced daily workloads
    // while keeping geographic compactness (Constrained K-Means / Greedy Assignment)
    const maxCapacity = Math.ceil(routeClients.length / 6) + 2; 
    const dailyAssignments: Client[][] = Array(6).fill(0).map(() => []);

    // Sort clients by distance to their closest centroid to assign the most obvious ones first
    const clientDistances = routeClients.map(c => {
      let minDist = Infinity;
      let closestIdx = 0;
      centroids.forEach((cent, idx) => {
        const dLat = c.latitud - cent.lat;
        const dLng = c.longitud - cent.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          closestIdx = idx;
        }
      });
      return { client: c, bestCentroid: closestIdx, minDist };
    });

    // Actually, assigning closest first can strand some edge clients. 
    // A better way is just assign each client to its closest centroid that has capacity.
    routeClients.forEach(c => {
      let bestIdx = -1;
      let minDist = Infinity;
      for (let i = 0; i < 6; i++) {
        if (dailyAssignments[i].length >= maxCapacity) continue;
        const dLat = c.latitud - centroids[i].lat;
        const dLng = c.longitud - centroids[i].lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1) {
        dailyAssignments[bestIdx].push(c);
      } else {
        // Fallback if all are full (shouldn't happen due to math)
        dailyAssignments[0].push(c);
      }
    });

    for (let i = 0; i < 6; i++) {
      const primaryDay = dias[i];
      const chunk = dailyAssignments[i];
      
      chunk.forEach(c => {
        // Since we are back to 1 visit a week, everyone just gets assigned to this day
        clientsByDay[primaryDay].push(c);
      });
    }

    // 3. NOW run TSP on each day independently to avoid zigzagging`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Applied balanced K-Means clustering for days!");
} else {
  console.log("Regex not found!");
}
