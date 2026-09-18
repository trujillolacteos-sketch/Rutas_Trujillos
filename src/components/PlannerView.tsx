import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { AppState, PlannedVisit, ClientData } from '../types';
import { Map, Volume2, VolumeX, ShoppingCart, CheckCircle, Store, ChevronUp, ChevronDown, Clock, MapPin, AlertTriangle, XCircle, Wand2, Navigation } from 'lucide-react';
import RouteMap from './RouteMap';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

const getCurrentDayName = () => {
  const daysMap = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const currentDay = new Date().getDay();
  return currentDay === 0 ? "Lunes" : daysMap[currentDay];
};

export default function PlannerView({ state, role, user, setState }: { state: AppState, role: string, user?: { username: string, role: string }, setState: any }) {
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentDayName());
  
  const allowedRoutes = role === 'operator' && user 
    ? state.routes.filter(r => r.name === user.username)
    : state.routes;

  const initialRouteId = allowedRoutes.length > 0 ? allowedRoutes[0].id : null;
  const [selectedRoute, setSelectedRoute] = useState<number | null>(initialRouteId);
  const [selectedCity, setSelectedCity] = useState<string>("Todas");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [routeStarted, setRouteStarted] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);
  const [reachedVisit, setReachedVisit] = useState<PlannedVisit | null>(null);
  const [skipVisitModal, setSkipVisitModal] = useState<PlannedVisit | null>(null);
  const lastLocationRef = React.useRef<{ lat: number, lng: number, time: number } | null>(null);
  const wakeLockRef = React.useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          if (routeStarted) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
              // Lock released
            });
          } else if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          }
        } catch (err) {
          console.warn("Wake Lock error:", err);
        }
      }
    };
    requestWakeLock();
    
    const logEvasion = (notes) => {
      if (!selectedRoute || !lastLocationRef.current) return;
      const { lat, lng } = lastLocationRef.current;
      const log = {
         id: Math.random().toString(36).substr(2, 9),
         routeId: selectedRoute,
         timestamp: new Date().toISOString(),
         lat,
         lng,
         type: 'evasion',
         duration: 0,
         notes: notes
      };
      
      const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
      navigator.sendBeacon('/api/tracking', blob);
      
      // Also update local state if possible
      setState((prev) => ({
         ...prev,
         trackingLogs: [...(prev.trackingLogs || []), log]
      }));
    };

    const handleVisibilityChange = () => {
      if (!routeStarted) return;
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        logEvasion('App regresó a primer plano');
      } else {
        logEvasion('App minimizada o en segundo plano (Posible evasión)');
      }
    };

    const handlePageHide = () => {
      if (routeStarted) {
        logEvasion('App cerrada o recargada durante ruta (Posible evasión)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
        wakeLockRef.current = null;
      }
    };
  }, [routeStarted, selectedRoute]);

  useEffect(() => {
    if (!userLocation || !routeStarted || !selectedRoute) return;
    
    const now = Date.now();
    const lat = userLocation[0];
    const lng = userLocation[1];

    if (lastLocationRef.current) {
      const { lat: lastLat, lng: lastLng, time: lastTime } = lastLocationRef.current;
      const distance = getDistance(lastLat, lastLng, lat, lng);
      
      // Si nos hemos movido más de 30 metros, revisamos cuánto tiempo estuvimos parados
            if (distance > 30) {
        const timeStopped = now - lastTime;
        if (timeStopped > 60 * 1000) {
          const log = {
             id: Math.random().toString(36).substr(2, 9),
             routeId: selectedRoute,
             timestamp: new Date(lastTime).toISOString(),
             lat: lastLat,
             lng: lastLng,
             type: 'parada',
             duration: Math.round(timeStopped / 1000),
             notes: 'Parada de ' + Math.round(timeStopped / 60000) + ' minutos'
          };
          apiFetch('/api/tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log)
          }).catch(() => {});
          
          setState((prev) => ({
             ...prev,
             trackingLogs: [...(prev.trackingLogs || []), log]
          }));
        }
        
        lastLocationRef.current = { lat, lng, time: now };
      } else if (now - lastTime > 3 * 60 * 1000) {
        // Log regular movement every 3 minutes
        const log = {
           id: Math.random().toString(36).substr(2, 9),
           routeId: selectedRoute,
           timestamp: new Date().toISOString(),
           lat,
           lng,
           type: 'movimiento',
           notes: 'Registro de posición regular'
        };
        apiFetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        }).catch(() => {});
        
        setState((prev) => ({
           ...prev,
           trackingLogs: [...(prev.trackingLogs || []), log]
        }));
        
        lastLocationRef.current = { lat, lng, time: now };
      }
    } else {
      lastLocationRef.current = { lat, lng, time: now };
    }
  }, [userLocation, routeStarted, selectedRoute]);

  useEffect(() => {
    if (!selectedRoute && allowedRoutes.length > 0) {
      setSelectedRoute(allowedRoutes[0].id);
    }
  }, [allowedRoutes]);

  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  
  const allCities = Array.from(new Set(state.clients.map(c => c.city).filter(Boolean))).sort();

  let filteredVisits = state.visits.filter(v => {
    if (v.day !== selectedDay) return false;
    if (selectedRoute && v.routeId !== selectedRoute) return false;
    if (selectedCity !== "Todas") {
      const client = state.clients.find(c => c.id === v.clientId);
      if (client && client.city !== selectedCity) return false;
    }
    return true;
  });

  // AUTO-OPTIMIZATION based on current location
  const pendingVisits = filteredVisits.filter(v => v.status === 'PENDIENTE');
  const completedVisits = filteredVisits.filter(v => v.status !== 'PENDIENTE');
  let orderedPendingVisits = [...pendingVisits];
  if (pendingVisits.length > 1) {
    let currentPos = userLocation ? { lat: userLocation[0], lng: userLocation[1] } : { lat: pendingVisits[0].lat, lng: pendingVisits[0].lng };
    const unvisited = [...pendingVisits];
    orderedPendingVisits = [];
    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;
      unvisited.forEach((v, idx) => {
        const dLat = v.lat - currentPos.lat;
        const dLng = v.lng - currentPos.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = idx;
        }
      });
      const nextVisit = unvisited.splice(nearestIdx, 1)[0];
      orderedPendingVisits.push(nextVisit);
      currentPos = { lat: nextVisit.lat, lng: nextVisit.lng };
    }
  }

  filteredVisits = [...completedVisits, ...orderedPendingVisits];

  const activeVisit = orderedPendingVisits.length > 0 ? orderedPendingVisits[0] : undefined;

  // Track user location
  useEffect(() => {
    if (!routeStarted) return;

    if (!navigator.geolocation) {
      setLocationError("Geolocalización no soportada");
      return;
    }

    setLocationError(null);
    let watchId: number | null = null;

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocationError(null);
          const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(coords);

          if (activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
            const dist = getDistance(coords[0], coords[1], activeVisit.lat, activeVisit.lng);
            setDistanceToNext(dist);
          } else {
            setDistanceToNext(null);
          }
        },
        (error) => {
          console.warn("Error watching position:", error);
          let errorMsg = "Error desconocido de GPS.";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = "Permiso denegado (Abre en nueva pestaña usando el botón ↗).";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = "Ubicación no disponible.";
              break;
            case error.TIMEOUT:
              errorMsg = "Tiempo agotado buscando GPS.";
              break;
          }
          setLocationError(errorMsg);
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
      );
    } catch (err) {
      console.warn("Exception calling watchPosition:", err);
      setLocationError("Error de permisos.");
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch (e) {}
      }
    };
  }, [routeStarted, activeVisit?.id, activeVisit?.lat, activeVisit?.lng, activeVisit?.status, reachedVisit?.id]);


  const [processedVisits, setProcessedVisits] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userLocation && activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
      const dist = getDistance(userLocation[0], userLocation[1], activeVisit.lat, activeVisit.lng);
      setDistanceToNext(dist);
      
      // Auto check-in by proximity
      if (dist < 0.15 && !processedVisits.has(activeVisit.id) && (!reachedVisit || reachedVisit.id !== activeVisit.id)) {
        setReachedVisit(activeVisit);
      }
    } else {
      setDistanceToNext(null);
    }
  }, [userLocation, activeVisit?.id, activeVisit?.lat, activeVisit?.lng, reachedVisit?.id, processedVisits]);

  const handleStatusChange = async (visit: PlannedVisit, status: string) => {
    try {
      const res = await apiFetch('/api/visit/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: visit.id, status })
      });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({
          ...prev,
          visits: prev.visits.map(v => v.id === visit.id ? { ...v, status } : v)
        }));
      }
    } catch (e) {
      if (e.message !== 'Failed to fetch') console.error(e);
    }
  };

  const moveVisit = (visitId: string, direction: 'up' | 'down') => {
    setState((prev: AppState) => {
      const newVisits = [...prev.visits];
      const currentIndexInFiltered = filteredVisits.findIndex(v => v.id === visitId);
      if (currentIndexInFiltered === -1) return prev;
      
      const targetIndexInFiltered = direction === 'up' ? currentIndexInFiltered - 1 : currentIndexInFiltered + 1;
      if (targetIndexInFiltered < 0 || targetIndexInFiltered >= filteredVisits.length) return prev;

      const currentVisit = filteredVisits[currentIndexInFiltered];
      const targetVisit = filteredVisits[targetIndexInFiltered];

      const currentActualIndex = newVisits.findIndex(v => v.id === currentVisit.id);
      const targetActualIndex = newVisits.findIndex(v => v.id === targetVisit.id);

      newVisits[currentActualIndex] = targetVisit;
      newVisits[targetActualIndex] = currentVisit;

            apiFetch('/api/visits/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newVisits })
      }).catch(e => { if (e.message !== 'Failed to fetch') console.error(e) });
      
            apiFetch('/api/visits/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newVisits })
      }).catch(e => { if (e.message !== 'Failed to fetch') console.error(e) });
      
      return { ...prev, visits: newVisits };
    });
  };

  
  const handlePauseRoute = () => {
    if (selectedRoute && lastLocationRef.current) {
      const log = {
         id: Math.random().toString(36).substr(2, 9),
         routeId: selectedRoute,
         timestamp: new Date().toISOString(),
         lat: lastLocationRef.current.lat,
         lng: lastLocationRef.current.lng,
         type: 'evasion',
         duration: 0,
         notes: 'El usuario ha pausado la ruta (Posible evasión)'
      };
      apiFetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(log) }).catch(() => {});
      setState((prev) => ({ ...prev, trackingLogs: [...(prev.trackingLogs || []), log] }));
    }
    setRouteStarted(false);
    setIsNavigating(false);
  };

  const handleStopNavigation = () => {
    if (selectedRoute && lastLocationRef.current) {
      const log = {
         id: Math.random().toString(36).substr(2, 9),
         routeId: selectedRoute,
         timestamp: new Date().toISOString(),
         lat: lastLocationRef.current.lat,
         lng: lastLocationRef.current.lng,
         type: 'evasion',
         duration: 0,
         notes: 'El usuario salió de la navegación durante la ruta (Posible evasión)'
      };
      apiFetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(log) }).catch(() => {});
      setState((prev) => ({ ...prev, trackingLogs: [...(prev.trackingLogs || []), log] }));
    }
    setIsNavigating(false);
  };

  const optimizeRoute = () => {
    setState((prev: AppState) => {
      const newVisits = [...prev.visits];
      
      const pendingVisits = filteredVisits.filter(v => v.status === 'PENDIENTE');
      if (pendingVisits.length <= 1) return prev; // No need to optimize

      let currentPos = userLocation ? { lat: userLocation[0], lng: userLocation[1] } : { lat: pendingVisits[0].lat, lng: pendingVisits[0].lng };
      
      const unvisited = [...pendingVisits];
      const orderedPendingVisits: typeof pendingVisits = [];

      while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;
        unvisited.forEach((v, idx) => {
          const dLat = v.lat - currentPos.lat;
          const dLng = v.lng - currentPos.lng;
          const dist = dLat * dLat + dLng * dLng;
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = idx;
          }
        });
        const nextVisit = unvisited.splice(nearestIdx, 1)[0];
        orderedPendingVisits.push(nextVisit);
        currentPos = { lat: nextVisit.lat, lng: nextVisit.lng };
      }

      // We want to replace the sequence of pending visits in the current filteredVisits with this new sequence in the global visits array.
      const originalPendingIndices = pendingVisits.map(v => newVisits.findIndex(nv => nv.id === v.id));
      
      originalPendingIndices.forEach((originalIndex, i) => {
        if (originalIndex !== -1) {
          newVisits[originalIndex] = orderedPendingVisits[i];
        }
      });

      return { ...prev, visits: newVisits };
    });
  };

  const getClientData = (clientId: number): ClientData | undefined => {
    return state.clients.find(c => c.id === clientId);
  };

  const VEHICLE_CAPACITY = 25000;

  const currentRouteLoad = filteredVisits.reduce((acc, visit) => {
    const client = getClientData(visit.clientId);
    if (!client) return acc;
    const weeklyVolume = (client.salesVolume || 0) / 14;
    const dailyVolume = weeklyVolume / Math.max(1, client.visitFrequency || 1);
    return acc + dailyVolume;
  }, 0);

  const isOverloaded = currentRouteLoad > VEHICLE_CAPACITY;
  const loadPercentage = Math.min((currentRouteLoad / VEHICLE_CAPACITY) * 100, 100);

  const totalStops = filteredVisits.length;
  const completedStops = filteredVisits.filter(v => v.status !== 'PENDIENTE').length;
  const progressPercentage = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  // Calculo de horario comercial y riesgo de visitas
  const closeTimeStr = state.settings?.closeTime || '18:00';
  const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);
  
  const now = new Date();
  const closeTimeDate = new Date();
  closeTimeDate.setHours(closeHour || 18, closeMin || 0, 0, 0);

  // Consideramos 20 minutos por visita promedio
  const AVG_MINUTES_PER_VISIT = 20;
  
  let accumulatedTimeMs = now.getTime();
  const visitsWithETA = filteredVisits.map(v => {
    if (v.status !== 'PENDIENTE') {
      return { ...v, isAtRisk: false, eta: null };
    }
    accumulatedTimeMs += AVG_MINUTES_PER_VISIT * 60000;
    const etaDate = new Date(accumulatedTimeMs);
    // Si la ETA es posterior a (Hora de cierre - 30 min), está en riesgo (próxima a vencer)
    const isAtRisk = etaDate.getTime() > (closeTimeDate.getTime() - 30 * 60000);
    return { ...v, isAtRisk, eta: etaDate };
  });

  const atRiskCount = visitsWithETA.filter(v => v.isAtRisk).length;

  


  const renderReachedModal = () => {
    if (!reachedVisit) return null;
    
    // Find the next visit
    const nextVisit = orderedPendingVisits.find(v => v.id !== reachedVisit.id);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
            ¡Visita Alcanzada!
          </h3>
          <p className="text-center text-slate-600 mb-6 text-sm">
            Has llegado con <span className="font-bold text-slate-900">{reachedVisit.clientName}</span>.
            {nextVisit && (
              <span className="block mt-2 text-xs">Siguiente cliente: {nextVisit.clientName}</span>
            )}
          </p>

          <div className="space-y-3">
            <button
              onClick={() => {
                setProcessedVisits(prev => new Set(prev).add(reachedVisit.id));
                handleStatusChange(reachedVisit, 'VISITADO');
                setReachedVisit(null);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Surtir / Finalizar Visita
            </button>
            <button
              onClick={() => {
                setProcessedVisits(prev => new Set(prev).add(reachedVisit.id));
                setReachedVisit(null);
              }}
              className="w-full text-slate-400 hover:text-slate-600 font-bold py-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSkipModal = () => {
    if (!skipVisitModal) return null;
    const skipReasons = ['CERRADO', 'NO ESTABA', 'PEDIDO POR TELÉFONO', 'PROBLEMA VIAL', 'OTRO'];
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Omitir Visita</h3>
          <p className="text-slate-600 mb-6 text-sm">
            ¿Por qué omites a <span className="font-bold text-slate-900">{skipVisitModal.clientName}</span>?
          </p>
          <div className="w-full flex flex-col gap-2 mb-4">
            {skipReasons.map(r => (
               <button 
                 key={r}
                 onClick={() => {
                   handleStatusChange(skipVisitModal, r);
                   setSkipVisitModal(null);
                 }}
                 className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors shadow-sm"
               >
                 {r}
               </button>
            ))}
          </div>
          <button
            onClick={() => setSkipVisitModal(null)}
            className="w-full text-slate-400 hover:text-slate-600 font-bold py-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  if (isNavigating) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
        {renderSkipModal()}
        {renderReachedModal()}
        
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Navegación Activa</h2>
              <p className="text-slate-400 text-xs">
                {activeVisit ? `Hacia: ${activeVisit.clientName}` : 'Sigue la ruta marcada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePauseRoute}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Pausar Ruta
            </button>
            <div className="flex items-center gap-2 mr-2 border-r border-slate-700 pr-4">
              <button onClick={() => setIsMuted(!isMuted)} className="text-slate-300 hover:text-white transition-colors">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
            <button 
              onClick={handleStopNavigation}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Salir de Navegación
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
          <RouteMap 
            visits={filteredVisits} 
            userLocation={userLocation}
            activeVisit={activeVisit}
            isMuted={isMuted}
            voiceVolume={voiceVolume}
          />
          {activeVisit && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4">
              <div className="bg-white rounded-3xl shadow-2xl p-4 flex flex-col gap-3 border border-slate-100">
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Destino Actual</p>
                  <p className="text-lg font-bold text-slate-800 truncate">{activeVisit.clientName}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSkipVisitModal(activeVisit)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    title="Reportar Incidencia o Cerrado"
                  >
                    <AlertTriangle className="w-5 h-5" /> Omitir Cliente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {renderSkipModal()}
      {renderReachedModal()}
      
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Planificador Activo</h2>
          <p className="text-slate-500 text-sm mt-1">Sigue tu ruta y registra visitas</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select 
            className={`bg-white border text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium ${isOverloaded ? 'border-red-300 text-red-700' : 'border-slate-200 text-slate-700'}`}
            value={selectedDay}
            onChange={e => setSelectedDay(e.target.value)}
          >
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select 
            className={`bg-white border text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium border-slate-200 text-slate-700`}
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
          >
            <option value="Todas">Todas las zonas</option>
            {allCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            className={`bg-white border text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium ${isOverloaded ? 'border-red-300 text-red-700' : 'border-slate-200 text-slate-700'}`}
            value={selectedRoute || 0}
            onChange={e => setSelectedRoute(Number(e.target.value))}
          >
            {role !== 'operator' && <option value={0}>Todas las rutas</option>}
            {allowedRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </header>

      {/* Progress & Capacity Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Progreso de la Ruta */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-bold text-slate-700">Progreso de la Ruta</span>
            <span className="font-bold text-blue-600">
              {completedStops} / {totalStops} paradas ({Math.round(progressPercentage)}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500 bg-blue-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Alerta de Capacidad */}
        <div className={`p-4 rounded-2xl border ${isOverloaded ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 shadow-sm'} flex flex-col justify-center transition-colors`}>
          <div className="flex justify-between text-sm mb-1.5">
            <span className={`font-bold ${isOverloaded ? 'text-red-700' : 'text-slate-700'}`}>
              Carga del Vehículo (Proyectada)
            </span>
            <span className={`font-bold ${isOverloaded ? 'text-red-700' : 'text-slate-900'}`}>
              ${currentRouteLoad.toLocaleString(undefined, {maximumFractionDigits: 0})} / ${VEHICLE_CAPACITY.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${isOverloaded ? 'bg-red-500' : 'bg-emerald-500'}`} 
              style={{ width: `${loadPercentage}%` }}
            ></div>
          </div>
          {isOverloaded && (
            <div className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Capacidad Excedida - Redistribuir Carga
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full lg:h-[calc(100vh-240px)]">
        {/* Map Area */}
        <div className="w-full lg:w-2/3 h-[40vh] min-h-[300px] lg:h-full bg-slate-200 rounded-3xl overflow-hidden relative shadow-sm border border-slate-200 flex flex-col">
          <div className="flex-1 w-full h-full relative">
            <RouteMap visits={filteredVisits} activeVisit={activeVisit} userLocation={userLocation} isMuted={isMuted} voiceVolume={voiceVolume} />
          </div>

          {activeVisit && (
            <div className="absolute bottom-3 left-3 right-3 lg:bottom-6 lg:left-6 lg:right-6 z-[1000]">
              {!routeStarted ? (
                <div className="bg-white p-4 rounded-2xl shadow-xl flex justify-center border border-slate-100">
                  <button 
                    onClick={() => setRouteStarted(true)}
                    className="w-full lg:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl text-sm lg:text-base font-bold transition-colors shadow-md"
                  >
                    <Navigation className="w-5 h-5" />
                    Comenzar Ruta
                  </button>
                </div>
              ) : (
                <div className="bg-white p-3 lg:p-5 rounded-2xl shadow-xl flex flex-col lg:flex-row gap-3 lg:gap-6 items-start lg:items-center justify-between border border-slate-100">
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 block bg-blue-50 px-2 py-0.5 rounded-md">Parada Actual</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base lg:text-xl leading-tight mb-1 truncate" title={activeVisit.clientName}>{activeVisit.clientName}</h3>
                    <div className="flex items-center gap-3 text-[11px] lg:text-xs font-medium text-slate-500 line-clamp-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0"/>
                        <span className="truncate">{getClientData(activeVisit.clientId)?.street || 'Sin dirección'}, {getClientData(activeVisit.clientId)?.city || ''}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center justify-between lg:justify-end">
                    <div className="flex-1 sm:flex-none flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-end text-sm w-full lg:w-auto mb-1 lg:mb-0 min-h-[40px]">
                      {locationError ? (
                        <span key="err" className="text-rose-600 text-[11px] lg:text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> GPS Error: {locationError}</span>
                      ) : distanceToNext !== null ? (
                        <div key="dist" className="flex items-center gap-2 lg:flex-col lg:items-end lg:gap-0">
                          <span className="font-bold text-slate-700 text-xs lg:text-sm">{Math.round(distanceToNext)}m</span>
                          {distanceToNext <= 20 ? (
                            <span className="text-emerald-600 font-bold text-[11px] lg:text-xs">¡Visita generada!</span>
                          ) : (
                            <span className="text-slate-400 text-[11px] lg:text-xs lg:text-right">Acércate a 20m</span>
                          )}
                        </div>
                      ) : userLocation ? (
                        <span key="active" className="text-emerald-600 text-[11px] lg:text-xs flex items-center gap-1"><MapPin className="w-3 h-3"/> GPS Activo (Destino sin coords)</span>
                      ) : (
                        <span key="search" className="text-slate-400 text-[11px] lg:text-xs flex items-center gap-1"><Clock className="w-3 h-3 animate-spin"/> Buscando GPS...</span>
                      )}
                    </div>
                    
                    <div className="w-full sm:w-auto flex flex-row gap-2">
                      <button 
                        onClick={handlePauseRoute}
                        className="flex-none flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl transition-colors shadow-sm"
                        title="Pausar Ruta"
                      >
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                      </button>
                      <button
                        onClick={() => setIsNavigating(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-colors shadow-sm"
                        title="Navegar"
                      >
                        <Navigation className="w-4 h-4 flex-shrink-0" />
                        Navegar
                      </button>
                      <a 
                        href={`https://lacteos-trujillos2.odoo.com/pos/ui`}
                        target="_blank"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-colors shadow-sm"
                        title="Abrir Punto de Venta"
                      >
                        <ShoppingCart className="w-4 h-4 flex-shrink-0" />
                        POS
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* List Area */}
        <div className="w-full lg:w-1/3 h-[50vh] min-h-[400px] lg:h-full bg-white rounded-3xl border border-slate-100 shadow-sm p-4 lg:p-5 flex flex-col">
          <div className="flex flex-col gap-3 mb-4">
            <h3 className="font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Store className="w-5 h-5 text-slate-400" />
                Ruta del Día ({filteredVisits.length})
              </span>
              {atRiskCount > 0 && (
                <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {atRiskCount} en riesgo
                </span>
              )}
            </h3>
            
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {visitsWithETA.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No hay visitas asignadas.</p>
            ) : (
              visitsWithETA.map((v, idx) => {
                const isPending = v.status === 'PENDIENTE';
                const isActive = v.id === activeVisit?.id;
                const clientInfo = getClientData(v.clientId);
                const isAtRisk = v.isAtRisk;
                
                let cardClass = '';
                if (!isPending) cardClass = 'border-emerald-100 bg-emerald-50/50 opacity-70';
                else if (isActive) cardClass = isAtRisk ? 'border-rose-300 bg-rose-50 shadow-md transform scale-[1.02]' : 'border-blue-300 bg-blue-50 shadow-md transform scale-[1.02]';
                else cardClass = isAtRisk ? 'border-rose-200 bg-rose-50/50 hover:border-rose-300' : 'border-slate-200 bg-white hover:border-slate-300';

                return (
                  <div key={v.id} className={`p-4 rounded-2xl border ${cardClass} transition-all flex justify-between items-center group`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isPending ? (isActive ? (isAtRisk ? 'bg-rose-600' : 'bg-blue-600') + ' text-white shadow-sm' : (isAtRisk ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600')) : 'bg-emerald-100 text-emerald-700'}`}>
                        {isPending ? idx + 1 : <CheckCircle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isPending ? (isAtRisk ? 'text-rose-800' : 'text-slate-800') : 'text-slate-500 line-through'} break-words`}>{v.clientName}</p>
                        {clientInfo && (
                          <div className={`text-[11px] mt-1 space-y-0.5 ${isAtRisk && isPending ? 'text-rose-600/80' : 'text-slate-500'}`}>
                            <p className="flex items-start gap-1">
                              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="leading-tight">{clientInfo.street}, {clientInfo.city}</span>
                            </p>
                            <p className="flex items-center gap-1 opacity-75">
                              <Store className="w-3 h-3" />
                              Volumen ref: ${(clientInfo.salesVolume || 0).toLocaleString()}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${isPending ? (isActive ? (isAtRisk ? 'bg-rose-200 text-rose-800' : 'bg-blue-100 text-blue-700') : (isAtRisk ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500')) : 'bg-emerald-100 text-emerald-700'}`}>
                            {v.status}
                          </span>
                          {isAtRisk && isPending && v.eta && (
                            <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> ETA: {v.eta.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isPending && (
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {v.lat !== 0 && v.lng !== 0 && (
                          <button
                            onClick={() => setIsNavigating(true)}
                            className="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center"
                            title="Navegar"
                          >
                            <Navigation className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleStatusChange(v, 'VISITADO')}
                          className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                          title="Marcar como Visitado"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSkipVisitModal(v)}
                          className="p-1 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                          title="Reportar como No Visitado (Incidencia/Cerrado)"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                        <a 
                          href={`https://lacteos-trujillos2.odoo.com/pos/ui`}
                          target="_blank"
                          className="p-1 rounded-md bg-slate-800 text-white hover:bg-slate-900 transition-colors flex items-center justify-center"
                          title="Abrir Punto de Venta"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </a>
                        <button 
                          onClick={() => moveVisit(v.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => moveVisit(v.id, 'down')}
                          disabled={idx === filteredVisits.length - 1}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
