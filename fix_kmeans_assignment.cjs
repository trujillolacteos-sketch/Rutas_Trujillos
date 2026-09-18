const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Sort clients by distance to their closest centroid[\s\S]*?\/\/ 3\. NOW run TSP on each day independently to avoid zigzagging/g;

const replacement = `// Flatten all client-centroid pairs and sort them by distance
    const allPairs: { client: Client, centroidIdx: number, dist: number }[] = [];
    routeClients.forEach(c => {
      centroids.forEach((cent, idx) => {
        const dLat = c.latitud - cent.lat;
        const dLng = c.longitud - cent.lng;
        allPairs.push({ client: c, centroidIdx: idx, dist: dLat * dLat + dLng * dLng });
      });
    });

    // Sort by shortest distance first
    allPairs.sort((a, b) => a.dist - b.dist);

    const assignedClientIds = new Set<string>();
    
    // Assign closest pairs first while respecting capacity
    for (const pair of allPairs) {
      if (assignedClientIds.has(pair.client.id)) continue;
      if (dailyAssignments[pair.centroidIdx].length >= maxCapacity) continue;
      
      dailyAssignments[pair.centroidIdx].push(pair.client);
      assignedClientIds.add(pair.client.id);
    }

    // Fallback for any unassigned clients (should be rare/none, but if capacities are super tight)
    routeClients.forEach(c => {
      if (!assignedClientIds.has(c.id)) {
        // Just put them in the day with the most remaining capacity
        let bestIdx = 0;
        let mostRoom = -Infinity;
        for (let i = 0; i < 6; i++) {
          const room = maxCapacity - dailyAssignments[i].length;
          if (room > mostRoom) {
            mostRoom = room;
            bestIdx = i;
          }
        }
        dailyAssignments[bestIdx].push(c);
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
  console.log("Updated daily clustering assignment!");
} else {
  console.log("Regex not found!");
}
