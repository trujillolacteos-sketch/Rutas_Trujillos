import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  Users,
  Clock,
  Printer,
  Share2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit3,
  Archive,
  Download,
  Building,
  Truck,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  Check,
  X,
  CreditCard,
  Send,
  ExternalLink,
  ShieldCheck,
  Save
} from 'lucide-react';

interface VentaDiaRuta {
  efectivo: number;
  transferencias: number;
}

interface NominaEmpleado {
  rowNumber: number;
  id?: string;
  numeroEmpleado?: number;
  nombreCompleto: string;
  primerApellido?: string;
  segundoApellido?: string;
  nombres?: string;
  puesto: string;
  departamento: string;
  curp: string;
  fechaIngreso: string;
  antiguedad: string;
  telefonoWhatsapp: string;
  tipoJornada: string;
  salarioBase: number;
  horasTrabajadas: string;
  montoPorHoras: number;
  faltas: number;
  faltasMonto: number;
  horasJornadaIncompleta: string;
  montoJornadaIncompleta: number;
  extras: string;
  extrasMonto: number;
  incapacidades: number;
  vacacionesUtilizadas: number;
  pagosPendientes: number;
  bonosExtras: number;
  prestamos: number;
  abonos: number;
  gasolina: number;
  notasQueseria: number;
  tienda: number;
  cobrosPendientes: number;
  percepciones: number;
  descuentos: number;
  pagoFinal: number;
  fechaDePago: string;
  periodoDePago: string;
  semana: string;
  linkWhatsApp?: string;
  whatsappEnviado?: boolean;
  ventasPorDia?: {
    lunes: VentaDiaRuta;
    martes: VentaDiaRuta;
    miercoles: VentaDiaRuta;
    jueves: VentaDiaRuta;
    viernes: VentaDiaRuta;
    sabado: VentaDiaRuta;
  };
  totalVentaSemanalEfectivo?: number;
  totalVentaSemanalBancos?: number;
  totalVentaSemanal?: number;
  comisionRuta?: number;
}

interface SemanaNomina {
  id: string;
  semanaNum: number;
  anio: number;
  periodo: string;
  fechaPago: string;
  fechaCierre?: string;
  cerrada: boolean;
  empleados: NominaEmpleado[];
  totales: {
    totalPercepciones: number;
    totalDescuentos: number;
    totalPagoNeto: number;
    totalEmpleados: number;
    totalFaltas: number;
    totalHorasExtrasMonto: number;
  };
}

interface SemanaDisponible {
  id: string;
  semanaNum: number;
  anio: number;
  periodo: string;
  cerrada: boolean;
  fechaCierre?: string;
  esActiva: boolean;
}

interface NominaRecibosViewProps {
  token: string;
  role?: string;
  user?: any;
}

function parseHoursToDecimal(hhmm?: string): number {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const parts = hhmm.trim().split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h + (m / 60);
}

export const NominaRecibosView: React.FC<NominaRecibosViewProps> = ({ token, role, user }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [archiving, setArchiving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [semanaActual, setSemanaActual] = useState<SemanaNomina | null>(null);
  const [semanasDisponibles, setSemanasDisponibles] = useState<SemanaDisponible[]>([]);
  const [selectedSemanaId, setSelectedSemanaId] = useState<string>('');

  // Active view tab
  const [activeTab, setActiveTab] = useState<'nomina' | 'recibos' | 'historico'>('nomina');

  // Table display mode
  const [tableMode, setTableMode] = useState<'manual8' | 'resumen'>('manual8');

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('TODOS');

  // Saving indicator per row
  const [savedRowMap, setSavedRowMap] = useState<Record<number, boolean>>({});

  // Modals
  const [editingEmp, setEditingEmp] = useState<NominaEmpleado | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<NominaEmpleado | null>(null);
  const [receiptFormat, setReceiptFormat] = useState<'produccion' | 'ruta'>('produccion');
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState<boolean>(false);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState<boolean>(false);

  // Load Nómina data
  const loadNomina = async (semanaId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = semanaId ? `/api/rh/nomina?semanaId=${encodeURIComponent(semanaId)}` : '/api/rh/nomina';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setSemanaActual(data.semanaActual);
      setSemanasDisponibles(data.semanasDisponibles || []);
      if (data.semanaActual?.id) {
        setSelectedSemanaId(data.semanaActual.id);
      }
    } catch (err: any) {
      console.error('Error cargando nómina:', err);
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNomina();
  }, []);

  // Recalculate / Sync from Checadas and RH
  const handleRecalcular = async (forzar = true) => {
    setRefreshing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/rh/nomina/recalcular', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forzar })
      });
      if (!res.ok) throw new Error('Error al sincronizar con Checadas y RH');
      const data = await res.json();
      setSemanaActual(data.semanaActual);
      setSuccessMsg('Nómina alimentada y sincronizada desde Padrón RH y Checadas.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Inline input change for the 8 manual fields
  const handleInlineChange = (rowNumber: number, field: keyof NominaEmpleado, rawValue: string) => {
    if (!semanaActual) return;
    const numVal = parseFloat(rawValue) || 0;

    const updatedList = semanaActual.empleados.map(emp => {
      if (emp.rowNumber !== rowNumber) return emp;
      const updatedEmp = { ...emp, [field]: numVal };

      const sueldoBase = emp.salarioBase;
      const horasTrabajadasDec = parseHoursToDecimal(emp.horasTrabajadas);
      const montoPorHoras = emp.tipoJornada === 'hora' ? Number((horasTrabajadasDec * sueldoBase).toFixed(2)) : 0;
      const horasIncompletasDec = parseHoursToDecimal(emp.horasJornadaIncompleta);
      const montoJornadaIncompleta = horasIncompletasDec > 0 ? Math.round(horasIncompletasDec * (sueldoBase / 7 / 8)) : 0;
      const extrasDec = parseHoursToDecimal(emp.extras);
      const extrasMonto = extrasDec > 0 ? Math.round(extrasDec * (sueldoBase / 7 / 8) * 1.2) : 0;
      const faltasMonto = emp.faltas > 0 ? Math.round((sueldoBase / 7) * emp.faltas) : 0;
      const comisionRuta = emp.comisionRuta || 0;

      const bonosExtras = field === 'bonosExtras' ? numVal : emp.bonosExtras;
      const pagosPendientes = field === 'pagosPendientes' ? numVal : emp.pagosPendientes;
      const gasolina = field === 'gasolina' ? numVal : emp.gasolina;
      const notasQueseria = field === 'notasQueseria' ? numVal : emp.notasQueseria;
      const tienda = field === 'tienda' ? numVal : emp.tienda;
      const cobrosPendientes = field === 'cobrosPendientes' ? numVal : emp.cobrosPendientes;
      const prestamos = field === 'prestamos' ? numVal : emp.prestamos;
      const abonos = field === 'abonos' ? numVal : emp.abonos;

      let percepciones = (emp.tipoJornada === 'hora' ? montoPorHoras : sueldoBase) + extrasMonto + bonosExtras + pagosPendientes + prestamos + comisionRuta;
      percepciones = Number(percepciones.toFixed(2));
      const descuentos = Number((faltasMonto + montoJornadaIncompleta + abonos + gasolina + notasQueseria + tienda + cobrosPendientes).toFixed(2));
      const pagoFinal = Math.max(0, Math.round(percepciones - descuentos));

      return {
        ...updatedEmp,
        percepciones,
        descuentos,
        pagoFinal
      };
    });

    let totalPercepciones = 0;
    let totalDescuentos = 0;
    let totalPagoNeto = 0;
    let totalFaltas = 0;
    let totalHorasExtrasMonto = 0;
    updatedList.forEach(e => {
      totalPercepciones += e.percepciones;
      totalDescuentos += e.descuentos;
      totalPagoNeto += e.pagoFinal;
      totalFaltas += e.faltas;
      totalHorasExtrasMonto += e.extrasMonto;
    });

    setSemanaActual({
      ...semanaActual,
      empleados: updatedList,
      totales: {
        totalPercepciones: Number(totalPercepciones.toFixed(2)),
        totalDescuentos: Number(totalDescuentos.toFixed(2)),
        totalPagoNeto: Number(totalPagoNeto.toFixed(2)),
        totalEmpleados: updatedList.length,
        totalFaltas,
        totalHorasExtrasMonto: Number(totalHorasExtrasMonto.toFixed(2))
      }
    });
  };

  // Auto-save on blur
  const handleInlineBlur = async (emp: NominaEmpleado) => {
    try {
      await fetch(`/api/rh/nomina/${emp.rowNumber}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emp)
      });
      setSavedRowMap(prev => ({ ...prev, [emp.rowNumber]: true }));
      setTimeout(() => {
        setSavedRowMap(prev => ({ ...prev, [emp.rowNumber]: false }));
      }, 1500);
    } catch (e) {
      console.warn('Error auto-guardando ajuste:', e);
    }
  };

  // Save Employee Adjustments from Modal
  const handleSaveAjustes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    try {
      const res = await fetch(`/api/rh/nomina/${editingEmp.rowNumber}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingEmp)
      });
      if (!res.ok) throw new Error('Error guardando ajustes');
      const data = await res.json();

      if (semanaActual) {
        const updatedList = semanaActual.empleados.map(emp =>
          emp.rowNumber === data.empleado.rowNumber ? data.empleado : emp
        );
        setSemanaActual({
          ...semanaActual,
          empleados: updatedList,
          totales: data.totales
        });
      }
      setEditingEmp(null);
      setSuccessMsg(`Ajustes guardados para ${data.empleado.nombreCompleto}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Mark as sent via WhatsApp
  const handleWhatsAppClick = async (emp: NominaEmpleado) => {
    if (!emp.linkWhatsApp) {
      alert(`El colaborador ${emp.nombreCompleto} no tiene número de WhatsApp registrado a 10 dígitos.`);
      return;
    }

    window.open(emp.linkWhatsApp, '_blank');

    try {
      await fetch(`/api/rh/nomina/whatsapp-enviado/${emp.rowNumber}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enviado: true })
      });

      if (semanaActual) {
        setSemanaActual({
          ...semanaActual,
          empleados: semanaActual.empleados.map(e =>
            e.rowNumber === emp.rowNumber ? { ...e, whatsappEnviado: true } : e
          )
        });
      }
    } catch (e) {
      console.warn('No se pudo marcar enviado en servidor:', e);
    }
  };

  // Archive week
  const handleArchivarNomina = async () => {
    if (!window.confirm('¿Confirmas archivar la nómina de esta semana? Se guardará en el histórico y en Google Sheets ("nomina producción historico").')) {
      return;
    }

    setArchiving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/rh/nomina/archivar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al archivar nómina');

      setSuccessMsg(data.message || 'Semana de nómina archivada con éxito.');
      await loadNomina();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  };

  // Print individual receipt
  const handlePrintReceipt = (emp: NominaEmpleado) => {
    setViewingReceipt(emp);
    const isRuta = emp.puesto.toUpperCase().includes('RUTA') || emp.departamento.toUpperCase().includes('RUTA');
    setReceiptFormat(isRuta ? 'ruta' : 'produccion');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  // Filtered employees
  const filteredEmpleados = useMemo(() => {
    if (!semanaActual?.empleados) return [];
    return semanaActual.empleados.filter(e => {
      const matchSearch =
        e.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.curp && e.curp.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchDept = true;
      if (deptFilter !== 'TODOS') {
        const isRuta = e.puesto.toUpperCase().includes('RUTA') || e.departamento.toUpperCase().includes('RUTA');
        if (deptFilter === 'RUTAS') matchDept = isRuta;
        else if (deptFilter === 'PLANTA') matchDept = !isRuta && e.tipoJornada !== 'gerencia';
        else if (deptFilter === 'GERENCIA') matchDept = e.tipoJornada === 'gerencia';
      }

      return matchSearch && matchDept;
    });
  }, [semanaActual?.empleados, searchTerm, deptFilter]);

  // Column totals for the 8 manual fields
  const totals8 = useMemo(() => {
    let totPagosPendientes = 0;
    let totBonosExtras = 0;
    let totPrestamos = 0;
    let totAbonos = 0;
    let totGasolina = 0;
    let totNotas = 0;
    let totTienda = 0;
    let totCobrosPendientes = 0;

    filteredEmpleados.forEach(e => {
      totPagosPendientes += e.pagosPendientes || 0;
      totBonosExtras += e.bonosExtras || 0;
      totPrestamos += e.prestamos || 0;
      totAbonos += e.abonos || 0;
      totGasolina += e.gasolina || 0;
      totNotas += e.notasQueseria || 0;
      totTienda += e.tienda || 0;
      totCobrosPendientes += e.cobrosPendientes || 0;
    });

    return {
      totPagosPendientes,
      totBonosExtras,
      totPrestamos,
      totAbonos,
      totGasolina,
      totNotas,
      totTienda,
      totCobrosPendientes
    };
  }, [filteredEmpleados]);

  const formatMoney = (val: number) => {
    return '$' + Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 md:p-6 print:p-0 print:m-0 print:max-w-none">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt-area, #printable-receipt-area * {
            visibility: visible;
          }
          #printable-receipt-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* HEADER BAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Nómina & Recibos Digitales
                </h1>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                  <ShieldCheck className="w-3 h-3" /> Padrón RH Activo
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Alimentada exclusivamente por colaboradores <strong>ACTIVOS</strong> de RH ({filteredEmpleados.length} en nómina). Captura directa de los 8 conceptos manuales.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Week Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <select
                value={selectedSemanaId}
                onChange={e => {
                  setSelectedSemanaId(e.target.value);
                  loadNomina(e.target.value);
                }}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {semanasDisponibles.map(s => (
                  <option key={s.id} value={s.id}>
                    Semana {s.semanaNum} ({s.periodo}) {s.esActiva ? '• ACTIVA' : '• CERRADA'}
                  </option>
                ))}
              </select>
            </div>

            {/* Recalculate */}
            {!semanaActual?.cerrada && (
              <button
                onClick={() => handleRecalcular(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                title="Sincronizar y recalcular datos desde Padrón RH y Checadas"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Sincronizando...' : 'Recalcular'}</span>
              </button>
            )}

            {/* Bulk WhatsApp */}
            <button
              onClick={() => setShowBulkWhatsAppModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>📱 WhatsApp a Todos</span>
            </button>

            {/* Batch Print */}
            <button
              onClick={() => setShowBatchPrintModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ Imprimir Todos</span>
            </button>

            {/* Archive Week */}
            {!semanaActual?.cerrada && (
              <button
                onClick={handleArchivarNomina}
                disabled={archiving}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{archiving ? 'Archivando...' : 'Archivar Semana'}</span>
              </button>
            )}
          </div>
        </div>

        {/* NOTIFICATIONS */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 font-bold text-sm">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800 font-bold text-sm">✕</button>
          </div>
        )}

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-2 mt-5 border-b border-slate-100 pb-2">
          <button
            onClick={() => setActiveTab('nomina')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'nomina'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>1. Control y Cálculo de Nómina</span>
          </button>

          <button
            onClick={() => setActiveTab('recibos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'recibos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Recibos Digitales y Envío</span>
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'historico'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>3. Historial de Nóminas</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 no-print">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Activos en Nómina</p>
            <p className="text-lg font-black text-slate-900">{filteredEmpleados.length} colaboradores</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Percepciones</p>
            <p className="text-lg font-black text-emerald-700">{formatMoney(semanaActual?.totales.totalPercepciones || 0)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deducciones</p>
            <p className="text-lg font-black text-rose-700">-{formatMoney(semanaActual?.totales.totalDescuentos || 0)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider">Pago Neto Total</p>
            <p className="text-xl font-black text-indigo-900">{formatMoney(semanaActual?.totales.totalPagoNeto || 0)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Horas Extras Monto</p>
            <p className="text-lg font-black text-amber-700">{formatMoney(semanaActual?.totales.totalHorasExtrasMonto || 0)}</p>
          </div>
        </div>
      </div>

      {/* TAB 1: CONTROL & CÁLCULO DE NÓMINA (INTERACTIVE GRID WITH 8 MANUAL FIELDS) */}
      {activeTab === 'nomina' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden no-print">
          {/* Filter & View Mode Switcher */}
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dept filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs font-bold text-slate-700">
                {(['TODOS', 'PLANTA', 'RUTAS', 'GERENCIA'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDeptFilter(f)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      deptFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Vista de Columnas:</span>
              <button
                onClick={() => setTableMode('manual8')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  tableMode === 'manual8'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Captura Directa (8 Campos Manuales)</span>
              </button>
              <button
                onClick={() => setTableMode('resumen')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  tableMode === 'resumen'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Resumen Compacto</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="p-3 whitespace-nowrap">#</th>
                  <th className="p-3 whitespace-nowrap">Colaborador (RH)</th>
                  <th className="p-3 whitespace-nowrap">Puesto / Jornada</th>
                  <th className="p-3 text-right whitespace-nowrap">Sueldo Base</th>
                  <th className="p-3 text-center whitespace-nowrap">Faltas</th>
                  <th className="p-3 text-center whitespace-nowrap">Extras</th>

                  {tableMode === 'manual8' ? (
                    <>
                      {/* 3 Percepciones manuales (Verdes) */}
                      <th className="p-2.5 text-center bg-emerald-50 text-emerald-900 border-l border-emerald-200 whitespace-nowrap">
                        PAGOS PEND. ($)
                      </th>
                      <th className="p-2.5 text-center bg-emerald-50 text-emerald-900 whitespace-nowrap">
                        BONOS EXTRAS ($)
                      </th>
                      <th className="p-2.5 text-center bg-emerald-50 text-emerald-900 whitespace-nowrap">
                        PRÉSTAMOS ($)
                      </th>

                      {/* 5 Deducciones manuales (Rojas) */}
                      <th className="p-2.5 text-center bg-rose-50 text-rose-900 border-l border-rose-200 whitespace-nowrap">
                        ABONOS ($)
                      </th>
                      <th className="p-2.5 text-center bg-rose-50 text-rose-900 whitespace-nowrap">
                        GASOLINA ($)
                      </th>
                      <th className="p-2.5 text-center bg-rose-50 text-rose-900 whitespace-nowrap">
                        NOTAS QUESERÍA ($)
                      </th>
                      <th className="p-2.5 text-center bg-rose-50 text-rose-900 whitespace-nowrap">
                        TIENDA ($)
                      </th>
                      <th className="p-2.5 text-center bg-rose-50 text-rose-900 whitespace-nowrap">
                        COBROS PEND. ($)
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="p-3 text-right text-emerald-700 whitespace-nowrap">Percepciones</th>
                      <th className="p-3 text-right text-rose-600 whitespace-nowrap">Deducciones</th>
                    </>
                  )}

                  <th className="p-3 text-right text-indigo-900 font-black whitespace-nowrap bg-indigo-50/50">
                    Pago Final
                  </th>
                  <th className="p-3 text-center whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmpleados.map((emp, idx) => {
                  const isRuta = emp.puesto.toUpperCase().includes('RUTA') || emp.departamento.toUpperCase().includes('RUTA');
                  const isSaved = savedRowMap[emp.rowNumber];

                  return (
                    <tr
                      key={emp.rowNumber || idx}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="p-3 font-mono text-slate-400 font-bold whitespace-nowrap">{idx + 1}</td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{emp.nombreCompleto}</span>
                          {isSaved && (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded animate-pulse">✓</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {emp.numeroEmpleado || emp.id} • CURP: {emp.curp || 'S/N'}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{emp.puesto}</div>
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 ${
                          isRuta ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {emp.tipoJornada}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatMoney(emp.salarioBase)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {emp.faltas > 0 ? (
                          <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            {emp.faltas} d (-{formatMoney(emp.faltasMonto)})
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {emp.extrasMonto > 0 ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {emp.extras} (+{formatMoney(emp.extrasMonto)})
                          </span>
                        ) : (
                          <span className="text-slate-400">0:00</span>
                        )}
                      </td>

                      {/* 8 INPUTS MANUALES DIRECTOS EN LA REJILLA (ORDEN EXACTO DE LA HOJA DE CÁLCULO) */}
                      {tableMode === 'manual8' ? (
                        <>
                          {/* 1. PAGOS PENDIENTES (Verde) */}
                          <td className="p-1.5 text-center bg-emerald-50/30 border-l border-emerald-100">
                            <input
                              type="number"
                              step="any"
                              value={emp.pagosPendientes || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'pagosPendientes', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-emerald-200 rounded-lg text-xs text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                            />
                          </td>

                          {/* 2. BONOS EXTRAS (Verde) */}
                          <td className="p-1.5 text-center bg-emerald-50/30">
                            <input
                              type="number"
                              step="any"
                              value={emp.bonosExtras || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'bonosExtras', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-emerald-200 rounded-lg text-xs text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                            />
                          </td>

                          {/* 3. PRÉSTAMOS (Verde - Otorgados) */}
                          <td className="p-1.5 text-center bg-emerald-50/30">
                            <input
                              type="number"
                              step="any"
                              value={emp.prestamos || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'prestamos', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-emerald-200 rounded-lg text-xs text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                            />
                          </td>

                          {/* 4. ABONOS (Rojo - Descuento semanal) */}
                          <td className="p-1.5 text-center bg-rose-50/30 border-l border-rose-100">
                            <input
                              type="number"
                              step="any"
                              value={emp.abonos || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'abonos', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-rose-200 rounded-lg text-xs text-rose-800 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                            />
                          </td>

                          {/* 5. GASOLINA (Rojo) */}
                          <td className="p-1.5 text-center bg-rose-50/30">
                            <input
                              type="number"
                              step="any"
                              value={emp.gasolina || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'gasolina', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-rose-200 rounded-lg text-xs text-rose-800 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                            />
                          </td>

                          {/* 6. NOTAS QUESERÍA (Rojo) */}
                          <td className="p-1.5 text-center bg-rose-50/30">
                            <input
                              type="number"
                              step="any"
                              value={emp.notasQueseria || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'notasQueseria', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-rose-200 rounded-lg text-xs text-rose-800 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                            />
                          </td>

                          {/* 7. TIENDA (Rojo) */}
                          <td className="p-1.5 text-center bg-rose-50/30">
                            <input
                              type="number"
                              step="any"
                              value={emp.tienda || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'tienda', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-rose-200 rounded-lg text-xs text-rose-800 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                            />
                          </td>

                          {/* 8. COBROS PENDIENTES (Rojo) */}
                          <td className="p-1.5 text-center bg-rose-50/30">
                            <input
                              type="number"
                              step="any"
                              value={emp.cobrosPendientes || ''}
                              onChange={e => handleInlineChange(emp.rowNumber, 'cobrosPendientes', e.target.value)}
                              onBlur={() => handleInlineBlur(emp)}
                              placeholder="0"
                              className="w-20 text-center font-mono font-semibold py-1 px-1.5 bg-white border border-rose-200 rounded-lg text-xs text-rose-800 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatMoney(emp.percepciones)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                            -{formatMoney(emp.descuentos)}
                          </td>
                        </>
                      )}

                      {/* Pago Final */}
                      <td className="p-3 text-right font-mono font-black text-indigo-900 bg-indigo-50/50 text-sm whitespace-nowrap">
                        {formatMoney(emp.pagoFinal)}
                      </td>

                      {/* Acciones */}
                      <td className="p-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Edit Modal */}
                          <button
                            onClick={() => setEditingEmp(emp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Editar en ventana flotante"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* View Digital Receipt */}
                          <button
                            onClick={() => {
                              setViewingReceipt(emp);
                              setReceiptFormat(isRuta ? 'ruta' : 'produccion');
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Ver Recibo Digital"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* WhatsApp */}
                          <button
                            onClick={() => handleWhatsAppClick(emp)}
                            className={`p-1.5 rounded-lg transition-all ${
                              emp.whatsappEnviado
                                ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={emp.whatsappEnviado ? 'Recibo enviado por WhatsApp (Hacer clic para reenviar)' : 'Enviar Recibo por WhatsApp'}
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          {/* Print */}
                          <button
                            onClick={() => handlePrintReceipt(emp)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
                            title="Imprimir Recibo"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Fila de Totales de Columnas */}
              <tfoot>
                <tr className="bg-slate-100/90 font-bold text-slate-800 text-[11px] border-t-2 border-slate-300">
                  <td colSpan={3} className="p-3 text-slate-600 uppercase">
                    Totales ({filteredEmpleados.length} Activos):
                  </td>
                  <td className="p-3 text-right font-mono font-black">
                    {formatMoney(filteredEmpleados.reduce((acc, e) => acc + e.salarioBase, 0))}
                  </td>
                  <td className="p-3 text-center text-rose-700">
                    {filteredEmpleados.reduce((acc, e) => acc + e.faltas, 0)} d
                  </td>
                  <td className="p-3 text-center text-emerald-700 font-mono">
                    {formatMoney(filteredEmpleados.reduce((acc, e) => acc + e.extrasMonto, 0))}
                  </td>

                  {tableMode === 'manual8' ? (
                    <>
                      <td className="p-2 text-center font-mono text-emerald-800 bg-emerald-50/50">
                        {formatMoney(totals8.totPagosPendientes)}
                      </td>
                      <td className="p-2 text-center font-mono text-emerald-800 bg-emerald-50/50">
                        {formatMoney(totals8.totBonosExtras)}
                      </td>
                      <td className="p-2 text-center font-mono text-emerald-800 bg-emerald-50/50">
                        {formatMoney(totals8.totPrestamos)}
                      </td>
                      <td className="p-2 text-center font-mono text-rose-800 bg-rose-50/50">
                        {formatMoney(totals8.totAbonos)}
                      </td>
                      <td className="p-2 text-center font-mono text-rose-800 bg-rose-50/50">
                        {formatMoney(totals8.totGasolina)}
                      </td>
                      <td className="p-2 text-center font-mono text-rose-800 bg-rose-50/50">
                        {formatMoney(totals8.totNotas)}
                      </td>
                      <td className="p-2 text-center font-mono text-rose-800 bg-rose-50/50">
                        {formatMoney(totals8.totTienda)}
                      </td>
                      <td className="p-2 text-center font-mono text-rose-800 bg-rose-50/50">
                        {formatMoney(totals8.totCobrosPendientes)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-right font-mono font-black text-emerald-700">
                        {formatMoney(semanaActual?.totales.totalPercepciones || 0)}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-rose-700">
                        -{formatMoney(semanaActual?.totales.totalDescuentos || 0)}
                      </td>
                    </>
                  )}

                  <td className="p-3 text-right font-mono font-black text-indigo-950 text-base bg-indigo-100/50">
                    {formatMoney(semanaActual?.totales.totalPagoNeto || 0)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RECIBOS DIGITALES (VISUAL PREVIEWS & 1-CLICK SEND) */}
      {activeTab === 'recibos' && (
        <div className="space-y-4 no-print">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Galería de Recibos de Nómina</h2>
              <p className="text-xs text-slate-500">Selecciona cualquier colaborador para previsualizar o enviar su recibo.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Plantilla Activa:</span>
              <button
                onClick={() => setReceiptFormat('produccion')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  receiptFormat === 'produccion' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Planta / General (Reciboformato)
              </button>
              <button
                onClick={() => setReceiptFormat('ruta')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  receiptFormat === 'ruta' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Ventas-Ruta (reciboruta)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmpleados.map(emp => {
              const isRuta = emp.puesto.toUpperCase().includes('RUTA') || emp.departamento.toUpperCase().includes('RUTA');

              return (
                <div
                  key={emp.rowNumber}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
                          {emp.semana}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{emp.nombreCompleto}</h3>
                        <p className="text-xs text-slate-500">{emp.puesto} • Sueldo Base: {formatMoney(emp.salarioBase)}</p>
                      </div>
                      {emp.whatsappEnviado && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3" /> Enviado
                        </span>
                      )}
                    </div>

                    <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Percepciones:</span>
                        <span className="font-bold text-emerald-700">{formatMoney(emp.percepciones)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Deducciones:</span>
                        <span className="font-bold text-rose-600">-{formatMoney(emp.descuentos)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 flex justify-between font-black text-slate-900 text-sm">
                        <span>Neto a Pagar:</span>
                        <span className="text-indigo-900">{formatMoney(emp.pagoFinal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setViewingReceipt(emp);
                        setReceiptFormat(isRuta ? 'ruta' : 'produccion');
                      }}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Recibo</span>
                    </button>

                    <button
                      onClick={() => handleWhatsAppClick(emp)}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => handlePrintReceipt(emp)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                      title="Imprimir"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORIAL DE NÓMINAS */}
      {activeTab === 'historico' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 no-print">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historial de Semanas de Nómina</h2>
            <p className="text-xs text-slate-500">Consulta las nóminas archivadas anteriormente con su desglose y recibos originales.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {semanasDisponibles.map(s => (
              <div key={s.id} className="py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">Semana {s.semanaNum} - {s.anio}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.esActiva ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {s.esActiva ? 'EN CURSO (ACTIVA)' : 'ARCHIVADA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Periodo: {s.periodo} {s.fechaCierre ? `• Cierre: ${new Date(s.fechaCierre).toLocaleDateString('es-MX')}` : ''}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedSemanaId(s.id);
                      loadNomina(s.id);
                      setActiveTab('nomina');
                    }}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>Cargar Nómina</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: AJUSTE DE NÓMINA EMPLEADO */}
      {editingEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-base">Ajustes de Nómina Semanal</h3>
                <p className="text-xs text-slate-500 font-semibold">{editingEmp.nombreCompleto} • {editingEmp.puesto}</p>
              </div>
              <button
                onClick={() => setEditingEmp(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAjustes} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Resumen de Asistencia */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Sueldo Base (RH):</span>
                  <p className="font-black text-slate-800">{formatMoney(editingEmp.salarioBase)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Faltas Checadas:</span>
                  <p className="font-black text-rose-600">{editingEmp.faltas} días ({formatMoney(editingEmp.faltasMonto)})</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Extras Checadas:</span>
                  <p className="font-black text-emerald-700">{editingEmp.extras} ({formatMoney(editingEmp.extrasMonto)})</p>
                </div>
              </div>

              {/* Percepciones adicionales */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-700">
                  <TrendingUp className="w-3.5 h-3.5" /> Percepciones y Entregas (Verde)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">PAGOSPENDIENTES ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.pagosPendientes || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, pagosPendientes: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">BONOSEXTRAS ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.bonosExtras || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, bonosExtras: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">PRÉSTAMOS ($ Otorgados)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.prestamos || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, prestamos: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Deducciones semanales */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-700">
                  <Percent className="w-3.5 h-3.5" /> Deducciones Semanales (Rojo)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">ABONOS ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.abonos || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, abonos: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">GASOLINA ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.gasolina || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, gasolina: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">NOTASQUESERIA ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.notasQueseria || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, notasQueseria: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">TIENDA ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.tienda || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, tienda: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">COBROSPENDIENTES ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.cobrosPendientes || ''}
                      onChange={e => setEditingEmp({ ...editingEmp, cobrosPendientes: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Guardar y Recalcular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER RECIBO DIGITAL INDIVIDUAL */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Plantilla:</span>
                <button
                  onClick={() => setReceiptFormat('produccion')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    receiptFormat === 'produccion' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Planta / General
                </button>
                <button
                  onClick={() => setReceiptFormat('ruta')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    receiptFormat === 'ruta' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Ventas-Ruta
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleWhatsAppClick(viewingReceipt)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Recibo Preview Container */}
            <div className="p-6 bg-slate-50 overflow-y-auto max-h-[80vh]">
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
                <ReceiptTemplate
                  emp={viewingReceipt}
                  format={receiptFormat}
                  formatMoney={formatMoney}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENVÍO MASIVO WHATSAPP */}
      {showBulkWhatsAppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Envío de Recibos por WhatsApp</h3>
                  <p className="text-xs text-slate-500">Envía el comprobante digital personalizado a cada colaborador en 1 clic.</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkWhatsAppModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Progreso de Envío:</span>
                <span className="text-emerald-700">
                  {semanaActual?.empleados.filter(e => e.whatsappEnviado).length || 0} de {semanaActual?.empleados.length || 0} Enviados
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {semanaActual?.empleados.map((emp, idx) => (
                  <div key={emp.rowNumber || idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{emp.nombreCompleto}</div>
                      <div className="text-[10px] text-slate-400">
                        {emp.telefonoWhatsapp || 'Sin número'} • Sueldo Base: {formatMoney(emp.salarioBase)} • Neto: {formatMoney(emp.pagoFinal)}
                      </div>
                    </div>

                    <div>
                      {emp.whatsappEnviado ? (
                        <button
                          onClick={() => handleWhatsAppClick(emp)}
                          className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Reenviar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleWhatsAppClick(emp)}
                          className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Recibo</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowBulkWhatsAppModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Cerrar Asistente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPRESIÓN POR LOTES (BATCH PRINT ALL RECEIPTS) */}
      {showBatchPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Vista de Impresión Masiva</h3>
                <p className="text-xs text-slate-500">Se imprimirán todos los {filteredEmpleados.length} recibos con salto de página para firma física.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Todos ({filteredEmpleados.length})</span>
                </button>
                <button
                  onClick={() => setShowBatchPrintModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-100 max-h-[75vh] overflow-y-auto space-y-6">
              {filteredEmpleados.map((emp, i) => {
                const isRuta = emp.puesto.toUpperCase().includes('RUTA') || emp.departamento.toUpperCase().includes('RUTA');
                return (
                  <div key={emp.rowNumber} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <ReceiptTemplate
                      emp={emp}
                      format={isRuta ? 'ruta' : 'produccion'}
                      formatMoney={formatMoney}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY AREA: HIDDEN ON SCREEN, VISIBLE ON WINDOW.PRINT() */}
      <div id="printable-receipt-area" className="hidden print:block">
        {showBatchPrintModal ? (
          filteredEmpleados.map((emp, i) => {
            const isRuta = emp.puesto.toUpperCase().includes('RUTA') || emp.departamento.toUpperCase().includes('RUTA');
            return (
              <div key={emp.rowNumber} className="page-break mb-8">
                <ReceiptTemplate
                  emp={emp}
                  format={isRuta ? 'ruta' : 'produccion'}
                  formatMoney={formatMoney}
                />
              </div>
            );
          })
        ) : (
          viewingReceipt && (
            <ReceiptTemplate
              emp={viewingReceipt}
              format={receiptFormat}
              formatMoney={formatMoney}
            />
          )
        )}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTE VISUAL DEL RECIBO (DIGITAL & PRINT)
// ==========================================
interface ReceiptTemplateProps {
  emp: NominaEmpleado;
  format: 'produccion' | 'ruta';
  formatMoney: (val: number) => string;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ emp, format, formatMoney }) => {
  if (format === 'ruta') {
    return (
      <div className="font-sans text-slate-800 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <img src="/logo-trujillos.png" alt="Lácteos Trujillos" className="h-12 w-auto object-contain" />
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">LÁCTEOS TRUJILLOS</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recibo de Nómina • Ventas-Ruta</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-slate-900 uppercase">{emp.semana}</div>
            <div className="text-[10px] text-slate-500">{emp.periodoDePago}</div>
            <div className="text-[10px] font-bold text-emerald-800">Fecha de Pago: {emp.fechaDePago}</div>
          </div>
        </div>

        {/* Datos Colaborador */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Colaborador:</span>
            <p className="font-black text-slate-900">{emp.nombreCompleto}</p>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Puesto:</span>
            <p className="font-bold text-slate-800">Ventas-Ruta</p>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Sueldo Base (RH):</span>
            <p className="font-bold text-slate-800">{formatMoney(emp.salarioBase)}</p>
          </div>
        </div>

        {/* Resumen de Ventas por Día (Lunes a Sábado) */}
        <div className="mb-3">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
            Resumen de Ventas Semanales (Efectivo & Transferencias)
          </h4>
          <table className="w-full text-[10px] border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-center">
                <th className="border border-slate-300 p-1">Lunes</th>
                <th className="border border-slate-300 p-1">Martes</th>
                <th className="border border-slate-300 p-1">Miércoles</th>
                <th className="border border-slate-300 p-1">Jueves</th>
                <th className="border border-slate-300 p-1">Viernes</th>
                <th className="border border-slate-300 p-1">Sábado</th>
                <th className="border border-slate-300 p-1 bg-amber-50">Total Venta</th>
                <th className="border border-slate-300 p-1 bg-emerald-50">Comisión (2.5%)</th>
              </tr>
            </thead>
            <tbody className="text-center font-mono">
              <tr>
                <td className="border border-slate-300 p-1">{formatMoney(emp.ventasPorDia?.lunes.efectivo || 0)}</td>
                <td className="border border-slate-300 p-1">{formatMoney(emp.ventasPorDia?.martes.efectivo || 0)}</td>
                <td className="border border-slate-300 p-1">{formatMoney(emp.ventasPorDia?.miercoles.efectivo || 0)}</td>
                <td className="border border-slate-300 p-1">{formatMoney(emp.ventasPorDia?.jueves.efectivo || 0)}</td>
                <td className="border border-slate-300 p-1">{formatMoney(emp.ventasPorDia?.viernes.efectivo || 0)}</td>
                <td className="border border-slate-300 p-1">{formatMoney(emp.ventasPorDia?.sabado.efectivo || 0)}</td>
                <td className="border border-slate-300 p-1 font-bold bg-amber-50/50">{formatMoney(emp.totalVentaSemanal || 0)}</td>
                <td className="border border-slate-300 p-1 font-bold text-emerald-800 bg-emerald-50/50">{formatMoney(emp.comisionRuta || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tablas Percepciones y Deducciones */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Percepciones */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-emerald-50 text-emerald-900 font-bold p-1.5 text-[11px] text-center border-b border-slate-300">
              PERCEPCIONES
            </div>
            <div className="p-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Sueldo Base:</span>
                <span className="font-mono font-bold">{formatMoney(emp.salarioBase)}</span>
              </div>
              <div className="flex justify-between">
                <span>Comisión Rutas (2.5%):</span>
                <span className="font-mono font-bold">{formatMoney(emp.comisionRuta || 0)}</span>
              </div>
              {emp.bonosExtras > 0 && (
                <div className="flex justify-between">
                  <span>Bonos Extras (BONOSEXTRAS):</span>
                  <span className="font-mono font-bold">{formatMoney(emp.bonosExtras)}</span>
                </div>
              )}
              {emp.pagosPendientes > 0 && (
                <div className="flex justify-between">
                  <span>Pagos Pendientes:</span>
                  <span className="font-mono font-bold">{formatMoney(emp.pagosPendientes)}</span>
                </div>
              )}
              {emp.prestamos > 0 && (
                <div className="flex justify-between">
                  <span>Préstamo Otorgado:</span>
                  <span className="font-mono font-bold">{formatMoney(emp.prestamos)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-1 flex justify-between font-black text-emerald-800">
                <span>Total Ingresos:</span>
                <span className="font-mono">{formatMoney(emp.percepciones)}</span>
              </div>
            </div>
          </div>

          {/* Deducciones */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-rose-50 text-rose-900 font-bold p-1.5 text-[11px] text-center border-b border-slate-300">
              DEDUCCIONES
            </div>
            <div className="p-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Faltas ({emp.faltas} d):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.faltasMonto)}</span>
              </div>
              {emp.gasolina > 0 && (
                <div className="flex justify-between">
                  <span>Movilidad / Gasolina:</span>
                  <span className="font-mono font-bold">-{formatMoney(emp.gasolina)}</span>
                </div>
              )}
              {emp.tienda > 0 && (
                <div className="flex justify-between">
                  <span>Crédito Tienda:</span>
                  <span className="font-mono font-bold">-{formatMoney(emp.tienda)}</span>
                </div>
              )}
              {emp.notasQueseria > 0 && (
                <div className="flex justify-between">
                  <span>Notas Quesería:</span>
                  <span className="font-mono font-bold">-{formatMoney(emp.notasQueseria)}</span>
                </div>
              )}
              {emp.cobrosPendientes > 0 && (
                <div className="flex justify-between">
                  <span>Cobros Pendientes:</span>
                  <span className="font-mono font-bold">-{formatMoney(emp.cobrosPendientes)}</span>
                </div>
              )}
              {emp.abonos > 0 && (
                <div className="flex justify-between">
                  <span>Abono Préstamo:</span>
                  <span className="font-mono font-bold">-{formatMoney(emp.abonos)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-1 flex justify-between font-black text-rose-800">
                <span>Total Deducciones:</span>
                <span className="font-mono">-{formatMoney(emp.descuentos)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pago Neto Final */}
        <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between mb-4">
          <span className="font-black text-xs uppercase tracking-wider">TOTAL A PAGAR:</span>
          <span className="font-black text-lg font-mono">{formatMoney(emp.pagoFinal)} MXN</span>
        </div>

        {/* Legal Text & Signature */}
        <div className="text-[9px] text-slate-500 mb-6 text-justify">
          Recibí de Lácteos Trujillos a mi entera conformidad la cantidad neta indicada en este comprobante por concepto de pago de sueldos, comisiones y prestaciones correspondientes al periodo señalado, sin que exista adeudo alguno a mi favor.
        </div>

        <div className="pt-6 border-t border-slate-300 max-w-xs mx-auto text-center">
          <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-[10px] text-slate-800">
            {emp.nombreCompleto}
          </div>
          <div className="text-[9px] text-slate-400 uppercase font-semibold">Firma del Colaborador</div>
        </div>
      </div>
    );
  }

  // Plantilla Normal: Producción / General (Reciboformato)
  return (
    <div className="font-sans text-slate-800 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <img src="/logo-trujillos.png" alt="Lácteos Trujillos" className="h-12 w-auto object-contain" />
          <div>
            <h2 className="text-base font-black tracking-tight text-slate-900">LÁCTEOS TRUJILLOS</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Comprobante Fiscal Interno • Recibo de Nómina</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black text-slate-900 uppercase">{emp.semana}</div>
          <div className="text-[10px] text-slate-500">{emp.periodoDePago}</div>
          <div className="text-[10px] font-bold text-emerald-800">Fecha de Elaboración: {emp.fechaDePago}</div>
        </div>
      </div>

      {/* Datos del Colaborador (Formato Oficial) */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Nombre Completo:</span>
          <p className="font-black text-slate-900">{emp.nombreCompleto}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Puesto:</span>
          <p className="font-bold text-slate-800">{emp.puesto}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">CURP:</span>
          <p className="font-mono text-slate-800">{emp.curp || 'S/N'}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Método de Pago:</span>
          <p className="font-bold text-slate-800">Efectivo</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Fecha de Ingreso:</span>
          <p className="text-slate-800">{emp.fechaIngreso || 'No registrada'}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Antigüedad:</span>
          <p className="text-slate-800">{emp.antiguedad || 'Activo'}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Tipo de Jornada:</span>
          <p className="font-bold text-slate-800 uppercase">{emp.tipoJornada}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Días Vacaciones Utilizados:</span>
          <p className="font-mono text-slate-800">{emp.vacacionesUtilizadas || 0}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Incapacidades:</span>
          <p className="font-mono text-slate-800">{emp.incapacidades || 0}</p>
        </div>
      </div>

      {/* Tablas Percepciones y Deducciones */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Percepciones */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-emerald-50 text-emerald-900 font-bold p-1.5 text-[11px] text-center border-b border-slate-300 uppercase">
            DESGLOSE PERCEPCIONES
          </div>
          <div className="p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span>Sueldo Base:</span>
              <span className="font-mono font-bold">{formatMoney(emp.salarioBase)}</span>
            </div>
            {emp.tipoJornada.toLowerCase() === 'hora' && (
              <div className="flex justify-between">
                <span>Horas Trabajadas ({emp.horasTrabajadas}):</span>
                <span className="font-mono font-bold">{formatMoney(emp.montoPorHoras)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Horas Extras ({emp.extras}):</span>
              <span className="font-mono font-bold">
                {emp.extrasMonto > 0 ? formatMoney(emp.extrasMonto) : '$0.00'}
              </span>
            </div>
            {emp.bonosExtras > 0 && (
              <div className="flex justify-between">
                <span>Bonos Extras (BONOSEXTRAS):</span>
                <span className="font-mono font-bold">{formatMoney(emp.bonosExtras)}</span>
              </div>
            )}
            {emp.pagosPendientes > 0 && (
              <div className="flex justify-between">
                <span>Pagos Pendientes (PAGOSPENDIENTES):</span>
                <span className="font-mono font-bold">{formatMoney(emp.pagosPendientes)}</span>
              </div>
            )}
            {emp.prestamos > 0 && (
              <div className="flex justify-between">
                <span>Préstamo Otorgado (Prestamos):</span>
                <span className="font-mono font-bold">{formatMoney(emp.prestamos)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-1.5 flex justify-between font-black text-emerald-800">
              <span>TOTAL PERCEPCIONES:</span>
              <span className="font-mono">{formatMoney(emp.percepciones)}</span>
            </div>
          </div>
        </div>

        {/* Deducciones */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-rose-50 text-rose-900 font-bold p-1.5 text-[11px] text-center border-b border-slate-300 uppercase">
            DESGLOSE DEDUCCIONES
          </div>
          <div className="p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span>Faltas ({emp.faltas} d):</span>
              <span className="font-mono font-bold">
                {emp.faltasMonto > 0 ? `-${formatMoney(emp.faltasMonto)}` : '$0.00'}
              </span>
            </div>
            {emp.montoJornadaIncompleta > 0 && (
              <div className="flex justify-between">
                <span>Horas Jornada Incompleta ({emp.horasJornadaIncompleta}):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.montoJornadaIncompleta)}</span>
              </div>
            )}
            {emp.gasolina > 0 && (
              <div className="flex justify-between">
                <span>Movilidad (GASOLINA):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.gasolina)}</span>
              </div>
            )}
            {emp.tienda > 0 && (
              <div className="flex justify-between">
                <span>Crédito Tienda (TIENDA):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.tienda)}</span>
              </div>
            )}
            {emp.notasQueseria > 0 && (
              <div className="flex justify-between">
                <span>Crédito Notas (NOTASQUESERIA):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.notasQueseria)}</span>
              </div>
            )}
            {emp.cobrosPendientes > 0 && (
              <div className="flex justify-between">
                <span>Cobros Pendientes (COBROSPENDIENTES):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.cobrosPendientes)}</span>
              </div>
            )}
            {emp.abonos > 0 && (
              <div className="flex justify-between">
                <span>Abono Préstamo (Abonos):</span>
                <span className="font-mono font-bold">-{formatMoney(emp.abonos)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-1.5 flex justify-between font-black text-rose-800">
              <span>TOTAL DEDUCCIONES:</span>
              <span className="font-mono">-{formatMoney(emp.descuentos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gran Total Neto a Pagar */}
      <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between mb-4">
        <div>
          <span className="font-black text-xs uppercase tracking-wider block">PAGO FINAL NETO:</span>
          <span className="text-[10px] text-slate-300">Moneda Nacional (MXN)</span>
        </div>
        <span className="font-black text-xl font-mono text-emerald-400">{formatMoney(emp.pagoFinal)}</span>
      </div>

      {/* Legal Text & Signature */}
      <div className="text-[9px] text-slate-500 mb-6 text-justify">
        Recibí de Lácteos Trujillos a mi entera conformidad la cantidad neta indicada en este comprobante por concepto de pago de sueldos, percepciones y prestaciones devengadas correspondientes al periodo señalado, sin quedar adeudo pendiente a la fecha.
      </div>

      <div className="pt-6 border-t border-slate-300 max-w-xs mx-auto text-center">
        <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-[10px] text-slate-800">
          {emp.nombreCompleto}
        </div>
        <div className="text-[9px] text-slate-400 uppercase font-semibold">Firma del Colaborador</div>
      </div>
    </div>
  );
};
