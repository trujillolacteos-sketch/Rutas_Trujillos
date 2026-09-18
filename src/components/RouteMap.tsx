import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { PlannedVisit } from '../types';

// Fix for default marker icons in Leaflet with React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const createIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const blueIcon = createIcon('blue');
const greenIcon = createIcon('green');
const redIcon = createIcon('red');
const greyIcon = createIcon('grey');
const goldIcon = createIcon('gold'); // Current location

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Component to handle map centering
function MapUpdater({ center, zoom }: { center: [number, number] | null, zoom: number }) {
  const map = useMap();
  const isFirstRef = React.useRef(true);
  useEffect(() => {
    if (center) {
      if (isFirstRef.current) {
        map.setView(center, zoom);
        isFirstRef.current = false;
      } else {
        map.panTo(center, { animate: true, duration: 1 });
      }
    }
  }, [center, zoom, map]);
  return null;
}

// Component to handle turn-by-turn routing
function RoutingMachine({ start, end, isMuted, voiceVolume }: { start: [number, number] | null, end: [number, number] | null, isMuted?: boolean, voiceVolume?: number }) {
  const map = useMap();
  const routingControlRef = React.useRef<any>(null);
  const lastInstructionRef = React.useRef<string | null>(null);
  const lastRoutedStartRef = React.useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!start || !end) return;

    if (!routingControlRef.current) {
      lastRoutedStartRef.current = start;
      // @ts-ignore
      routingControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(start[0], start[1]),
          L.latLng(end[0], end[1])
        ],
        show: false,
        collapsible: false,
        // @ts-ignore
        language: 'es',
        routeWhileDragging: false,
        addWaypoints: false,
        fitSelectedRoutes: false,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: '#3b82f6', weight: 5, opacity: 0.8 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        createMarker: () => null // Hide default markers since we have our own
      }).addTo(map);

      routingControlRef.current.on('routesfound', function(e: any) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const instructions = routes[0].instructions;
          if (instructions && instructions.length > 0) {
            const currentInstruction = instructions[0];
            const dist = currentInstruction.distance;
            const instructionText = currentInstruction.text;
            
            let stage = '';
            let textToSpeak = '';
            
            // Limpiar cardinales exhaustivo
            let cleanText = instructionText;
            cleanText = cleanText.replace(/(Ve|Vaya|Dirígete|Diríjase|Continúa) (hacia el|al) (norte|sur|este|oeste|noreste|noroeste|sureste|suroeste)( por)?/gi, 'Sigue');
            cleanText = cleanText.replace(/(norte|sur|este|oeste|noreste|noroeste|sureste|suroeste)/gi, '');
            // A veces dice "en la rotonda..." vamos a dejarlo
            
            // Simplificar y no hablar tanto
            if (dist <= 150) {
              stage = 'inmediata';
              textToSpeak = cleanText;
            }
            
            const stageKey = cleanText + '|' + stage;
            
            if (textToSpeak && stageKey !== lastInstructionRef.current) {
              lastInstructionRef.current = stageKey;
              
              if ('speechSynthesis' in window && !isMuted) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.lang = 'es-MX';
                utterance.rate = 1.0;
                utterance.volume = voiceVolume !== undefined ? voiceVolume : 1.0;
                window.speechSynthesis.speak(utterance);
              }
            }
          }
        }
      });
    } else {
      const dist = lastRoutedStartRef.current ? getDistance(start[0], start[1], lastRoutedStartRef.current[0], lastRoutedStartRef.current[1]) : 1000;
      
      // Solo recalcular ruta si el usuario se movió más de 30 metros desde el último recálculo
      // para evitar bloqueos del servidor de LRM
      const now = Date.now();
      const timeSinceLast = (window as any)._lastRoutedTime ? now - (window as any)._lastRoutedTime : 10000;
      // Recalcular ruta si el usuario se movió más de 15 metros o pasaron 10 segundos
      if (dist > 15 || timeSinceLast > 10000) {
        (window as any)._lastRoutedTime = now;
        lastRoutedStartRef.current = start;
        routingControlRef.current.setWaypoints([
          L.latLng(start[0], start[1]),
          L.latLng(end[0], end[1])
        ]);
      }
    }
  }, [map, start?.[0], start?.[1], end?.[0], end?.[1]]);

  useEffect(() => {
    return () => {
      if (routingControlRef.current) {
        try {
          const control = routingControlRef.current;
          routingControlRef.current = null;
          
          if (map && (control as any)._map) {
             control.setWaypoints([]);
             map.removeControl(control);
          }
        } catch (e) {
          console.warn("Leaflet routing cleanup error:", e);
        }
      }
    };
  }, [map]);

  return null;
}

interface RouteMapProps {
  visits: PlannedVisit[];
  activeVisit?: PlannedVisit;
  userLocation: [number, number] | null;
  isMuted?: boolean;
  voiceVolume?: number;
}

export default function RouteMap({ visits, activeVisit, userLocation, isMuted, voiceVolume }: RouteMapProps) {
  const [center, setCenter] = useState<[number, number]>([20.659698, -103.349609]); // Default Guadalajara

  useEffect(() => {
    if (activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
      setCenter([activeVisit.lat, activeVisit.lng]);
    } else if (visits.length > 0 && visits[0].lat !== 0) {
      setCenter([visits[0].lat, visits[0].lng]);
    }
  }, [activeVisit, visits]);

  // Group visits by routeId to draw separate polylines
  const groupedVisits: Record<number, [number, number][]> = {};
  visits.forEach(v => {
    if (v.lat !== 0 && v.lng !== 0) {
      if (!groupedVisits[v.routeId]) groupedVisits[v.routeId] = [];
      groupedVisits[v.routeId].push([v.lat, v.lng]);
    }
  });

  const polylineColors = ['#94a3b8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc'];

  return (
    <MapContainer center={center} zoom={13} className="w-full h-full z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapUpdater center={userLocation || center} zoom={14} />

      {/* Polylines faintly connecting the sequence of visits per route */}
      {Object.entries(groupedVisits).map(([routeId, coords], index) => (
        <Polyline 
          key={`route-${routeId}`}
          positions={coords} 
          color={polylineColors[index % polylineColors.length]} 
          weight={2} 
          opacity={0.6} 
          dashArray="4, 8" 
        />
      ))}

      {/* Individual turn-by-turn route to the active visit */}
      {activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0 && userLocation && (
        <RoutingMachine start={userLocation} end={[activeVisit.lat, activeVisit.lng]} isMuted={isMuted} voiceVolume={voiceVolume} />
      )}

      {/* Geofence for active visit */}
      {activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0 && (
        <Circle 
          center={[activeVisit.lat, activeVisit.lng]} 
          radius={100} // 100 meters
          pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2 }}
        />
      )}

      {/* Markers for visits */}
      {visits.map((visit, index) => {
        if (visit.lat === 0 || visit.lng === 0) return null;
        
        let icon = greyIcon;
        if (visit.status === 'PENDIENTE') {
          icon = visit.id === activeVisit?.id ? blueIcon : redIcon;
        } else if (visit.status === 'SURTIDO' || visit.status === 'VISITADO') {
          icon = greenIcon;
        }

        return (
          <Marker key={visit.id} position={[visit.lat, visit.lng]} icon={icon}>
            <Popup>
              <div className="font-bold">{index + 1}. {visit.clientName}</div>
              <div className="text-xs text-gray-500">{visit.status}</div>
            </Popup>
          </Marker>
        );
      })}

      {/* User Location Marker */}
      {userLocation && (
        <Marker position={userLocation} icon={goldIcon}>
          <Popup>
            <div className="font-bold">Tu Ubicación</div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
