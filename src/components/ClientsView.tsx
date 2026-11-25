import React, { useState, useMemo } from "react";
import { apiFetch } from '../lib/api';
import { AppState, ClientData } from "../types";
import {
  Briefcase,
  MapPinOff,
  AlertCircle,
  MapPin,
  Search,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Users,
  X,
  CalendarCheck,
  History,
  Store,
  Filter,
  Edit2,
  Save,
  Download,
  Map as MapIcon,
  Lock,
  Clock,
  Zap,
  Calendar,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Database,
  ShieldCheck,
  Info,
  RotateCcw
} from "lucide-react";

export default function ClientsView({
  state,
  setState,
  role,
  user
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  role?: string;
  user?: { username: string; role: string };
}) {
  const isOperator = role === 'operator';
  const operatorRoute = useMemo(() => {
    if (!isOperator || !user) return null;
    return (state.routes || []).find(r => r.name.toLowerCase() === user.username.toLowerCase());
  }, [isOperator, user, state.routes]);

  const [activeTab, setActiveTab] = useState<
    "directorio" | "missing" | "duplicates" | "isolated"
  >("directorio");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "valid">(
    "all",
  );
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "permanent" | "temporal" | "auto"
  >("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "name" | "sales_desc" | "sales_asc" | "visits_desc" | "visits_asc"
  >("sales_desc");

  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [editFreq, setEditFreq] = useState<number | null>(null);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editAssignmentType, setEditAssignmentType] = useState<
    "auto" | "temporal" | "permanent"
  >("auto");
  const [editAssignedRouteId, setEditAssignedRouteId] = useState<
    number | "none"
  >("none");
  const [editAssignedDay, setEditAssignedDay] = useState<string>("auto");
  const [editAssignedDays, setEditAssignedDays] = useState<string[]>([]);
  const [savingOverride, setSavingOverride] = useState(false);
  const [editLat, setEditLat] = useState<string>("");
  const [editLng, setEditLng] = useState<string>("");
  const [savingCoords, setSavingCoords] = useState(false);

  // Permisos para sincronización de Odoo y Google Sheets (Gerencia y Administrativo)
  const isGerenciaOrAdmin =
    role === 'admin' ||
    role === 'gerencia' ||
    user?.role === 'admin' ||
    user?.role === 'gerencia' ||
    role === 'supervisor' ||
    user?.role === 'supervisor';

  // Modal de sincronización de clientes Odoo ➔ Google Sheets
  const [showSyncClientsModal, setShowSyncClientsModal] = useState(false);
  const [singleClientQuery, setSingleClientQuery] = useState("");
  const [syncingSingleClient, setSyncingSingleClient] = useState(false);
  const [syncingAllClients, setSyncingAllClients] = useState(false);
  const [syncSingleResult, setSyncSingleResult] = useState<any>(null);
  const [syncSingleError, setSyncSingleError] = useState<string | null>(null);
  const [syncAllStatus, setSyncAllStatus] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  // Modal y estado para Reset Masivo a Automático
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetAllAssignments = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      const res = await apiFetch('/api/clients/reset-all-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const resetClients = state.clients.map((c) => ({
          ...c,
          assignedRouteId: null,
          permanentRouteId: null,
          assignedDay: null,
          permanentDay: null,
        }));

        const resetOverrides: any = { ...(state.clientOverrides || {}) };
        Object.keys(resetOverrides).forEach((cid) => {
          if (resetOverrides[cid]) {
            resetOverrides[cid].assignedRouteId = null;
            resetOverrides[cid].permanentRouteId = null;
            resetOverrides[cid].assignedDay = null;
            resetOverrides[cid].permanentDay = null;
          }
        });

        setState({
          ...state,
          clients: data.clients || resetClients,
          clientOverrides: data.clientOverrides || resetOverrides,
        });

        setResetSuccessMessage(data.message || '¡Todos los clientes han sido reseteados a Automático exitosamente!');
        setShowResetModal(false);
        setTimeout(() => setResetSuccessMessage(null), 8000);
      } else {
        setResetError(data.error || 'Error al resetear las asignaciones.');
      }
    } catch (err: any) {
      setResetError(err.message || 'Error de conexión al resetear asignaciones.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSyncSingleClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!singleClientQuery.trim()) return;
    try {
      setSyncingSingleClient(true);
      setSyncSingleError(null);
      setSyncSingleResult(null);
      const res = await apiFetch("/api/clients/sync-single-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: singleClientQuery.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "No se pudo actualizar el cliente desde Odoo");
      }
      setSyncSingleResult(data.client);
    } catch (err: any) {
      setSyncSingleError(err.message || "Error al conectar con Odoo");
    } finally {
      setSyncingSingleClient(false);
    }
  };

  const handleSyncAllClients = async () => {
    try {
      setSyncingAllClients(true);
      setSyncAllStatus(null);
      const res = await apiFetch("/api/clients/sync-odoo-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al sincronizar clientes");
      }
      setSyncAllStatus({
        success: true,
        count: data.count,
        message: data.message || `Sincronización completa: ${data.count} clientes actualizados en Google Sheets.`
      });
    } catch (err: any) {
      setSyncAllStatus({
        success: false,
        message: err.message || "Error en la sincronización de clientes"
      });
    } finally {
      setSyncingAllClients(false);
    }
  };

  const invalidClients = state.clients.filter(
    (c) => c.lat === 0 || c.lng === 0,
  );
  const validClients = state.clients.filter((c) => c.lat !== 0 && c.lng !== 0);

  const filteredClients = useMemo(() => {
    let list = state.clients;

    if (isOperator && operatorRoute) {
      list = list.filter((c) => {
        const rId = state.clientOverrides?.[c.id]?.permanentRouteId ?? state.clientOverrides?.[c.id]?.assignedRouteId ?? c.assignedRouteId;
        return rId === operatorRoute.id;
      });
    }

    if (statusFilter === "valid")
      list = list.filter((c) => c.lat !== 0 && c.lng !== 0);
    if (statusFilter === "missing")
      list = list.filter((c) => c.lat === 0 || c.lng === 0);

    if (assignmentFilter === "permanent") {
      list = list.filter((c) => {
        const pId = state.clientOverrides?.[c.id]?.permanentRouteId ?? c.permanentRouteId;
        return pId !== undefined && pId !== null;
      });
    } else if (assignmentFilter === "temporal") {
      list = list.filter((c) => {
        const pId = state.clientOverrides?.[c.id]?.permanentRouteId ?? c.permanentRouteId;
        const aId = state.clientOverrides?.[c.id]?.assignedRouteId ?? c.assignedRouteId;
        return (pId === undefined || pId === null) && aId !== undefined && aId !== null;
      });
    } else if (assignmentFilter === "auto") {
      list = list.filter((c) => {
        const pId = state.clientOverrides?.[c.id]?.permanentRouteId ?? c.permanentRouteId;
        const aId = state.clientOverrides?.[c.id]?.assignedRouteId ?? c.assignedRouteId;
        return (pId === undefined || pId === null) && (aId === undefined || aId === null);
      });
    }

    if (dayFilter !== "all") {
      if (dayFilter === "auto") {
        list = list.filter((c) => {
          const pDay = state.clientOverrides?.[c.id]?.permanentDay ?? c.permanentDay;
          const aDay = state.clientOverrides?.[c.id]?.assignedDay ?? c.assignedDay;
          return !pDay && !aDay;
        });
      } else {
        list = list.filter((c) => {
          const pDay = state.clientOverrides?.[c.id]?.permanentDay ?? c.permanentDay;
          const aDay = state.clientOverrides?.[c.id]?.assignedDay ?? c.assignedDay;
          return pDay === dayFilter || aDay === dayFilter;
        });
      }
    }

    if (searchTerm) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.city.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "sales_desc")
        return (b.salesVolume || 0) - (a.salesVolume || 0);
      if (sortBy === "sales_asc")
        return (a.salesVolume || 0) - (b.salesVolume || 0);
      if (sortBy === "visits_desc")
        return (b.visitFrequency || 0) - (a.visitFrequency || 0);
      if (sortBy === "visits_asc")
        return (a.visitFrequency || 0) - (b.visitFrequency || 0);
      return 0;
    });

    return list;
  }, [state.clients, state.clientOverrides, statusFilter, assignmentFilter, dayFilter, searchTerm, sortBy]);

  // Zonas Aisladas
  const cityCounts = new Map<string, number>();
  state.clients.forEach((c) => {
    const city = c.city?.trim() || "Desconocido";
    cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
  });
  const isolatedZones = state.clients.filter(
    (c) => cityCounts.get(c.city?.trim() || "Desconocido") === 1,
  );

  // Duplicados
  const locationMap = new Map<string, ClientData[]>();
  state.clients.forEach((c) => {
    if (c.lat !== 0 && c.lng !== 0) {
      const key = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
      if (!locationMap.has(key)) locationMap.set(key, []);
      locationMap.get(key)!.push(c);
    }
  });
  const duplicatedGroups = Array.from(locationMap.values()).filter(
    (group: any) => group.length > 1,
  );

  const openClientModal = (client: ClientData) => {
    setSelectedClient(client);
    setEditFreq(client.visitFrequency);
    setEditIsActive(client.isActive !== false);

    const permRoute = state.clientOverrides?.[client.id]?.permanentRouteId ?? client.permanentRouteId;
    const tempRoute = state.clientOverrides?.[client.id]?.assignedRouteId ?? client.assignedRouteId;
    const permDay = state.clientOverrides?.[client.id]?.permanentDay ?? client.permanentDay;
    const tempDay = state.clientOverrides?.[client.id]?.assignedDay ?? client.assignedDay;

    if (permRoute !== undefined && permRoute !== null) {
      setEditAssignmentType("permanent");
      setEditAssignedRouteId(permRoute);
    } else if (tempRoute !== undefined && tempRoute !== null) {
      setEditAssignmentType("temporal");
      setEditAssignedRouteId(tempRoute);
    } else {
      setEditAssignmentType("auto");
      setEditAssignedRouteId("none");
    }

    setEditAssignedDay(permDay || tempDay || "auto");

    const rawClientDays = state.clientOverrides?.[client.id]?.assignedDays || 
      state.clientOverrides?.[client.id]?.permanentDays || 
      (state.clientOverrides?.[client.id]?.permanentDay ? [state.clientOverrides[client.id].permanentDay] : []) ||
      (state.clientOverrides?.[client.id]?.assignedDay ? [state.clientOverrides[client.id].assignedDay] : []) ||
      (client.assignedDays || []) ||
      (client.assignedDay ? [client.assignedDay] : []);

    const initialDays = Array.isArray(rawClientDays) 
      ? rawClientDays.filter(Boolean) 
      : (rawClientDays ? [rawClientDays] : []);
    setEditAssignedDays(initialDays);

    setEditLat(client.lat ? client.lat.toString() : "");
    setEditLng(client.lng ? client.lng.toString() : "");
  };

  const toggleClientDay = (day: string) => {
    setEditAssignedDays(prev => {
      let newDays: string[];
      if (prev.includes(day)) {
        newDays = prev.filter(d => d !== day);
      } else {
        newDays = [...prev, day];
        if (newDays.length > (editFreq || 1)) {
          setEditFreq(newDays.length);
        }
      }
      const DAYS_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      newDays.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
      return newDays;
    });
  };

  const handleSaveOverride = async () => {
    if (selectedClient && editFreq !== null) {
      setSavingOverride(true);
      const updates: any = {
        visitFrequency: editFreq,
        isActive: editIsActive,
      };

      const primaryDay = editAssignedDays.length > 0 ? editAssignedDays[0] : (editAssignedDay === "auto" ? null : editAssignedDay);
      const selectedDaysVal = editAssignedDays.length > 0 ? editAssignedDays : (primaryDay ? [primaryDay] : null);

      if (editAssignmentType === "permanent") {
        updates.permanentRouteId = editAssignedRouteId === "none" ? null : editAssignedRouteId;
        updates.assignedRouteId = editAssignedRouteId === "none" ? null : editAssignedRouteId;
        updates.permanentDay = primaryDay;
        updates.assignedDay = primaryDay;
        updates.permanentDays = selectedDaysVal;
        updates.assignedDays = selectedDaysVal;
      } else if (editAssignmentType === "temporal") {
        updates.assignedRouteId = editAssignedRouteId === "none" ? null : editAssignedRouteId;
        updates.permanentRouteId = null;
        updates.assignedDay = primaryDay;
        updates.assignedDays = selectedDaysVal;
        updates.permanentDay = null;
        updates.permanentDays = null;
      } else {
        updates.assignedRouteId = null;
        updates.permanentRouteId = null;
        updates.assignedDay = primaryDay;
        updates.assignedDays = selectedDaysVal;
        updates.permanentDay = null;
        updates.permanentDays = null;
      }

      try {
        const res = await apiFetch(
          `/api/settings/client-overrides/${selectedClient.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          },
        );
        if (res.ok) {
          const data = await res.json();
          const overrides = { ...(state.clientOverrides || {}) };
          overrides[selectedClient.id] = data.clientOverrides;

          const newClients = state.clients.map((c) =>
            c.id === selectedClient.id ? data.client : c,
          );

          setState({
            ...state,
            clientOverrides: overrides,
            clients: newClients,
          });
          setSelectedClient(data.client);
        }
      } catch (err) {
        console.error(err);
      }
      setSavingOverride(false);
    }
  };

  const handleExportMissing = () => {
    const csvRows = [
      ["ID", "Nombre", "Ciudad", "Volumen Ventas"],
      ...invalidClients.map((c) => [
        c.id,
        `"${c.name}"`,
        `"${c.city}"`,
        c.salesVolume || 0,
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "clientes_sin_gps.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveCoords = async () => {
    if (!selectedClient) return;
    setSavingCoords(true);
    try {
      const res = await apiFetch(`/api/clients/${selectedClient.id}/coordinates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: parseFloat(editLat),
          lng: parseFloat(editLng),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newClients = state.clients.map((c) =>
          c.id === selectedClient.id ? data.client : c,
        );
        setState({ ...state, clients: newClients });
        setSelectedClient(data.client);
        alert("Coordenadas actualizadas en Odoo correctamente.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar en Odoo.");
    }
    setSavingCoords(false);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Directorio y Análisis de Clientes
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Catálogo de clientes con respaldo automático en Google Sheets y sincronización diaria desde Odoo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Enlace Directo Catálogo Clientes Google Sheets */}
            <a
              href="https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit#gid=469382534"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Abrir pestaña Catalogo_Clientes en Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Catálogo Clientes Sheets</span>
              <ExternalLink className="w-3 h-3 text-emerald-600 ml-0.5" />
            </a>

            {/* Botón Exclusivo Gerencia y Administrativo para Sincronizar Clientes de Odoo */}
            {isGerenciaOrAdmin && (
              <button
                onClick={() => {
                  setShowSyncClientsModal(true);
                  setSyncSingleResult(null);
                  setSyncSingleError(null);
                  setSyncAllStatus(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Actualizar clientes y rutas directamente desde Odoo a Sheets y la app"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Actualizar de Odoo</span>
              </button>
            )}

            {/* Botón de Reset Masivo a Automático para Administrador, Gerencia y Supervisores */}
            {isGerenciaOrAdmin && (
              <button
                onClick={() => {
                  setShowResetModal(true);
                  setResetError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Resetear masivamente todos los clientes a Modalidad Automática y Día Automático"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Masivo Automático</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner de confirmación de Reset exitoso */}
        {resetSuccessMessage && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{resetSuccessMessage}</span>
            </div>
            <button
              onClick={() => setResetSuccessMessage(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
          <button
            onClick={() => setActiveTab("directorio")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "directorio" ? "bg-blue-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Users className="w-4 h-4" /> Todos
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "directorio" ? "bg-blue-700/50" : "bg-slate-100"}`}
            >
              {state.clients.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("missing")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "missing" ? "bg-amber-500 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <MapPinOff className="w-4 h-4" /> Sin GPS
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "missing" ? "bg-amber-600/50" : "bg-slate-100 text-amber-600"}`}
            >
              {invalidClients.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "duplicates" ? "bg-rose-500 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Copy className="w-4 h-4" /> Duplicados
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "duplicates" ? "bg-rose-600/50" : "bg-slate-100 text-rose-600"}`}
            >
              {duplicatedGroups.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("isolated")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "isolated" ? "bg-purple-500 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <AlertCircle className="w-4 h-4" /> Zonas Aisladas
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "isolated" ? "bg-purple-600/50" : "bg-slate-100 text-purple-600"}`}
            >
              {isolatedZones.length}
            </span>
          </button>
        </div>
      </header>

      {activeTab === "directorio" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
            <div className="relative w-full sm:w-80">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente, ciudad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="sales_desc">Mayor Venta</option>
                <option value="sales_asc">Menor Venta</option>
                <option value="visits_desc">Más Visitas</option>
                <option value="visits_asc">Menos Visitas</option>
                <option value="name">Nombre A-Z</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Todos los estados GPS</option>
                <option value="valid">Solo GPS Válido</option>
                <option value="missing">Solo sin GPS</option>
              </select>
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Todas las asignaciones</option>
                <option value="permanent">🔒 Solo Fidelizados (Permanentes)</option>
                <option value="temporal">⏱️ Solo Temporales</option>
                <option value="auto">⚡ Solo Automáticos</option>
              </select>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Todos los días</option>
                <option value="Lunes">📅 Lunes</option>
                <option value="Martes">📅 Martes</option>
                <option value="Miércoles">📅 Miércoles</option>
                <option value="Jueves">📅 Jueves</option>
                <option value="Viernes">📅 Viernes</option>
                <option value="Sábado">📅 Sábado</option>
                <option value="auto">⚡ Sin día fijo (Histórico)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ciudad / Zona
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ventas
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Visitas
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ruta y Día Asignado
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Estado GPS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const hasLocation = client.lat !== 0 && client.lng !== 0;
                  const permRouteId = state.clientOverrides?.[client.id]?.permanentRouteId ?? client.permanentRouteId;
                  const tempRouteId = state.clientOverrides?.[client.id]?.assignedRouteId ?? client.assignedRouteId;
                  const permDay = state.clientOverrides?.[client.id]?.permanentDay ?? client.permanentDay;
                  const tempDay = state.clientOverrides?.[client.id]?.assignedDay ?? client.assignedDay;
                  const assignedDay = permDay || tempDay;
                  const permRoute = permRouteId ? state.routes.find((r) => r.id === permRouteId) : null;
                  const tempRoute = tempRouteId ? state.routes.find((r) => r.id === tempRouteId) : null;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => openClientModal(client)}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">
                          {client.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {client.street}
                        </p>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        {(() => {
                          const cType = state.clientOverrides?.[client.id]?.clientType || client.clientType;
                          if (cType === 'company') {
                            return <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs font-medium border border-indigo-100"><Briefcase className="w-3 h-3"/> Empresa</span>;
                          } else if (cType === 'person') {
                            return <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium border border-emerald-100"><Users className="w-3 h-3"/> Individual</span>;
                          } else {
                            return <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">No Definido</span>;
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {client.city}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-800">
                          ${(client.salesVolume || 0).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                          {client.visitFrequency}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {permRoute ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 w-fit" title="Fidelizado permanentemente a esta ruta">
                              <Lock className="w-3 h-3 text-purple-600" /> {permRoute.name}
                            </span>
                          ) : tempRoute ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200 w-fit" title="Asignación temporal para esta semana">
                              <Clock className="w-3 h-3 text-sky-600" /> Temp: {tempRoute.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium w-fit" title="Balanceo dinámico automático">
                              <Zap className="w-3 h-3 text-slate-400" /> Auto
                            </span>
                          )}

                          {assignedDay ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 w-fit" title="Día fijo programado">
                              <Calendar className="w-3 h-3 text-indigo-500" /> {assignedDay}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Día: Histórico</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {hasLocation ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{" "}
                            Validado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                            <AlertTriangle className="w-3 h-3" /> Faltante
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "missing" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-slate-100 bg-amber-50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-amber-900">
                Clientes sin GPS
              </h3>
              <p className="text-amber-700 text-sm">
                Estos clientes no se pueden planificar en las rutas.
              </p>
            </div>
            <button
              onClick={handleExportMissing}
              className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 rounded-xl font-bold border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>
          <div className="overflow-y-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Cliente</th>
                  <th className="px-6 py-3 font-semibold text-right">
                    Volumen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invalidClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openClientModal(client)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">
                        {client.name}
                      </p>
                      <p className="text-xs text-slate-500">{client.city}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-slate-700">
                        ${(client.salesVolume || 0).toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))}
                {invalidClients.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No hay clientes sin GPS
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "duplicates" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-slate-100 bg-rose-50">
            <h3 className="text-lg font-bold text-rose-900">
              Posibles Duplicados (Misma coordenada)
            </h3>
          </div>
          <div className="overflow-y-auto p-4 space-y-4">
            {duplicatedGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No se detectaron duplicados.
              </div>
            ) : (
              duplicatedGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 rounded-xl p-4 border border-slate-200"
                >
                  <p className="text-xs font-bold text-slate-500 mb-2">
                    Ubicación: {group[0].lat.toFixed(4)},{" "}
                    {group[0].lng.toFixed(4)}
                  </p>
                  <div className="space-y-2">
                    {(group as any).map((c: any) => (
                      <div
                        key={c.id}
                        className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300"
                        onClick={() => openClientModal(c)}
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {c.name}
                          </p>
                          <p className="text-xs text-slate-500">ID: {c.id}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-600">
                          ${(c.salesVolume || 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "isolated" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-slate-100 bg-purple-50">
            <h3 className="text-lg font-bold text-purple-900">
              Zonas Aisladas
            </h3>
            <p className="text-purple-700 text-sm">
              Ciudades o zonas con un solo cliente.
            </p>
          </div>
          <div className="overflow-y-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Cliente</th>
                  <th className="px-6 py-3 font-semibold">Zona Única</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isolatedZones.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openClientModal(client)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">
                        {client.name}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-purple-700 bg-purple-100 inline-block px-2 py-1 rounded-md">
                        {client.city?.trim() || "Desconocido"}
                      </p>
                    </td>
                  </tr>
                ))}
                {isolatedZones.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No hay zonas aisladas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client Profile / Edit Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {selectedClient.name}
                </h2>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {selectedClient.city}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Volumen Ventas
                  </p>
                  <p className="text-xl font-bold text-slate-800">
                    ${(selectedClient.salesVolume || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                    Visitas Sugeridas
                  </p>
                  <p className="text-xl font-bold text-blue-900">
                    {selectedClient.visitFrequency}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Ajuste Manual de Frecuencia (por semana)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={editFreq || ""}
                    onChange={(e) => setEditFreq(parseInt(e.target.value) || 1)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                  />
                </div>
              </div>

              {/* Fidelización / Asignación de Ruta */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">
                  Modalidad de Asignación a Ruta
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Automático */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditAssignmentType("auto");
                      setEditAssignedRouteId("none");
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${editAssignmentType === "auto" ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Zap className={`w-4 h-4 ${editAssignmentType === "auto" ? "text-blue-600" : "text-slate-400"}`} />
                      {editAssignmentType === "auto" && <div className="w-2 h-2 rounded-full bg-blue-600"></div>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">⚡ Automático</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Balanceo dinámico semanal según demanda.</p>
                    </div>
                  </button>

                  {/* Temporal */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditAssignmentType("temporal");
                      if (editAssignedRouteId === "none" && state.routes.length > 0) {
                        setEditAssignedRouteId(state.routes[0].id);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${editAssignmentType === "temporal" ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Clock className={`w-4 h-4 ${editAssignmentType === "temporal" ? "text-sky-600" : "text-slate-400"}`} />
                      {editAssignmentType === "temporal" && <div className="w-2 h-2 rounded-full bg-sky-600"></div>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">⏱️ Temporal</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Asignar solo para esta semana actual.</p>
                    </div>
                  </button>

                  {/* Fidelizado Permanente */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditAssignmentType("permanent");
                      if (editAssignedRouteId === "none" && state.routes.length > 0) {
                        setEditAssignedRouteId(state.routes[0].id);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${editAssignmentType === "permanent" ? "border-purple-600 bg-purple-50 ring-2 ring-purple-600/20" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Lock className={`w-4 h-4 ${editAssignmentType === "permanent" ? "text-purple-600" : "text-slate-400"}`} />
                      {editAssignmentType === "permanent" && <div className="w-2 h-2 rounded-full bg-purple-600"></div>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-900">🔒 Fidelizado</p>
                      <p className="text-[11px] text-purple-700/80 mt-0.5">Fijo 100% permanente a esta ruta.</p>
                    </div>
                  </button>
                </div>

                {editAssignmentType !== "auto" && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {editAssignmentType === "permanent" ? "🔒 Seleccionar Ruta Fidelizada Permanente" : "⏱️ Seleccionar Ruta Temporal (Esta semana)"}
                    </label>
                    <select
                      value={editAssignedRouteId}
                      onChange={(e) =>
                        setEditAssignedRouteId(
                          e.target.value === "none"
                            ? "none"
                            : parseInt(e.target.value),
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                    >
                      <option value="none">Seleccione una ruta...</option>
                      {state.routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Selección de Días Específicos de Visita según Frecuencia */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Días Específicos de Visita ({editFreq || 1} {(editFreq || 1) === 1 ? 'visita' : 'visitas'})
                  </label>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    editAssignedDays.length === (editFreq || 1)
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : editAssignedDays.length === 0
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}>
                    {editAssignedDays.length === 0 
                      ? '⚡ Automático' 
                      : `${editAssignedDays.length} de ${editFreq || 1} ${(editFreq || 1) === 1 ? 'día asignado' : 'días asignados'}`}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-3">
                  {(editFreq || 1) > 1 
                    ? `Este cliente tiene ${editFreq} visitas por semana. Activa los ${editFreq} días en los que debe surtirse:`
                    : `Activa el día específico de visita o déjalo en automático:`}
                </p>

                {/* Pills de selección de días: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day) => {
                    const isSelected = editAssignedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleClientDay(day)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all shadow-2xs flex flex-col items-center justify-center gap-1 border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{day}</span>
                        <span className={`text-[10px] font-semibold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {isSelected ? '✓ Activo' : 'Inactivo'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {editAssignedDays.length > 0 && (
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                    <span>Días seleccionados: <strong className="text-slate-800">{editAssignedDays.join(', ')}</strong></span>
                    <button
                      type="button"
                      onClick={() => setEditAssignedDays([])}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Restablecer a Automático
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-6 h-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    Cliente Activo (Surtir)
                  </span>
                </label>
                <p className="text-xs text-slate-500 ml-9 mt-1">
                  Si se desactiva, el algoritmo ignorará a este cliente en la
                  planeación.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                disabled={savingOverride}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={savingOverride}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {savingOverride ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE ACTUALIZACIÓN DE CLIENTES ODOO & SHEETS (GERENCIA Y ADMINISTRATIVO) */}
      {showSyncClientsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-100 text-blue-800 rounded-2xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900">Actualizar Catálogo de Clientes</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                      Gerencia & Administrativo
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Sincronización en tiempo real con Odoo y respaldo en Google Sheets
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncClientsModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Respaldo */}
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
              <div className="flex items-start gap-2 text-slate-700">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Información sincronizada: </span>
                  Se extraen ID de Odoo, nombre del negocio, ruta asignada del vendedor (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">user_id</code>), día de visita programado en notas, municipio, estado, dirección completa, teléfonos y coordenadas GPS.
                </div>
              </div>
              <div className="flex items-start gap-2 text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Respaldo ante caídas de Odoo: </span>
                  El directorio completo se respalda automáticamente en la hoja <span className="font-bold text-emerald-800">Catalogo_Clientes</span> de Google Sheets todas las madrugadas (03:40 AM). Si Odoo no responde, la app sigue ruteando con los clientes de Sheets.
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: ACTUALIZAR CLIENTE ESPECÍFICO */}
            <div className="mt-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>1. Actualizar Cliente Específico desde Odoo</span>
              </h3>
              <form onSubmit={handleSyncSingleClient} className="flex gap-2">
                <input
                  type="text"
                  value={singleClientQuery}
                  onChange={(e) => setSingleClientQuery(e.target.value)}
                  placeholder="Nombre, ID o referencia del cliente en Odoo (ej. 2109 o Lonches Y Snack)"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={syncingSingleClient || !singleClientQuery.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingSingleClient ? 'animate-spin' : ''}`} />
                  <span>{syncingSingleClient ? 'Buscando...' : 'Actualizar'}</span>
                </button>
              </form>

              {/* Resultado del Cliente Actualizado */}
              {syncSingleResult && (
                <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl animate-fadeIn">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>¡Cliente actualizado desde Odoo y sincronizado en Google Sheets!</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-emerald-200/60">
                      <span className="text-[10px] text-slate-400 block">ID Odoo:</span>
                      <span className="font-mono font-black text-slate-800">{syncSingleResult.id}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-200/60">
                      <span className="text-[10px] text-slate-400 block">Ruta:</span>
                      <span className="font-bold text-blue-700 truncate block">
                        {syncSingleResult.rutaAsignada || 'Sin ruta'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-200/60">
                      <span className="text-[10px] text-slate-400 block">Día Visita:</span>
                      <span className="font-black text-indigo-700">{syncSingleResult.diaVisita || 'No definido'}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-200/60">
                      <span className="text-[10px] text-slate-400 block">Municipio:</span>
                      <span className="font-bold text-slate-800 truncate block">{syncSingleResult.municipio || 'Sin municipio'}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-700 font-medium">
                    <span className="font-bold">Cliente:</span> {syncSingleResult.name}
                  </div>
                  {syncSingleResult.lat && syncSingleResult.lng && (
                    <div className="mt-1 text-[10px] font-mono text-emerald-700">
                      📍 GPS: {syncSingleResult.lat}, {syncSingleResult.lng}
                    </div>
                  )}
                </div>
              )}

              {syncSingleError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{syncSingleError}</span>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: SINCRONIZACIÓN MASIVA COMPLETA */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>2. Sincronizar Catálogo Completo Odoo ➔ Sheets</span>
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                Lee todos los clientes activos desde Odoo con sus datos de contacto, coordenadas y rutas, y los respalda en la pestaña <span className="font-bold">Catalogo_Clientes</span> de Google Sheets.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSyncAllClients}
                  disabled={syncingAllClients}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAllClients ? 'animate-spin' : ''}`} />
                  <span>{syncingAllClients ? 'Sincronizando con Odoo & Sheets...' : 'Sincronizar Todo el Directorio Ahora'}</span>
                </button>

                <a
                  href="https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit#gid=469382534"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Abrir Hoja Catalogo_Clientes</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
                </a>
              </div>

              {syncAllStatus && (
                <div className={`mt-3 p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn ${
                  syncAllStatus.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}>
                  {syncAllStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span>{syncAllStatus.message}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSyncClientsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESET MASIVO DE ASIGNACIONES (SUPERVISOR, ADMIN Y GERENCIA) */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Reset Masivo de Asignaciones</h2>
                  <p className="text-xs text-slate-500">
                    Restablecer todos los clientes a Ruta y Día Automático
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2.5">
              <div className="flex items-start gap-2 text-amber-900 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>¿Deseas reiniciar las rutas y días de todos los clientes a modo Automático?</span>
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                Esta acción restablece masivamente la <b>Modalidad de Asignación a Ruta</b> a <code>⚡ Automático</code> y el <b>Día Específico de Visita</b> a <code>⚡ Automático</code> para todos los <b>{state.clients.length} clientes</b>.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Quedarán en modo de balanceo dinámico según la demanda y el histórico de ventas de Odoo, listos para que los supervisores los asignen manualmente a rutas específicas según la operación productiva.
              </p>
            </div>

            {resetError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetAllAssignments}
                disabled={isResetting}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'Reseteando clientes...' : 'Sí, Resetear a Automático'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
