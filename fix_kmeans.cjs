const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /let centroids = clients\.slice\(0, k\)\.map\(c => \(\{ lat: c\.latitud, lng: c\.longitud \}\)\);/;

const replacement = `// Initialize centroids by taking spread out clients (K-Means++ style)
  let centroids: {lat: number, lng: number}[] = [];
  centroids.push({ lat: clients[0].latitud, lng: clients[0].longitud });
  while (centroids.length < k) {
    let maxDist = -1;
    let bestClient = clients[0];
    clients.forEach(c => {
      // Find distance to closest centroid
      let minDist = Infinity;
      centroids.forEach(cent => {
        const dLat = c.latitud - cent.lat;
        const dLng = c.longitud - cent.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) minDist = dist;
      });
      // We want to maximize this minimum distance
      if (minDist > maxDist) {
        maxDist = minDist;
        bestClient = c;
      }
    });
    centroids.push({ lat: bestClient.latitud, lng: bestClient.longitud });
  }`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed kmeans centroids.");
} else {
  console.log("Regex not found!");
}
