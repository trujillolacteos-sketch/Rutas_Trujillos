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

// Función para seleccionar la mejor voz masculina en español
function getMaleSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const esVoices = voices.filter(v => v.lang.startsWith('es'));
  if (esVoices.length === 0) return null;

  // Buscar nombres de voces masculinas comunes en español (Google, Microsoft, Apple, Android)
  const maleKeywords = ['jorge', 'raul', 'raúl', 'pablo', 'diego', 'carlos', 'miguel', 'david', 'male', 'hombre', 'enrique', 'alvaro', 'álvaro', 'alonso', 'manuel', 'antonio'];
  const maleVoice = esVoices.find(v => {
    const nameLow = v.name.toLowerCase();
    return maleKeywords.some(k => nameLow.includes(k));
  });

  if (maleVoice) return maleVoice;

  // Priorizar español México
  const esMx = esVoices.find(v => v.lang.includes('MX'));
  return esMx || esVoices[0];
}

// Convertir instrucciones a un tono coloquial y natural de copiloto repartidor con anticipación temprana
function formatColloquialInstruction(rawText: string, distanceMeters: number, stage: 'lejana' | 'media' | 'inmediata'): string {
  let text = rawText.trim();

  // Limpiar cardinales y formalismos excesivos
  text = text.replace(/(Ve|Vaya|Dirígete|Diríjase|Continúa) (hacia el|al) (norte|sur|este|oeste|noreste|noroeste|sureste|suroeste)( por)?/gi, 'Sigue derecho');
  text = text.replace(/(norte|sur|este|oeste|noreste|noroeste|sureste|suroeste)/gi, '');
  text = text.replace(/gire a la (derecha|izquierda)/gi, 'vuelta a la $1');
  text = text.replace(/gira a la (derecha|izquierda)/gi, 'vuelta a la $1');
  text = text.replace(/doble a la (derecha|izquierda)/gi, 'vuelta a la $1');
  text = text.replace(/en la rotonda tome la/gi, 'en la glorieta toma la');

  const roundDist = Math.max(50, Math.round(distanceMeters / 50) * 50);

  if (stage === 'lejana') {
    if (/vuelta a la derecha/i.test(text)) {
      const rest = text.replace(/.*?vuelta a la derecha( en| por)?/i, '').trim();
      return `Ojo, en ${roundDist} metros nos abrimos para dar vuelta a la derecha${rest ? ' en ' + rest : ''}.`;
    }
    if (/vuelta a la izquierda/i.test(text)) {
      const rest = text.replace(/.*?vuelta a la izquierda( en| por)?/i, '').trim();
      return `Ojo, en ${roundDist} metros nos abrimos para dar vuelta a la izquierda${rest ? ' en ' + rest : ''}.`;
    }
    if (/glorieta|rotonda/i.test(text)) {
      return `En ${roundDist} metros entramos a la glorieta.`;
    }
    return `Sigue derecho por ${roundDist} metros.`;
  } else if (stage === 'media') {
    if (/vuelta a la derecha/i.test(text)) {
      const rest = text.replace(/.*?vuelta a la derecha( en| por)?/i, '').trim();
      return `En la esquina vuelta a la derecha${rest ? ' en ' + rest : ''}.`;
    }
    if (/vuelta a la izquierda/i.test(text)) {
      const rest = text.replace(/.*?vuelta a la izquierda( en| por)?/i, '').trim();
      return `En la esquina vuelta a la izquierda${rest ? ' en ' + rest : ''}.`;
    }
    if (/glorieta|rotonda/i.test(text)) {
      return `Entrando a la glorieta.`;
    }
    return `Sigue derecho.`;
  } else {
    // Inmediata (< 45 m)
    if (/vuelta a la derecha/i.test(text)) {
      return `Aquí a la derecha.`;
    }
    if (/vuelta a la izquierda/i.test(text)) {
      return `Aquí a la izquierda.`;
    }
    if (/glorieta|rotonda/i.test(text)) {
      return `Toma la salida aquí.`;
    }
    return text;
  }
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
            
            // Distancia total restante al punto final (cliente)
            const remainingDistToEnd = getDistance(start[0], start[1], end[0], end[1]);

            let stage = '';
            let textToSpeak = '';

            // 1. Llegada inmediata al cliente (< 35 metros)
            if (remainingDistToEnd < 35) {
              stage = 'llegada';
              textToSpeak = 'Listo, llegamos con el cliente.';
            } else if (dist <= 45) {
              // 2. Giro o maniobra inmediata (< 45 metros)
              stage = 'inmediata';
              textToSpeak = formatColloquialInstruction(instructionText, dist, 'inmediata');
            } else if (dist > 70 && dist <= 200) {
              // 3. Anticipación de esquina (70 a 200 metros)
              stage = 'media';
              textToSpeak = formatColloquialInstruction(instructionText, dist, 'media');
            } else if (dist > 250 && dist <= 600) {
              // 4. Anticipación lejana con tiempo de sobra (250 a 600 metros)
              stage = 'lejana';
              textToSpeak = formatColloquialInstruction(instructionText, dist, 'lejana');
            }
            
            const stageKey = instructionText + '|' + stage;
            
            if (textToSpeak && stageKey !== lastInstructionRef.current) {
              lastInstructionRef.current = stageKey;
              
              if ('speechSynthesis' in window && !isMuted) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                
                // Asignar voz masculina en español
                const maleVoice = getMaleSpanishVoice();
                if (maleVoice) utterance.voice = maleVoice;
                utterance.lang = maleVoice?.lang || 'es-MX';
                utterance.pitch = 0.88; // Tono más grave / masculino
                utterance.rate = 1.05;  // Ritmo natural y dinámico de copiloto
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
