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
} from "lucide-react";

export default function ClientsView({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
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
  const [savingOverride, setSavingOverride] = useState(false);
  const [editLat, setEditLat] = useState<string>("");
  const [editLng, setEditLng] = useState<string>("");
  const [savingCoords, setSavingCoords] = useState(false);

  const invalidClients = state.clients.filter(
    (c) => c.lat === 0 || c.lng === 0,
  );
  const validClients = state.clients.filter((c) => c.lat !== 0 && c.lng !== 0);

  const filteredClients = useMemo(() => {
    let list = state.clients;

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
  }, [state.clients, state.clientOverrides, statusFilter, assignmentFilter, searchTerm, sortBy]);

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

    setEditLat(client.lat ? client.lat.toString() : "");
    setEditLng(client.lng ? client.lng.toString() : "");
  };

  const handleSaveOverride = async () => {
    if (selectedClient && editFreq !== null) {
      setSavingOverride(true);
      const updates: any = {
        visitFrequency: editFreq,
        isActive: editIsActive,
      };

      if (editAssignmentType === "permanent") {
        updates.permanentRouteId = editAssignedRouteId === "none" ? null : editAssignedRouteId;
        updates.assignedRouteId = editAssignedRouteId === "none" ? null : editAssignedRouteId;
      } else if (editAssignmentType === "temporal") {
        updates.assignedRouteId = editAssignedRouteId === "none" ? null : editAssignedRouteId;
        updates.permanentRouteId = null;
      } else {
        updates.assignedRouteId = null;
        updates.permanentRouteId = null;
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
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Directorio y Análisis
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Revisa el estado de la información, ventas y frecuencias
          </p>
        </div>

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
                    Asignación Ruta
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
                        {permRoute ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200" title="Fidelizado permanentemente a esta ruta">
                            <Lock className="w-3 h-3 text-purple-600" /> {permRoute.name}
                          </span>
                        ) : tempRoute ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200" title="Asignación temporal para esta semana">
                            <Clock className="w-3 h-3 text-sky-600" /> Temp: {tempRoute.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium" title="Balanceo dinámico automático">
                            <Zap className="w-3 h-3 text-slate-400" /> Auto
                          </span>
                        )}
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
    </div>
  );
}
