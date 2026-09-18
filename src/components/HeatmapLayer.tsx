import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HeatmapLayerProps {
  points: [number, number, number][]; // [lat, lng, intensity]
}

export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    
    // @ts-ignore
    const heat = L.heatLayer(points, {
      radius: 20,
      blur: 15,
      maxZoom: 17,
      gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}
