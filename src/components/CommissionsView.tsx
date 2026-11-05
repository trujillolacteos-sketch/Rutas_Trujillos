import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from '../lib/api';
import {
  DollarSign,
  Users,
  Briefcase,
  RefreshCw,
  Calculator,
  Calendar,
  Map as MapIcon,
  Truck,
  Printer,
  Share2,
  Edit3,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Wallet
} from "lucide-react";
import { AppState } from "../types";

export interface NominaRutaItem {
  routeId: string;
  routeName: string;
  empleadoId?: string;
  empleadoNombre: string;
  telefono?: string;
  salarioBase: number;
  totalVentaSemanal: number;
  comisionRate: number;
  comisionMonto: number;
  ventasPorDia: {
    lunes: { efectivo: number; transferencias: number; total: number; tickets: number };
    martes: { efectivo: number; transferencias: number; total: number; tickets: number };
    miercoles: { efectivo: number; transferencias: number; total: number; tickets: number };
    jueves: { efectivo: number; transferencias: number; total: number; tickets: number };
    viernes: { efectivo: number; transferencias: number; total: number; tickets: number };
    sabado: { efectivo: number; transferencias: number; total: number; tickets: number };
    domingo: { efectivo: number; transferencias: number; total: number; tickets: number };
  };
  bonosExtras: number;
  pagosPendientes: number;
  prestamos: number;
  faltas: number;
  faltasMonto: number;
  gasolina: number;
  tienda: number;
  notasQueseria: number;
  cobrosPendientes: number;
  abonos: number;
  percepciones: number;
  descuentos: number;
  pagoFinal: number;
  saldoPrestamoAnterior: number;
  saldoPrestamoActual: number;
  whatsAppMsg: string;
  linkWhatsApp: string;
}

export interface RHEmpleadoSimple {
  id: string;
  numeroEmpleado: string;
  nombreCompleto: string;
  puesto: string;
  departamento: string;
  sueldoBase: number;
  tipoSalario: string;
  telefono?: string;
  status: 'activo' | 'baja';
}

const formatMoney = (val?: number): string => {
  if (val === undefined || val === null || isNaN(val)) return "$0.00";
  return "$" + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getWeekNumber = (d: string | Date | number) => {
  if (!d) return 0;
  try {
    const date = typeof d === 'string' && !d.includes('T') ? new Date(d + 'T00:00:00') : new Date(d);
    date.setHours(0, 0, 0, 0);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    const pastDaysOfYear = Math.round((date.getTime() - startOfYear.getTime()) / 86400000);
    return Math.floor((pastDaysOfYear + startOfYear.getDay()) / 7) + 1;
  } catch {
    return 0;
  }
};

export default function CommissionsView({
  token,
  state,
  role,
  user
}: {
  token: string;
  state: AppState;
  role?: string;
  user?: { username: string; role: string };
}) {
  const isOperator = role === 'operator';
  const operatorRoute = user?.username || "";
  const isRHOrAdmin = ['admin', 'gerencia', 'rh', 'recursos_humanos'].includes(role || '') || !role;

  const [commissions, setCommissions] = useState<any[]>([]);
  const [nominaRutas, setNominaRutas] = useState<NominaRutaItem[]>([]);
  const [rhEmpleados, setRhEmpleados] = useState<RHEmpleadoSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [assigningRoute, setAssigningRoute] = useState<string | null>(null);

  const currentWeekStr = "Semana " + getWeekNumber(new Date());
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStr);
  const [activeTab, setActiveTab] = useState<string>(isOperator ? (operatorRoute || "Ruta 1") : "ALL");

  // Modal para editar ajustes variables de la ruta
  const [editingRuta, setEditingRuta] = useState<NominaRutaItem | null>(null);
  const [ajustesForm, setAjustesForm] = useState({
    bonosExtras: 0,
    pagosPendientes: 0,
    prestamos: 0,
    faltas: 0,
    gasolina: 0,
    tienda: 0,
    notasQueseria: 0,
    cobrosPendientes: 0,
    abonos: 0,
    salarioBase: 0
  });
  const [savingAjustes, setSavingAjustes] = useState(false);

  // Modal para imprimir / ver recibo individual
  const [viewingReceipt, setViewingReceipt] = useState<NominaRutaItem | null>(null);

  // Colapsar tickets de Odoo
  const [showTicketsTable, setShowTicketsTable] = useState(false);

  useEffect(() => {
    if (isOperator && operatorRoute) {
      setActiveTab(operatorRoute);
    }
  }, [isOperator, operatorRoute]);

  // Semanas disponibles
  const weeks = useMemo(() => {
    const w = new Set<string>();
    for (const c of commissions || []) {
      w.add(`Semana ${getWeekNumber(c.dateOrder)}`);
    }
    w.add(currentWeekStr);
    return Array.from(w).sort((a, b) => parseInt(b.split(" ")[1]) - parseInt(a.split(" ")[1]));
  }, [commissions, currentWeekStr]);

  // Carga inicial
  useEffect(() => {
    fetchData();
  }, [token, selectedWeek]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = "Bearer " + token;

      // 1. Cargar tickets de comisiones
      const resComm = await apiFetch("/api/commissions", { headers });
      if (resComm.ok) {
        const dataComm = await resComm.json();
        setCommissions(Array.isArray(dataComm) ? dataComm : []);
      }

      // 2. Cargar colaboradores de RH (para asignar choferes a rutas)
      if (isRHOrAdmin) {
        try {
          const resRH = await apiFetch("/api/rh/empleados", { headers });
          if (resRH.ok) {
            const dataRH = await resRH.json();
            setRhEmpleados(Array.isArray(dataRH) ? dataRH : (dataRH.empleados || []));
          }
        } catch (rhErr) {
          console.warn("Could not load RH empleados:", rhErr);
        }
      }

      // 3. Cargar nómina de rutas consolidada
      await fetchNominaRutas();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const fetchNominaRutas = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      const res = await apiFetch(`/api/rh/nomina-rutas?semanaId=${encodeURIComponent(selectedWeek)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.rutas)) {
          setNominaRutas(json.rutas);
        }
      }
    } catch (err) {
      console.error("Error fetching nomina rutas:", err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      await apiFetch("/api/commissions/sync", {
        method: "POST",
        headers,
      });
      await fetchData();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setSyncing(false);
    }
  };

  // Asignar colaborador de RH a una ruta
  const handleAssignEmpleado = async (routeId: string, empleadoNombre: string) => {
    if (!isRHOrAdmin) return;
    setAssigningRoute(routeId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      // Buscar si el empleado seleccionado existe en RH para tomar su sueldo
      const empObj = rhEmpleados.find(e => e.nombreCompleto === empleadoNombre);
      const updates: any = {
        empleadoNombre,
        semanaId: selectedWeek
      };
      if (empObj && empObj.sueldoBase > 0) {
        updates.salarioBase = empObj.sueldoBase;
      }

      const res = await apiFetch(`/api/rh/nomina-rutas/${encodeURIComponent(routeId)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        await fetchNominaRutas();
      }
    } catch (err) {
      console.error("Error assigning employee to route:", err);
    } finally {
      setAssigningRoute(null);
    }
  };

  // Abrir modal de ajustes de una ruta
  const handleOpenAjustes = (r: NominaRutaItem) => {
    setEditingRuta(r);
    setAjustesForm({
      bonosExtras: r.bonosExtras || 0,
      pagosPendientes: r.pagosPendientes || 0,
      prestamos: r.prestamos || 0,
      faltas: r.faltas || 0,
      gasolina: r.gasolina || 0,
      tienda: r.tienda || 0,
      notasQueseria: r.notasQueseria || 0,
      cobrosPendientes: r.cobrosPendientes || 0,
      abonos: r.abonos || 0,
      salarioBase: r.salarioBase || 0
    });
  };

  // Guardar ajustes de la ruta
  const handleSaveAjustes = async () => {
    if (!editingRuta) return;
    setSavingAjustes(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      const res = await apiFetch(`/api/rh/nomina-rutas/${encodeURIComponent(editingRuta.routeId)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...ajustesForm,
          semanaId: selectedWeek
        })
      });

      if (res.ok) {
        await fetchNominaRutas();
        setEditingRuta(null);
      } else {
        const data = await res.json();
        alert(data.error || "Error al guardar ajustes");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSavingAjustes(false);
    }
  };

  // Toggle cliente tipo ticket de Odoo
  const toggleClientType = async (id: number, clientId: number, currentType: string) => {
    if (isOperator) return;
    try {
      const newType = currentType === "company" ? "person" : "company";
      setCommissions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, clientType: newType } : c))
      );

      const res = await apiFetch(`/api/commissions/${id}/toggle-type`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ clientType: newType, clientId }),
      });
      if (res.ok) {
        fetchNominaRutas();
      }
    } catch (e) {
      console.error(e);
      fetchData();
    }
  };

  // Totales de todas las rutas
  const summary = useMemo(() => {
    let totalVentas = 0;
    let totalComisiones = 0;
    let totalPagos = 0;
    let totalPrestamosSaldos = 0;

    nominaRutas.forEach((r) => {
      totalVentas += r.totalVentaSemanal || 0;
      totalComisiones += r.comisionMonto || 0;
      totalPagos += r.pagoFinal || 0;
      totalPrestamosSaldos += r.saldoPrestamoActual || 0;
    });

    return { totalVentas, totalComisiones, totalPagos, totalPrestamosSaldos };
  }, [nominaRutas]);

  // Empleados de RH activos y ruteros
  const empleadosActivosRH = useMemo(() => {
    return rhEmpleados.filter(e => e.status !== 'baja');
  }, [rhEmpleados]);

  // Ruta seleccionada para la vista individual
  const activeRouteItem = useMemo(() => {
    if (activeTab === "ALL") return null;
    return nominaRutas.find(r => r.routeName === activeTab || r.routeId === activeTab);
  }, [nominaRutas, activeTab]);

  if (loading && nominaRutas.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
        Cargando nómina y comisiones de rutas...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Estilos para impresión individual del formato reciboruta */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-recibo-ruta, #printable-recibo-ruta * {
            visibility: visible;
          }
          #printable-recibo-ruta {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15px;
            background: white !important;
          }
        }
      `}</style>

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                {isOperator ? `Nómina de Mi Ruta (${operatorRoute})` : 'Nómina y Comisiones de Rutas'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isOperator
                  ? 'Desglose detallado de ventas por día, comisiones y recibo oficial de nómina.'
                  : 'Gestión individual de nómina por chofer con formato oficial de recibo de ruta.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de semana */}
          <div className="relative">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm cursor-pointer"
            >
              <option value="ALL">Todas las semanas</option>
              {weeks.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sincronizar Odoo */}
          {!isOperator && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Odoo"}
            </button>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Ventas Totales</p>
            <p className="text-lg font-black text-slate-900">{formatMoney(summary.totalVentas)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Comisiones (2.5%)</p>
            <p className="text-lg font-black text-emerald-700">{formatMoney(summary.totalComisiones)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Pago Neto a Repartidores</p>
            <p className="text-lg font-black text-indigo-700">{formatMoney(summary.totalPagos)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Deuda Préstamos Activa</p>
            <p className="text-lg font-black text-amber-700">{formatMoney(summary.totalPrestamosSaldos)}</p>
          </div>
        </div>
      </div>

      {/* TABS DE SELECCIÓN DE RUTAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {!isOperator && (
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-5 py-3.5 font-black text-xs whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === 'ALL'
                  ? 'text-emerald-700 border-emerald-600 bg-white'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Resumen General de Rutas</span>
            </button>
            {nominaRutas.map((r) => (
              <button
                key={r.routeId}
                onClick={() => setActiveTab(r.routeName)}
                className={`px-5 py-3.5 font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
                  activeTab === r.routeName
                    ? 'text-emerald-700 border-emerald-600 bg-white shadow-sm'
                    : 'text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span>{r.routeName}</span>
                {r.empleadoNombre && (
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-full">
                    {r.empleadoNombre.split(' ')[0]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* VISTA 1: RESUMEN GENERAL (TABLA DE TODAS LAS RUTAS) */}
          {activeTab === 'ALL' && !isOperator ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Nómina Consolidada por Ruta • {selectedWeek}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asigna el colaborador del Padrón de RH directamente en el selector de cada fila.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Ruta</th>
                      <th className="p-3 min-w-[200px]">Chofer Asignado (RH)</th>
                      <th className="p-3 text-right">Sueldo Base</th>
                      <th className="p-3 text-right">Venta Semanal</th>
                      <th className="p-3 text-right">Comisión (2.5%)</th>
                      <th className="p-3 text-right">Percepciones</th>
                      <th className="p-3 text-right">Deducciones</th>
                      <th className="p-3 text-right">Saldo Préstamo</th>
                      <th className="p-3 text-right bg-emerald-50 text-emerald-900">Total a Pagar</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nominaRutas.map((r) => (
                      <tr key={r.routeId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-black text-slate-900 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{r.routeName}</span>
                        </td>
                        <td className="p-3">
                          {/* Selector directo de colaborador RH */}
                          <div className="relative">
                            <select
                              value={r.empleadoNombre || ""}
                              onChange={(e) => handleAssignEmpleado(r.routeId, e.target.value)}
                              disabled={assigningRoute === r.routeId}
                              className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border appearance-none outline-none focus:ring-2 focus:ring-emerald-500 ${
                                r.empleadoNombre
                                  ? 'bg-emerald-50/40 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="">-- Sin chofer asignado --</option>
                              {empleadosActivosRH.map((emp) => (
                                <option key={emp.id} value={emp.nombreCompleto}>
                                  {emp.nombreCompleto} {emp.tipoSalario === 'rutero' ? '⭐ (Rutero)' : `(${emp.puesto || emp.tipoSalario})`}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-slate-700">
                          {formatMoney(r.salarioBase)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {formatMoney(r.totalVentaSemanal)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          +{formatMoney(r.comisionMonto)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">
                          {formatMoney(r.percepciones)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          -{formatMoney(r.descuentos)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-800">
                          {formatMoney(r.saldoPrestamoActual)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-sm text-emerald-800 bg-emerald-50/50">
                          {formatMoney(r.pagoFinal)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setActiveTab(r.routeName)}
                              title="Ver formato individual reciboruta"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenAjustes(r)}
                              title="Modificar ajustes manuales (gasolina, bonos, préstamos)"
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {r.linkWhatsApp && (
                              <a
                                href={r.linkWhatsApp}
                                target="_blank"
                                rel="noreferrer"
                                title="Enviar recibo por WhatsApp"
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VISTA 2: FORMATO INDIVIDUAL RECIBO RUTA (EL FORMATO EXACTO DE reciboruta.docx) */
            activeRouteItem ? (
              <div className="space-y-6">
                {/* BARRA SUPERIOR DE ACCIONES DE LA RUTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-black text-sm">
                      {activeRouteItem.routeName}
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-bold block">Chofer Vinculado:</span>
                      <span className="text-sm font-black text-slate-900">
                        {activeRouteItem.empleadoNombre || "Sin asignar"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRHOrAdmin && (
                      <button
                        onClick={() => handleOpenAjustes(activeRouteItem)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Ajustes</span>
                      </button>
                    )}
                    {activeRouteItem.linkWhatsApp && (
                      <a
                        href={activeRouteItem.linkWhatsApp}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp Recibo</span>
                      </a>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                  </div>
                </div>

                {/* CONTENEDOR DEL RECIBO CON EL FORMATO OFICIAL reciboruta.docx */}
                <div
                  id="printable-recibo-ruta"
                  className="bg-white border-2 border-slate-900 rounded-2xl p-6 sm:p-8 max-w-4xl mx-auto font-sans text-slate-900 shadow-sm"
                >
                  {/* Encabezado Lácteos Trujillos */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
                    <div className="flex items-center gap-4">
                      <img
                        src="/logo-trujillos.png"
                        alt="Lácteos Trujillos"
                        className="h-14 w-auto object-contain"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                      <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-900">
                          LÁCTEOS TRUJILLOS
                        </h2>
                        <p className="text-xs text-slate-600 font-extrabold uppercase tracking-widest">
                          Recibo de Nómina • Ventas-Ruta
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900 uppercase">
                        {selectedWeek}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Ruta: <span className="font-bold text-slate-800">{activeRouteItem.routeName}</span>
                      </div>
                      <div className="text-xs font-bold text-emerald-800">
                        Fecha: {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Ficha de Información del Colaborador */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Colaborador / Chofer:
                      </span>
                      {isRHOrAdmin ? (
                        <div className="relative">
                          <select
                            value={activeRouteItem.empleadoNombre || ""}
                            onChange={(e) => handleAssignEmpleado(activeRouteItem.routeId, e.target.value)}
                            className="w-full text-xs font-black text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Asignar colaborador de RH --</option>
                            {empleadosActivosRH.map((e) => (
                              <option key={e.id} value={e.nombreCompleto}>
                                {e.nombreCompleto} {e.tipoSalario === 'rutero' ? '⭐ (Rutero)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className="font-black text-sm text-slate-900">
                          {activeRouteItem.empleadoNombre || "No especificado"}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Puesto:
                      </span>
                      <p className="font-bold text-slate-800 text-xs mt-1">
                        Ventas-Ruta ({activeRouteItem.routeName})
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Sueldo Base (RH):
                      </span>
                      <p className="font-mono font-black text-sm text-slate-900 mt-1">
                        {formatMoney(activeRouteItem.salarioBase)}
                      </p>
                    </div>
                  </div>

                  {/* TABLA DE VENTAS POR DÍA (Lunes a Sábado) */}
                  <div className="mb-5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                      Resumen de Ventas Semanales (Efectivo & Transferencias)
                    </h4>
                    <div className="overflow-x-auto border border-slate-300 rounded-xl">
                      <table className="w-full text-xs text-center border-collapse">
                        <thead>
                          <tr className="bg-slate-100 font-bold text-slate-700 text-[11px] border-b border-slate-300">
                            <th className="p-2 border-r border-slate-300">Lunes</th>
                            <th className="p-2 border-r border-slate-300">Martes</th>
                            <th className="p-2 border-r border-slate-300">Miércoles</th>
                            <th className="p-2 border-r border-slate-300">Jueves</th>
                            <th className="p-2 border-r border-slate-300">Viernes</th>
                            <th className="p-2 border-r border-slate-300">Sábado</th>
                            <th className="p-2 border-r border-slate-300 bg-amber-50 text-amber-900">Total Venta</th>
                            <th className="p-2 bg-emerald-50 text-emerald-900">Comisión (2.5%)</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono divide-y divide-slate-200">
                          <tr>
                            <td className="p-2.5 border-r border-slate-300">
                              <div className="font-bold">{formatMoney(activeRouteItem.ventasPorDia.lunes.total)}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {activeRouteItem.ventasPorDia.lunes.tickets} tks
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-slate-300">
                              <div className="font-bold">{formatMoney(activeRouteItem.ventasPorDia.martes.total)}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {activeRouteItem.ventasPorDia.martes.tickets} tks
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-slate-300">
                              <div className="font-bold">{formatMoney(activeRouteItem.ventasPorDia.miercoles.total)}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {activeRouteItem.ventasPorDia.miercoles.tickets} tks
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-slate-300">
                              <div className="font-bold">{formatMoney(activeRouteItem.ventasPorDia.jueves.total)}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {activeRouteItem.ventasPorDia.jueves.tickets} tks
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-slate-300">
                              <div className="font-bold">{formatMoney(activeRouteItem.ventasPorDia.viernes.total)}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {activeRouteItem.ventasPorDia.viernes.tickets} tks
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-slate-300">
                              <div className="font-bold">{formatMoney(activeRouteItem.ventasPorDia.sabado.total)}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {activeRouteItem.ventasPorDia.sabado.tickets} tks
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-slate-300 bg-amber-50/60 font-black text-amber-950">
                              {formatMoney(activeRouteItem.totalVentaSemanal)}
                            </td>
                            <td className="p-2.5 bg-emerald-50/60 font-black text-emerald-800">
                              +{formatMoney(activeRouteItem.comisionMonto)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* TABLAS PERCEPCIONES Y DEDUCCIONES (Lado a Lado) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 text-xs">
                    {/* PERCEPCIONES */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-emerald-50 text-emerald-950 font-black p-2.5 text-center border-b border-slate-300 uppercase tracking-wider text-[11px]">
                        PERCEPCIONES
                      </div>
                      <div className="p-3.5 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Sueldo Base Semanal:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatMoney(activeRouteItem.salarioBase)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Comisión Rutas (2.5%):</span>
                          <span className="font-mono font-bold text-emerald-700">
                            +{formatMoney(activeRouteItem.comisionMonto)}
                          </span>
                        </div>
                        {activeRouteItem.bonosExtras > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Bonos Extras:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              +{formatMoney(activeRouteItem.bonosExtras)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.pagosPendientes > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Pagos Pendientes:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              +{formatMoney(activeRouteItem.pagosPendientes)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.prestamos > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Préstamo Otorgado:</span>
                            <span className="font-mono font-bold text-blue-700">
                              +{formatMoney(activeRouteItem.prestamos)}
                            </span>
                          </div>
                        )}

                        <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-black text-sm text-emerald-900">
                          <span>Total Percepciones:</span>
                          <span className="font-mono">{formatMoney(activeRouteItem.percepciones)}</span>
                        </div>
                      </div>
                    </div>

                    {/* DEDUCCIONES */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-rose-50 text-rose-950 font-black p-2.5 text-center border-b border-slate-300 uppercase tracking-wider text-[11px]">
                        DEDUCCIONES
                      </div>
                      <div className="p-3.5 space-y-2">
                        {activeRouteItem.faltas > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Faltas ({activeRouteItem.faltas} d):</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatMoney(activeRouteItem.faltasMonto)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.gasolina > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Movilidad / Gasolina:</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatMoney(activeRouteItem.gasolina)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.tienda > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Crédito Tienda:</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatMoney(activeRouteItem.tienda)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.notasQueseria > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Notas Quesería:</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatMoney(activeRouteItem.notasQueseria)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.cobrosPendientes > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Cobros Pendientes:</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatMoney(activeRouteItem.cobrosPendientes)}
                            </span>
                          </div>
                        )}
                        {activeRouteItem.abonos > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Abono a Préstamo:</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatMoney(activeRouteItem.abonos)}
                            </span>
                          </div>
                        )}

                        <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-black text-sm text-rose-900">
                          <span>Total Deducciones:</span>
                          <span className="font-mono">-{formatMoney(activeRouteItem.descuentos)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONTROL DE SALDOS DE PRÉSTAMOS */}
                  {(activeRouteItem.saldoPrestamoActual > 0 || activeRouteItem.prestamos > 0 || activeRouteItem.abonos > 0) && (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 mb-5 text-xs grid grid-cols-4 gap-2 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Saldo Anterior</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatMoney(activeRouteItem.saldoPrestamoAnterior)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">+ Nuevo Préstamo</span>
                        <span className="font-mono font-bold text-emerald-800">
                          +{formatMoney(activeRouteItem.prestamos)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-rose-700 uppercase block">- Abono Semanal</span>
                        <span className="font-mono font-bold text-rose-800">
                          -{formatMoney(activeRouteItem.abonos)}
                        </span>
                      </div>
                      <div className="bg-blue-100 rounded-lg p-1">
                        <span className="text-[10px] font-black text-blue-900 uppercase block">= Saldo Pendiente</span>
                        <span className="font-mono font-black text-blue-950 text-sm">
                          {formatMoney(activeRouteItem.saldoPrestamoActual)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TOTAL NETO A PAGAR */}
                  <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between mb-6 shadow-sm">
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                        Neto a Liquidar al Repartidor
                      </span>
                      <span className="text-sm font-bold text-slate-200">TOTAL A PAGAR</span>
                    </div>
                    <div className="font-mono font-black text-2xl text-emerald-400">
                      {formatMoney(activeRouteItem.pagoFinal)} MXN
                    </div>
                  </div>

                  {/* TEXTO DE CONFORMIDAD Y FIRMA */}
                  <div className="border-t border-slate-200 pt-6 mt-6">
                    <p className="text-[10px] text-slate-500 text-justify mb-8 leading-relaxed">
                      Recibí de Lácteos Trujillos a mi entera conformidad la cantidad neta descrita en este comprobante por concepto de sueldos, comisiones de ventas y liquidaciones del periodo correspondiente, sin existir adeudo alguno a mi favor.
                    </p>
                    <div className="flex justify-between items-end pt-4">
                      <div className="text-center w-64">
                        <div className="border-b border-slate-900 pb-1 mb-1 font-bold text-xs">
                          {activeRouteItem.empleadoNombre || "Firma del Colaborador"}
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase">Firma de Recibido</span>
                      </div>
                      <div className="text-center w-64">
                        <div className="border-b border-slate-900 pb-1 mb-1 font-bold text-xs">
                          Lácteos Trujillos
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase">Autorización RH / Gerencia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                Selecciona una ruta para consultar su recibo.
              </div>
            )
          )}
        </div>
      </div>

      {/* DETALLE DE TICKETS DE ODOO (Colapsable) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowTicketsTable(!showTicketsTable)}
          className="w-full p-4 flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Detalle de Tickets de Odoo y Reglas de Clientes ({commissions.length} tickets)</span>
          </div>
          {showTicketsTable ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showTicketsTable && (
          <div className="border-t border-slate-200 p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Ruta</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Tipo / Regla</th>
                    <th className="px-3 py-2 text-right">Monto Venta</th>
                    <th className="px-3 py-2 text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commissions.slice(0, 50).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(c.dateOrder).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{c.orderName || "N/A"}</td>
                      <td className="px-3 py-2 font-medium text-slate-600">Ruta {c.routeId}</td>
                      <td className="px-3 py-2 truncate max-w-[200px]" title={c.clientName}>
                        {c.clientName}
                      </td>
                      <td className="px-3 py-2">
                        {isOperator ? (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {c.clientType}
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleClientType(c.id, c.clientId, c.clientType)}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200"
                          >
                            {c.clientType === 'company' ? 'Empresa' : 'Individual'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        {formatMoney(c.orderTotal)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-600">
                        {formatMoney(c.commissionAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {commissions.length > 50 && (
                <p className="text-[11px] text-slate-400 text-center py-2">
                  Mostrando los primeros 50 de {commissions.length} tickets.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE AJUSTES MANUALES DE LA SEMANA */}
      {editingRuta && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Modificar Ajustes de {editingRuta.routeName}
                </h3>
                <p className="text-xs text-slate-500">
                  Chofer: {editingRuta.empleadoNombre || "Sin asignar"} • {selectedWeek}
                </p>
              </div>
              <button
                onClick={() => setEditingRuta(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Sueldo Base ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.salarioBase || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, salarioBase: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Faltas (Días):</label>
                <input
                  type="number"
                  step="1"
                  value={ajustesForm.faltas || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, faltas: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Bonos Extras ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.bonosExtras || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, bonosExtras: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Pagos Pendientes ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.pagosPendientes || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, pagosPendientes: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Movilidad / Gasolina ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.gasolina || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, gasolina: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Crédito Tienda ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.tienda || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, tienda: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Notas Quesería ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.notasQueseria || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, notasQueseria: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Cobros Pendientes ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.cobrosPendientes || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, cobrosPendientes: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <label className="font-bold text-emerald-900 block mb-1">+ Préstamo Otorgado ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.prestamos || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, prestamos: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-emerald-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <label className="font-bold text-rose-900 block mb-1">- Abono a Préstamo ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={ajustesForm.abonos || ""}
                  onChange={(e) => setAjustesForm({ ...ajustesForm, abonos: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-rose-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingRuta(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAjustes}
                disabled={savingAjustes}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingAjustes ? "Guardando..." : "Guardar Ajustes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
