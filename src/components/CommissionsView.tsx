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
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Wallet,
  RotateCcw
} from "lucide-react";
import { AppState } from "../types";

export interface VentaDiaInfo {
  efectivo: number;
  transferencias: number;
  total: number;
  tickets: number;
}

export interface RutaNominaData {
  routeId: string | number;
  routeName: string;
  empleadoId?: string | number;
  empleadoNombre: string;
  telefonoWhatsapp: string;
  salarioBase: number;
  // Ventas
  ventaIndividuales: number;
  ventaEmpresas: number;
  totalVentaSemanal: number;
  // Comisiones según porcentaje
  ratePerson: number;
  rateCompany: number;
  comisionIndividuales: number;
  comisionEmpresas: number;
  totalComisiones: number;
  // Desglose por día
  ventasPorDia: {
    lunes: VentaDiaInfo;
    martes: VentaDiaInfo;
    miercoles: VentaDiaInfo;
    jueves: VentaDiaInfo;
    viernes: VentaDiaInfo;
    sabado: VentaDiaInfo;
    domingo: VentaDiaInfo;
  };
  // Ajustes
  faltas: number;
  faltasMonto: number;
  bonosExtras: number;
  pagosPendientes: number;
  prestamos: number;
  abonos: number;
  gasolina: number;
  tienda: number;
  notasQueseria: number;
  cobrosPendientes: number;
  // Saldos de préstamos
  saldoPrestamoAnterior: number;
  saldoPrestamoActual: number;
  // Totales finales
  percepciones: number;
  descuentos: number;
  pagoFinal: number;
  // Metadata
  semana: string;
  periodoDePago: string;
  fechaDePago: string;
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
  telefonoWhatsapp?: string;
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
  const [rhEmpleados, setRhEmpleados] = useState<RHEmpleadoSimple[]>([]);
  const [serverNominaRutas, setServerNominaRutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [assigningRoute, setAssigningRoute] = useState<string | null>(null);

  const currentWeekStr = "Semana " + getWeekNumber(new Date());
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStr);
  const [activeTab, setActiveTab] = useState<string>(isOperator ? (operatorRoute || "Ruta 1") : "ALL");

  // Modal para editar ajustes variables
  const [editingRuta, setEditingRuta] = useState<RutaNominaData | null>(null);
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

  // Tickets de Odoo colapsable
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

      // 2. Cargar colaboradores de RH
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

      // 3. Cargar nómina de rutas del backend
      try {
        const resNom = await apiFetch(`/api/rh/nomina-rutas?semanaId=${encodeURIComponent(selectedWeek)}`, { headers });
        if (resNom.ok) {
          const jsonNom = await resNom.json();
          if (jsonNom.success && Array.isArray(jsonNom.rutas)) {
            setServerNominaRutas(jsonNom.rutas);
          }
        }
      } catch (nomErr) {
        console.warn("Could not load server nomina rutas:", nomErr);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
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

  // Recarga forzada y purga de caché del navegador
  const handleForceReload = () => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  // Asignar colaborador de RH a una ruta
  const handleAssignEmpleado = async (routeId: string | number, empleadoNombre: string) => {
    if (!isRHOrAdmin) return;
    setAssigningRoute(String(routeId));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      const empObj = rhEmpleados.find(e => e.nombreCompleto === empleadoNombre);
      const updates: any = {
        empleadoNombre,
        semanaId: selectedWeek
      };
      if (empObj && empObj.sueldoBase > 0) {
        updates.salarioBase = empObj.sueldoBase;
      }

      const res = await apiFetch(`/api/rh/nomina-rutas/${encodeURIComponent(String(routeId))}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Error assigning employee to route:", err);
    } finally {
      setAssigningRoute(null);
    }
  };

  // Abrir modal de ajustes de una ruta
  const handleOpenAjustes = (r: RutaNominaData) => {
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

      const res = await apiFetch(`/api/rh/nomina-rutas/${encodeURIComponent(String(editingRuta.routeId))}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...ajustesForm,
          semanaId: selectedWeek
        })
      });

      if (res.ok) {
        await fetchData();
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

  // Cambiar tipo Persona / Empresa en ticket de Odoo
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
        fetchData();
      }
    } catch (e) {
      console.error(e);
      fetchData();
    }
  };

  // CÁLCULO EXACTO DE NÓMINA POR RUTA CON PORCENTAJES ORIGINALES DE INDIVIDUALES Y EMPRESAS
  const rateCompany = state?.settings?.commissionRateCompany ?? 1.0;
  const ratePerson = state?.settings?.commissionRatePerson ?? 2.0;

  const diasSemanaMap: Record<number, 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'> = {
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado',
    0: 'domingo'
  };

  const rutasList: RutaNominaData[] = useMemo(() => {
    // Lista de rutas base desde state.routes o defaults
    const authorizedRoutes = (state?.routes || []).filter(r => r.isAuthorized !== false);
    const baseRoutes = authorizedRoutes.length > 0
      ? authorizedRoutes
      : [
          { id: 1, name: 'Ruta 1' },
          { id: 2, name: 'Ruta 2' },
          { id: 3, name: 'Ruta 3' },
          { id: 5, name: 'Ruta 4' },
          { id: 9, name: 'Ruta 5' }
        ];

    // Asignaciones de choferes y sueldos de settings
    const routeEmployees = state?.settings?.routeEmployees || {};
    const baseSalaries = state?.settings?.baseSalaries || {};

    return baseRoutes.map((r) => {
      const routeName = r.name || `Ruta ${r.id}`;
      const serverItem = serverNominaRutas.find(sn => String(sn.routeId) === String(r.id) || sn.routeName === routeName);

      // Determinar chofer
      const assignedEmpName = serverItem?.empleadoNombre || routeEmployees[routeName] || routeEmployees[String(r.id)] || '';
      const rhMatch = assignedEmpName
        ? rhEmpleados.find(e => e.nombreCompleto.toLowerCase().trim() === assignedEmpName.toLowerCase().trim())
        : null;

      const empleadoNombre = rhMatch ? rhMatch.nombreCompleto : assignedEmpName;
      const empleadoId = rhMatch ? rhMatch.numeroEmpleado : undefined;
      const telefonoWhatsapp = rhMatch?.telefonoWhatsapp || rhMatch?.telefono || serverItem?.telefonoWhatsapp || '';

      // Sueldo base: configurado en la ruta o estipulado en RH
      let salarioBase = 0;
      if (serverItem && serverItem.salarioBase !== undefined && serverItem.salarioBase > 0) {
        salarioBase = Number(serverItem.salarioBase);
      } else if (rhMatch && rhMatch.sueldoBase > 0) {
        salarioBase = Number(rhMatch.sueldoBase);
      } else if (baseSalaries[routeName] !== undefined) {
        salarioBase = Number(baseSalaries[routeName]);
      } else if (baseSalaries[String(r.id)] !== undefined) {
        salarioBase = Number(baseSalaries[String(r.id)]);
      } else {
        salarioBase = 2200; // Default operativo
      }

      // Ventas por día
      const ventasPorDia: Record<string, VentaDiaInfo> = {
        lunes: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 },
        martes: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 },
        miercoles: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 },
        jueves: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 },
        viernes: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 },
        sabado: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 },
        domingo: { efectivo: 0, transferencias: 0, total: 0, tickets: 0 }
      };

      let sumVentaInd = 0;
      let sumVentaComp = 0;
      let sumComisionInd = 0;
      let sumComisionComp = 0;

      // Filtrar tickets correspondientes a esta ruta y semana seleccionada
      (commissions || []).forEach((c) => {
        if (c.clientType === 'sin_cliente' || !c.clientId) return;
        const cWeek = `Semana ${getWeekNumber(c.dateOrder)}`;
        if (selectedWeek && selectedWeek !== "ALL" && cWeek !== selectedWeek) return;

        // Validar si pertenece a la ruta
        const matchRoute = c.routeId === r.id || String(c.routeId) === String(r.id) || c.routeName === routeName;
        if (!matchRoute) return;

        const d = new Date(c.dateOrder);
        const dayIdx = isNaN(d.getTime()) ? 1 : d.getDay();
        const diaKey = diasSemanaMap[dayIdx] || 'lunes';
        const totalTicket = Number(c.orderTotal) || 0;
        const commAmount = Number(c.commissionAmount) || 0;

        if (c.clientType === 'company') {
          ventasPorDia[diaKey].transferencias += totalTicket;
          sumVentaComp += totalTicket;
          sumComisionComp += commAmount;
        } else {
          ventasPorDia[diaKey].efectivo += totalTicket;
          sumVentaInd += totalTicket;
          sumComisionInd += commAmount;
        }

        ventasPorDia[diaKey].total += totalTicket;
        ventasPorDia[diaKey].tickets += 1;
      });

      const totalVentaSemanal = Number((sumVentaInd + sumVentaComp).toFixed(2));
      const totalComisiones = Number((sumComisionInd + sumComisionComp).toFixed(2));

      // Ajustes variables
      const bonosExtras = Number(serverItem?.bonosExtras) || 0;
      const pagosPendientes = Number(serverItem?.pagosPendientes) || 0;
      const prestamos = Number(serverItem?.prestamos) || 0;
      const abonos = Number(serverItem?.abonos) || 0;
      const faltas = Number(serverItem?.faltas) || 0;
      const cuotaDiaria = salarioBase > 0 ? salarioBase / 6 : 0;
      const faltasMonto = Number((faltas * cuotaDiaria).toFixed(2));
      const gasolina = Number(serverItem?.gasolina) || 0;
      const tienda = Number(serverItem?.tienda) || 0;
      const notasQueseria = Number(serverItem?.notasQueseria) || 0;
      const cobrosPendientes = Number(serverItem?.cobrosPendientes) || 0;

      // Saldos de préstamos
      const saldoPrestamoAnterior = Number(serverItem?.saldoPrestamoAnterior) || 0;
      const saldoPrestamoActual = Math.max(0, Number((saldoPrestamoAnterior + prestamos - abonos).toFixed(2)));

      // Percepciones y Deducciones
      const percepciones = Number((salarioBase + totalComisiones + bonosExtras + pagosPendientes + prestamos).toFixed(2));
      const descuentos = Number((faltasMonto + abonos + gasolina + notasQueseria + tienda + cobrosPendientes).toFixed(2));
      const pagoFinal = Math.max(0, Math.round(percepciones - descuentos));

      // WhatsApp Message
      let tel = (telefonoWhatsapp || '').replace(/\D/g, '');
      if (tel.length === 12 && tel.startsWith('52')) tel = tel.slice(2);
      let linkWhatsApp = '';
      if (tel.length === 10) {
        const msg = `🧀 *LÁCTEOS TRUJILLOS* 🧀\n📄 *RECIBO DE NÓMINA - VENTAS RUTA*\n\n` +
          `👤 *Colaborador:* ${empleadoNombre || routeName}\n` +
          `🚛 *Ruta:* ${routeName}\n` +
          `💼 *Puesto:* Ventas-Ruta\n` +
          `📅 *Periodo:* ${selectedWeek}\n` +
          `📆 *Fecha de Pago:* ${new Date().toLocaleDateString('es-MX')}\n\n` +
          `💵 *DESGLOSE DE PERCEPCIONES:*\n` +
          `  • Sueldo Base: ${formatMoney(salarioBase)}\n` +
          `  • Comisiones Individuales (${ratePerson}%): ${formatMoney(sumComisionInd)} (Venta: ${formatMoney(sumVentaInd)})\n` +
          `  • Comisiones Empresas (${rateCompany}%): ${formatMoney(sumComisionComp)} (Venta: ${formatMoney(sumVentaComp)})\n` +
          `  • Total Comisiones: ${formatMoney(totalComisiones)} (Venta Total: ${formatMoney(totalVentaSemanal)})\n` +
          (bonosExtras > 0 ? `  • Bonos Extras: ${formatMoney(bonosExtras)}\n` : '') +
          (pagosPendientes > 0 ? `  • Pagos Pendientes: ${formatMoney(pagosPendientes)}\n` : '') +
          (prestamos > 0 ? `  • Préstamo Otorgado: ${formatMoney(prestamos)}\n` : '') +
          `  *TOTAL PERCEPCIONES: ${formatMoney(percepciones)}*\n\n` +
          `🔻 *DESGLOSE DE DEDUCCIONES:*\n` +
          (faltas > 0 ? `  • Faltas (${faltas} d): -${formatMoney(faltasMonto)}\n` : '') +
          (gasolina > 0 ? `  • Gasolina: -${formatMoney(gasolina)}\n` : '') +
          (tienda > 0 ? `  • Tienda: -${formatMoney(tienda)}\n` : '') +
          (notasQueseria > 0 ? `  • Notas Quesería: -${formatMoney(notasQueseria)}\n` : '') +
          (cobrosPendientes > 0 ? `  • Cobros Pendientes: -${formatMoney(cobrosPendientes)}\n` : '') +
          (abonos > 0 ? `  • Abono Préstamo: -${formatMoney(abonos)}\n` : '') +
          `  *TOTAL DEDUCCIONES: -${formatMoney(descuentos)}*\n\n` +
          (saldoPrestamoAnterior > 0 || prestamos > 0 || abonos > 0
            ? `💳 *CONTROL DE PRÉSTAMO:*\n` +
              `  • Saldo Anterior: ${formatMoney(saldoPrestamoAnterior)}\n` +
              (prestamos > 0 ? `  • (+) Nuevo Préstamo: ${formatMoney(prestamos)}\n` : '') +
              (abonos > 0 ? `  • (-) Abono de Semana: -${formatMoney(abonos)}\n` : '') +
              `  • Saldo Pendiente: ${formatMoney(saldoPrestamoActual)}\n\n`
            : '') +
          `💰 *TOTAL A PAGAR: ${formatMoney(pagoFinal)}*\n\n` +
          `_Lácteos Trujillos - Comprobante Digital de Nómina_`;

        linkWhatsApp = `https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`;
      }

      return {
        routeId: r.id,
        routeName,
        empleadoId,
        empleadoNombre,
        telefonoWhatsapp,
        salarioBase,
        ventaIndividuales: Number(sumVentaInd.toFixed(2)),
        ventaEmpresas: Number(sumVentaComp.toFixed(2)),
        totalVentaSemanal,
        ratePerson,
        rateCompany,
        comisionIndividuales: Number(sumComisionInd.toFixed(2)),
        comisionEmpresas: Number(sumComisionComp.toFixed(2)),
        totalComisiones,
        ventasPorDia: ventasPorDia as any,
        faltas,
        faltasMonto,
        bonosExtras,
        pagosPendientes,
        prestamos,
        abonos,
        gasolina,
        tienda,
        notasQueseria,
        cobrosPendientes,
        saldoPrestamoAnterior,
        saldoPrestamoActual,
        percepciones,
        descuentos,
        pagoFinal,
        semana: selectedWeek,
        periodoDePago: 'Lunes a Sábado',
        fechaDePago: new Date().toLocaleDateString('es-MX'),
        linkWhatsApp
      };
    });
  }, [state?.routes, state?.settings, commissions, selectedWeek, rhEmpleados, serverNominaRutas, rateCompany, ratePerson]);

  // Totales de todas las rutas
  const summary = useMemo(() => {
    let ventas = 0;
    let comisiones = 0;
    let comInd = 0;
    let comComp = 0;
    let pagos = 0;
    let deudaPrestamos = 0;

    rutasList.forEach((r) => {
      ventas += r.totalVentaSemanal;
      comisiones += r.totalComisiones;
      comInd += r.comisionIndividuales;
      comComp += r.comisionEmpresas;
      pagos += r.pagoFinal;
      deudaPrestamos += r.saldoPrestamoActual;
    });

    return { ventas, comisiones, comInd, comComp, pagos, deudaPrestamos };
  }, [rutasList]);

  // Colaboradores de RH exclusivos para rutas: jornada 'rutero' o puesto/departamento 'ruta' / 'chofer'
  const choferesRuterosRH = useMemo(() => {
    return rhEmpleados.filter(e => {
      if (e.status === 'baja') return false;
      const tipo = (e.tipoSalario || '').toLowerCase().trim();
      const puesto = (e.puesto || '').toLowerCase().trim();
      const depto = (e.departamento || '').toLowerCase().trim();
      
      const isRutero = tipo === 'rutero';
      const isRutaPuesto = puesto.includes('ruta') || puesto.includes('rutero') || puesto.includes('chofer') || puesto.includes('repartidor');
      const isRutaDepto = depto.includes('ruta') || depto.includes('rutero');

      return isRutero || isRutaPuesto || isRutaDepto;
    });
  }, [rhEmpleados]);

  // Obtener choferes disponibles para la ruta, conservando el actualmente asignado si ya tiene chofer
  const getChoferesForRoute = (currentlyAssignedName?: string) => {
    if (!currentlyAssignedName) return choferesRuterosRH;
    const exists = choferesRuterosRH.some(c => c.nombreCompleto === currentlyAssignedName);
    if (exists) return choferesRuterosRH;
    const match = rhEmpleados.find(e => e.nombreCompleto === currentlyAssignedName);
    if (match) return [match, ...choferesRuterosRH];
    return choferesRuterosRH;
  };

  // Ruta activa seleccionada
  const activeRouteItem = useMemo(() => {
    if (activeTab === "ALL") return null;
    return rutasList.find(r => r.routeName === activeTab || String(r.routeId) === String(activeTab));
  }, [rutasList, activeTab]);

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
                Sueldo base + comisiones por venta a individuales ({ratePerson}%) y empresas ({rateCompany}%) con formato oficial de recibo.
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

          {/* Botón de recarga forzada de caché */}
          <button
            onClick={handleForceReload}
            title="Recargar vista limpia y purgar caché"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI CARDS (Comisiones divididas en Individuales y Empresas tal como estaban) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Ventas Semanales</p>
            <p className="text-lg font-black text-slate-900">{formatMoney(summary.ventas)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Individuales ({ratePerson}%)</p>
            <p className="text-lg font-black text-sky-700">{formatMoney(summary.comInd)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Empresas ({rateCompany}%)</p>
            <p className="text-lg font-black text-indigo-700">{formatMoney(summary.comComp)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Pago Neto Ruteros</p>
            <p className="text-lg font-black text-emerald-700">{formatMoney(summary.pagos)}</p>
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
            {rutasList.map((r) => (
              <button
                key={String(r.routeId)}
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
          {/* VISTA 1: RESUMEN GENERAL (TABLA DE TODAS LAS RUTAS CON CÁLCULO INDIVIDUALES Y EMPRESAS) */}
          {activeTab === 'ALL' && !isOperator ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Nómina Consolidada por Ruta • {selectedWeek}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asigna el colaborador del Padrón de RH en el selector para asociar su sueldo base y saldos.
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
                      <th className="p-3 text-right">Venta Total</th>
                      <th className="p-3 text-right text-sky-800 bg-sky-50/50">Com. Ind ({ratePerson}%)</th>
                      <th className="p-3 text-right text-indigo-800 bg-indigo-50/50">Com. Emp ({rateCompany}%)</th>
                      <th className="p-3 text-right font-black">Total Comisiones</th>
                      <th className="p-3 text-right">Percepciones</th>
                      <th className="p-3 text-right text-rose-700">Deducciones</th>
                      <th className="p-3 text-right text-amber-800">Saldo Préstamo</th>
                      <th className="p-3 text-right bg-emerald-50 text-emerald-900 font-black">Total a Pagar</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rutasList.map((r) => (
                      <tr key={String(r.routeId)} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-black text-slate-900 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{r.routeName}</span>
                        </td>
                        <td className="p-3">
                          {/* Selector de colaborador de RH */}
                          <div className="relative">
                            <select
                              value={r.empleadoNombre || ""}
                              onChange={(e) => handleAssignEmpleado(r.routeId, e.target.value)}
                              disabled={assigningRoute === String(r.routeId)}
                              className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border appearance-none outline-none focus:ring-2 focus:ring-emerald-500 ${
                                r.empleadoNombre
                                  ? 'bg-emerald-50/40 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="">-- Sin chofer asignado --</option>
                              {getChoferesForRoute(r.empleadoNombre).map((emp) => (
                                <option key={emp.id} value={emp.nombreCompleto}>
                                  {emp.nombreCompleto} {emp.tipoSalario === 'rutero' ? '⭐ (Rutero)' : `(${emp.puesto || 'Ruta'})`}
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
                        <td className="p-3 text-right font-mono font-bold text-sky-700 bg-sky-50/30">
                          +{formatMoney(r.comisionIndividuales)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                          +{formatMoney(r.comisionEmpresas)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700">
                          +{formatMoney(r.totalComisiones)}
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
                            <option value="">-- Asignar chofer de ruta (RH) --</option>
                            {getChoferesForRoute(activeRouteItem.empleadoNombre).map((e) => (
                              <option key={e.id} value={e.nombreCompleto}>
                                {e.nombreCompleto} {e.tipoSalario === 'rutero' ? '⭐ (Rutero)' : `(${e.puesto || 'Ruta'})`}
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
                            <th className="p-2 bg-emerald-50 text-emerald-900">Total Comisiones</th>
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
                              +{formatMoney(activeRouteItem.totalComisiones)}
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
                        <div className="flex justify-between items-center text-sky-800">
                          <span>Comisión Individuales ({ratePerson}%):</span>
                          <span className="font-mono font-bold">
                            +{formatMoney(activeRouteItem.comisionIndividuales)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-indigo-800">
                          <span>Comisión Empresas ({rateCompany}%):</span>
                          <span className="font-mono font-bold">
                            +{formatMoney(activeRouteItem.comisionEmpresas)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-emerald-700 bg-emerald-50/40 px-2 py-1 rounded">
                          <span>Total Comisiones de Ruta:</span>
                          <span className="font-mono">
                            +{formatMoney(activeRouteItem.totalComisiones)}
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
                Selecciona una ruta para consultar su recibo individual.
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
                            {c.clientType === 'company' ? `Empresa (${rateCompany}%)` : `Individual (${ratePerson}%)`}
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleClientType(c.id, c.clientId, c.clientType)}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200"
                          >
                            {c.clientType === 'company' ? `Empresa (${rateCompany}%)` : `Individual (${ratePerson}%)`}
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
