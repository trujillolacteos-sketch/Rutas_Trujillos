export function kMeansClustering(clients: any[], k: number) {
  if (clients.length <= k) return clients.map(c => [c]);
  
  // Initialize centroids by taking random clients
  let centroids = clients.slice(0, k).map(c => ({ lat: c.latitud, lng: c.longitud }));
  let clusters: any[][] = Array(k).fill(0).map(() => []);

  let maxIterations = 50;
  for (let iter = 0; iter < maxIterations; iter++) {
    clusters = Array(k).fill(0).map(() => []);
    
    // Assign clients to nearest centroid
    clients.forEach(c => {
      let minDist = Infinity;
      let clusterIdx = 0;
      centroids.forEach((centroid, idx) => {
        const dLat = c.latitud - centroid.lat;
        const dLng = c.longitud - centroid.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          clusterIdx = idx;
        }
      });
      clusters[clusterIdx].push(c);
    });

    // Update centroids
    let changed = false;
    clusters.forEach((cluster, idx) => {
      if (cluster.length === 0) return;
      const sumLat = cluster.reduce((sum, c) => sum + c.latitud, 0);
      const sumLng = cluster.reduce((sum, c) => sum + c.longitud, 0);
      const newLat = sumLat / cluster.length;
      const newLng = sumLng / cluster.length;
      
      if (Math.abs(centroids[idx].lat - newLat) > 0.0001 || Math.abs(centroids[idx].lng - newLng) > 0.0001) {
        changed = true;
      }
      centroids[idx] = { lat: newLat, lng: newLng };
    });

    if (!changed) break;
  }
  
  // Sort clusters by centroid longitude or latitude to maintain some deterministic day order
  const clustersWithCentroid = clusters.map((cluster, i) => ({ cluster, centroid: centroids[i] }));
  clustersWithCentroid.sort((a, b) => a.centroid.lat - b.centroid.lat);

  return clustersWithCentroid.map(c => c.cluster);
}

export function nearestNeighborTSP(clients: any[], startLat: number, startLng: number) {
  if (clients.length === 0) return [];
  
  const unvisited = [...clients];
  const route = [];
  let currentPos = { lat: startLat, lng: startLng };

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    unvisited.forEach((c, idx) => {
      const dLat = c.latitud - currentPos.lat;
      const dLng = c.longitud - currentPos.lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });

    const nextClient = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextClient);
    currentPos = { lat: nextClient.latitud, lng: nextClient.longitud };
  }

  return route;
}
