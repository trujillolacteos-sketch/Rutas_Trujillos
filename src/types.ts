export interface RouteConfig {
  id: number;
  name: string;
  isDelivery?: boolean;
  isAuthorized?: boolean;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface ClientData {
  id: number;
  name: string;
  lat: number;
  lng: number;
  city: string;
  street: string;
  salesVolume: number;
  visitFrequency: number;
  isForeign: boolean;
  boughtThisWeek?: boolean;
  isActive?: boolean;
  assignedRouteId?: number;
  permanentRouteId?: number;
  assignedDay?: string;
  permanentDay?: string;
  clientType?: 'company' | 'person';
}

export interface PlannedVisit {
  id: string;
  clientId: number;
  clientName: string;
  lat: number;
  lng: number;
  routeId: number;
  routeName: string;
  day: string;
  status: string; // PENDIENTE, VISITADO, SURTIDO, NO_ESTABA, CERRADO
  updatedAt?: number;
}

export interface TrackingLog {
  id: string;
  routeId: number;
  timestamp: string; // ISO string
  lat: number;
  lng: number;
  type: 'movimiento' | 'parada' | 'evasion' | 'omision';
  duration?: number; // duration in seconds if it's a stop
  notes?: string; // e.g. "Visita a cliente X" or "Desayuno"
  reason?: string; // Motivo de omisión (CERRADO, NO ESTABA, etc.)
  clientId?: number;
  clientName?: string;
  clientLat?: number;
  clientLng?: number;
  distanceToClient?: number; // en metros al momento de omitir
}

export interface AppState {
  lastWeekReset?: number | null;
  clients: ClientData[];
  visits: PlannedVisit[];
  routes: RouteConfig[];
  syncLogs?: SyncLog[];
  trackingLogs?: TrackingLog[]; // Added tracking logs
  lastSync: string | null;
  users?: any[];
  clientOverrides?: Record<number, { visitFrequency?: number, isActive?: boolean, assignedRouteId?: number, permanentRouteId?: number, assignedDay?: string, permanentDay?: string, clientType?: string }>;
  zoneOverrides?: Record<string, { assignedRouteId?: number, assignedDay?: string }>;
  disabledZones?: string[];
  settings?: {
    closeTime: string; // e.g., "18:00"
    commissionRateCompany?: number; // percentage, default 1.0
    commissionRatePerson?: number; // percentage, default 2.0
    commissionAdjustmentMultiplier?: number; // 1.0 = sin ajuste, 1.10 = +10%, 0.90 = -10%
    baseSalaries?: Record<string, number>; // Centralized salaries per route e.g. { "Ruta 1": 1500 }
  };
  stateVersion?: number; // Incremented on any server state update for Hive Mind sync
}
