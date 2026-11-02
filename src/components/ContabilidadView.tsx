import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, PlusCircle, History, TrendingUp, TrendingDown, DollarSign, 
  Calendar, Building, CheckCircle2, RefreshCw, Search, Filter, 
  ArrowUpRight, ArrowDownLeft, Download, Trash2, PieChart, Layers, 
  Milk, User, CreditCard, ChevronLeft, ChevronRight, FileSpreadsheet,
  AlertCircle, BarChart3, HelpCircle, Eye, ArrowRight
} from 'lucide-react';
import EstadoResultadosView from './EstadoResultadosView';

interface MovimientoContable {
  id: string;
  fecha: string;
  fechaSheet?: string;
  empresa: string;
  tipoMovimiento: 'Entrada' | 'Salida' | 'Control';
  cuentaMenor: string;
  monto: number;
  motivo: string;
  autoriza: string;
  cuentaFiscal: string;
  folio?: string;
  litros?: number;
  precioPorLitro?: number;
  semana: string;
  semanaNum: number;
  mes: string;
  año: number;
  totalNeto: number;
  dia: string;
  rowNumber?: number;
}

interface ContabilidadViewProps {
  token: string;
  state?: any;
  role?: string;
  user?: any;
}

const CUENTAS_MENORES = [
  { value: 'Ruta', label: 'Ruta', tipoDefault: 'Entrada', group: 'Ingresos' },
  { value: 'Venta directa', label: 'Venta directa', tipoDefault: 'Entrada', group: 'Ingresos' },
  { value: 'Manzanillo Ruta 6', label: 'Manzanillo Ruta 6', tipoDefault: 'Entrada', group: 'Ingresos' },
  { value: 'Ventas Manzanillo', label: 'Ventas Manzanillo', tipoDefault: 'Entrada', group: 'Ingresos' },
  { value: 'Gastos', label: 'Gastos generales', tipoDefault: 'Salida', group: 'Egresos' },
  { value: 'Gastos Manzanillo', label: 'Gastos Manzanillo', tipoDefault: 'Salida', group: 'Egresos' },
  { value: 'Gastos Rutas', label: 'Gastos Rutas', tipoDefault: 'Salida', group: 'Egresos' },
  { value: 'Insumos', label: 'Insumos y Materias', tipoDefault: 'Salida', group: 'Egresos' },
  { value: 'Rancho', label: 'Rancho', tipoDefault: 'Salida', group: 'Egresos' },
  { value: 'Nómina', label: 'Nómina', tipoDefault: 'Salida', group: 'Nómina' },
  { value: 'Nómina Manzanillo', label: 'Nómina Manzanillo', tipoDefault: 'Salida', group: 'Nómina' },
  { value: 'leche', label: 'Leche (Materia Prima)', tipoDefault: 'Salida', group: 'Materia Prima' },
  { value: 'Crédito', label: 'Crédito', tipoDefault: 'Salida', group: 'Administrativos' },
  { value: 'Diferencia en calculo', label: 'Diferencia en cálculo', tipoDefault: 'Salida', group: 'Administrativos' }
];

const CUENTAS_FISCALES = [
  'Efectivo',
  'Banorte',
  'Crédito',
  'Efectivo manzanillo'
];

const MESES_LIST = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const DIAS_SEMANA = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
];

// Excel =NUM.DE.SEMANA(fecha, 1)
function getExcelWeekNumber(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((target.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const startDayOfWeek = yearStart.getDay();
  return Math.ceil((dayOfYear + startDayOfWeek) / 7);
}

export default function ContabilidadView({ token, state, role, user }: ContabilidadViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'capturador' | 'bitacora' | 'estado_resultados'>('capturador');

  // Form State
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [empresa, setEmpresa] = useState<'Quesería' | 'Rancho'>('Quesería');
  const [tipoMovimiento, setTipoMovimiento] = useState<'Entrada' | 'Salida' | 'Control'>('Salida');
  const [cuentaMenor, setCuentaMenor] = useState('Gastos');
  const [monto, setMonto] = useState<string>('');
  const [motivo, setMotivo] = useState('');
  const [autoriza, setAutoriza] = useState(() => user?.displayName || user?.username || 'Usuario');
  const [cuentaFiscal, setCuentaFiscal] = useState('Efectivo');
  const [folio, setFolio] = useState('');
  const [litros, setLitros] = useState<string>('');
  const [precioPorLitro, setPrecioPorLitro] = useState<string>('');

  // UI status
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bitácora State
  const [movimientos, setMovimientos] = useState<MovimientoContable[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    totalEntradas: 0,
    totalSalidas: 0,
    totalNeto: 0,
    totalLeche: 0,
    totalLitrosLeche: 0
  });

  // Bitácora Filters
  const [filterYear, setFilterYear] = useState<string>('2026');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterSemana, setFilterSemana] = useState<string>('');
  const [filterCuentaMenor, setFilterCuentaMenor] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterCuentaFiscal, setFilterCuentaFiscal] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [syncingSheets, setSyncingSheets] = useState(false);

  // Auto-calculated formula preview for the current form input
  const formulaPreview = useMemo(() => {
    let d = new Date();
    if (fecha) {
      const parts = fecha.split('-');
      if (parts.length === 3) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    const semNum = getExcelWeekNumber(d);
    const semLabel = `Semana ${semNum}`;
    const mesLabel = MESES_LIST[d.getMonth()];
    const añoLabel = d.getFullYear();
    const diaLabel = DIAS_SEMANA[d.getDay()];

    const mVal = parseFloat(monto) || 0;
    const lVal = parseFloat(litros) || 0;
    const pVal = parseFloat(precioPorLitro) || 0;

    let neto = 0;
    if (empresa.toLowerCase() === 'rancho') {
      neto = 0;
    } else if (cuentaMenor.toLowerCase() === 'leche') {
      neto = Number((lVal * pVal).toFixed(2));
    } else if (tipoMovimiento === 'Salida') {
      neto = -Math.abs(mVal);
    } else if (tipoMovimiento === 'Control') {
      neto = 0;
    } else {
      neto = Math.abs(mVal);
    }

    return {
      semanaNum: semNum,
      semanaLabel: semLabel,
      mesLabel,
      añoLabel,
      diaLabel,
      totalNeto: neto
    };
  }, [fecha, empresa, tipoMovimiento, cuentaMenor, monto, litros, precioPorLitro]);

  // When picking a cuenta menor, smart-adjust the tipoMovimiento
  const handleCuentaMenorChange = (newVal: string) => {
    setCuentaMenor(newVal);
    const found = CUENTAS_MENORES.find(c => c.value.toLowerCase() === newVal.toLowerCase());
    if (found) {
      setTipoMovimiento(found.tipoDefault as any);
    }
  };

  // When litros or precioPorLitro change, update monto automatically
  useEffect(() => {
    if (cuentaMenor.toLowerCase() === 'leche') {
      const l = parseFloat(litros) || 0;
      const p = parseFloat(precioPorLitro) || 0;
      if (l > 0 && p > 0) {
        setMonto((l * p).toFixed(2));
      }
    }
  }, [litros, precioPorLitro, cuentaMenor]);

  // Load Bitácora Movimientos
  const loadMovimientos = async (page = 1) => {
    setLoadingMovs(true);
    try {
      const params = new URLSearchParams();
      if (filterYear) params.append('year', filterYear);
      if (filterMes) params.append('mes', filterMes);
      if (filterSemana) params.append('semana', filterSemana);
      if (filterCuentaMenor) params.append('cuentaMenor', filterCuentaMenor);
      if (filterTipo) params.append('tipo', filterTipo);
      if (filterCuentaFiscal) params.append('cuentaFiscal', filterCuentaFiscal);
      if (filterSearch) params.append('search', filterSearch);
      params.append('page', String(page));
      params.append('limit', '50');

      const res = await fetch(`/api/contabilidad/movimientos?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar movimientos');
      const data = await res.json();
      setMovimientos(data.movimientos || []);
      setTotalRows(data.total || 0);
      setCurrentPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMovs(false);
    }
  };

  // Sync Google Sheet manually
  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    try {
      const res = await fetch('/api/contabilidad/sync-sheets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`¡Sincronización exitosa! Se cargaron ${data.count} movimientos de Google Sheets.`);
        loadMovimientos(1);
      } else {
        alert(`Error al sincronizar: ${data.error || 'Desconocido'}`);
      }
    } catch (err: any) {
      alert(`Error de red al sincronizar: ${err.message}`);
    } finally {
      setSyncingSheets(false);
    }
  };

  // Form Submit
  const handleSubmitMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const mVal = parseFloat(monto);
    if (isNaN(mVal) || mVal <= 0) {
      setSaveError('El monto debe ser un número mayor a cero');
      setSaving(false);
      return;
    }

    try {
      const payload: any = {
        fecha,
        empresa,
        tipoMovimiento,
        cuentaMenor,
        monto: mVal,
        motivo,
        autoriza,
        cuentaFiscal,
        folio
      };

      if (cuentaMenor.toLowerCase() === 'leche') {
        payload.litros = parseFloat(litros) || 0;
        payload.precioPorLitro = parseFloat(precioPorLitro) || 0;
      }

      const res = await fetch('/api/contabilidad/movimientos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(`¡Movimiento registrado con éxito! Folio/ID: ${data.movimiento.id}. Sincronizado a Google Sheets.`);
        setMonto('');
        setMotivo('');
        setFolio('');
        setLitros('');
        setPrecioPorLitro('');
        loadMovimientos(1);
      } else {
        setSaveError(data.error || 'No se pudo guardar el movimiento');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error de red al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  // Delete movement
  const handleDeleteMovimiento = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este movimiento del registro local?')) return;
    try {
      const res = await fetch(`/api/contabilidad/movimientos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        loadMovimientos(currentPage);
      } else {
        alert(data.message || 'Error al eliminar');
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Load data when changing tabs
  useEffect(() => {
    if (activeSubTab === 'bitacora') {
      loadMovimientos(1);
    }
  }, [activeSubTab, filterYear, filterMes, filterSemana, filterCuentaMenor, filterTipo, filterCuentaFiscal]);

  // Format currency
  const fmt = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Export filtered CSV
  const handleExportCSV = () => {
    if (movimientos.length === 0) return;
    const headers = [
      'Fecha', 'Día', 'Semana', 'Mes', 'Año', 'Empresa', 'Tipo', 'Cuenta Menor',
      'Monto', 'Total Neto', 'Motivo', 'Caja / Cuenta', 'Autoriza', 'Folio', 'Litros', 'Precio/Litro'
    ];
    const rows = movimientos.map(m => [
      `"${m.fecha}"`,
      `"${m.dia}"`,
      `"${m.semana}"`,
      `"${m.mes}"`,
      m.año,
      `"${m.empresa}"`,
      `"${m.tipoMovimiento}"`,
      `"${m.cuentaMenor}"`,
      m.monto,
      m.totalNeto,
      `"${(m.motivo || '').replace(/"/g, '""')}"`,
      `"${m.cuentaFiscal}"`,
      `"${m.autoriza}"`,
      `"${m.folio || ''}"`,
      m.litros || '',
      m.precioPorLitro || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contabilidad_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <Calculator className="w-8 h-8 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">Contabilidad y Movimientos</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Google Sheets Live
              </span>
            </div>
            <p className="text-sm text-emerald-100/80 mt-0.5">
              Capturador ágil de movimientos, bitácora histórica y consulta de Estado de Resultados.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncSheets}
            disabled={syncingSheets}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Sincronizar directamente con la pestaña Contabilidad de tu Google Sheet"
          >
            <RefreshCw className={`w-4 h-4 ${syncingSheets ? 'animate-spin text-emerald-300' : ''}`} />
            <span>{syncingSheets ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-full sm:w-fit shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('capturador')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'capturador'
              ? 'bg-white text-emerald-800 shadow-md border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <PlusCircle className={`w-4 h-4 ${activeSubTab === 'capturador' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>Capturador de Movimientos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('bitacora')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'bitacora'
              ? 'bg-white text-emerald-800 shadow-md border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <History className={`w-4 h-4 ${activeSubTab === 'bitacora' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>Bitácora de Movimientos</span>
          <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
            {totalRows > 0 ? totalRows.toLocaleString() : '12k+'}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('estado_resultados')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'estado_resultados'
              ? 'bg-white text-emerald-800 shadow-md border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${activeSubTab === 'estado_resultados' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>Estado de Resultados</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: CAPTURADOR ÁGIL DE MOVIMIENTOS                  */}
      {/* ========================================================= */}
      {activeSubTab === 'capturador' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Nuevo Movimiento Contable</h2>
                <p className="text-xs text-slate-500">
                  Las columnas automáticas de semana, mes, año, día y total neto se calculan sin errores.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Pestaña: Contabilidad!A:P
              </span>
            </div>

            {saveSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {saveError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitMovimiento} className="space-y-5">
              {/* Row 1: Fecha & Empresa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna A: Fecha *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna B: Empresa *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEmpresa('Quesería')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        empresa === 'Quesería'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🧀 Quesería
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmpresa('Rancho')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        empresa === 'Rancho'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚜 Rancho
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Tipo de Movimiento & Cuenta Menor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna C: Tipo de Movimiento *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoMovimiento('Entrada')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        tipoMovimiento === 'Entrada'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoMovimiento('Salida')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        tipoMovimiento === 'Salida'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Salida
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoMovimiento('Control')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        tipoMovimiento === 'Control'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Control
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna D: Cuenta Menor (Categoría) *
                  </label>
                  <select
                    value={cuentaMenor}
                    onChange={(e) => handleCuentaMenorChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold bg-white"
                  >
                    <optgroup label="Ingresos">
                      <option value="Ruta">Ruta</option>
                      <option value="Venta directa">Venta directa</option>
                      <option value="Manzanillo Ruta 6">Manzanillo Ruta 6</option>
                      <option value="Ventas Manzanillo">Ventas Manzanillo</option>
                    </optgroup>
                    <optgroup label="Egresos y Gastos">
                      <option value="Gastos">Gastos generales</option>
                      <option value="Gastos Manzanillo">Gastos Manzanillo</option>
                      <option value="Gastos Rutas">Gastos Rutas</option>
                      <option value="Insumos">Insumos</option>
                      <option value="Rancho">Rancho</option>
                    </optgroup>
                    <optgroup label="Nómina">
                      <option value="Nómina">Nómina</option>
                      <option value="Nómina Manzanillo">Nómina Manzanillo</option>
                    </optgroup>
                    <optgroup label="Materia Prima">
                      <option value="leche">Leche (Litros × Precio)</option>
                    </optgroup>
                    <optgroup label="Crédito y Ajustes">
                      <option value="Crédito">Crédito</option>
                      <option value="Diferencia en calculo">Diferencia en cálculo</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Special row for LECHE: Columns J & K */}
              {cuentaMenor.toLowerCase() === 'leche' && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Milk className="w-4 h-4 text-amber-600" />
                    <span>Campos Especiales de Leche (Columnas J y K)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-800 mb-1">
                        Columna J: Litros de Leche
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ej. 1250"
                        value={litros}
                        onChange={(e) => setLitros(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-800 mb-1">
                        Columna K: Precio por Litro ($ MXN)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ej. 10.50"
                        value={precioPorLitro}
                        onChange={(e) => setPrecioPorLitro(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                      />
                    </div>
                  </div>
                  {litros && precioPorLitro && (
                    <div className="text-xs font-semibold text-amber-900 bg-amber-100/70 px-3 py-1.5 rounded-lg flex items-center justify-between">
                      <span>Cálculo automático: {litros} Lts × ${precioPorLitro}</span>
                      <span className="font-black text-amber-950 text-sm">
                        Total = {fmt((parseFloat(litros) || 0) * (parseFloat(precioPorLitro) || 0))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Row 3: Monto & Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna E: Monto ($ MXN) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-base font-black rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna F: Motivo o Descripción *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pago chofer ruta sur, Compra de sal, Venta mostrador..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* Row 4: Autoriza, Cuenta Fiscal & Folio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna G: Usuario / Autoriza *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={autoriza}
                      onChange={(e) => setAutoriza(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna H: Cuenta / Caja *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <select
                      value={cuentaFiscal}
                      onChange={(e) => setCuentaFiscal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold bg-white"
                    >
                      {CUENTAS_FISCALES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Columna I: Folio (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. F-1048"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                  <span>{saving ? 'Guardando en Sheets...' : 'Guardar y Enviar a Google Sheet'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Preview Column: Col L, M, N, O, P formulas */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 border border-slate-700 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  Cálculo Automático
                </span>
                <span className="text-[10px] text-slate-400">Columnas L - P</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300">Columna L (Semana):</span>
                  <span className="text-xs font-black text-white bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/30">
                    {formulaPreview.semanaLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300">Columna M (Mes):</span>
                  <span className="text-xs font-bold text-white capitalize">
                    {formulaPreview.mesLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300">Columna N (Año):</span>
                  <span className="text-xs font-bold text-white">
                    {formulaPreview.añoLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300">Columna P (Día):</span>
                  <span className="text-xs font-bold text-white capitalize">
                    {formulaPreview.diaLabel}
                  </span>
                </div>

                {/* Col O formula calculation */}
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-300">Columna O: Total Neto</span>
                    <span className={`text-base font-black ${
                      formulaPreview.totalNeto > 0 ? 'text-emerald-400' :
                      formulaPreview.totalNeto < 0 ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {fmt(formulaPreview.totalNeto)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    {empresa.toLowerCase() === 'rancho'
                      ? 'Empresa Rancho: 0 en Total Neto'
                      : cuentaMenor.toLowerCase() === 'leche'
                      ? 'Leche: Litros × Precio'
                      : tipoMovimiento === 'Salida'
                      ? 'Salida: Monto con signo negativo (-1 * E)'
                      : 'Entrada: Monto con signo positivo (+E)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick tips card */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                Reglas del Sistema
              </h4>
              <ul className="text-xs text-emerald-800/90 space-y-1.5 list-disc pl-4">
                <li>Los movimientos se guardan de inmediato en la base de datos y se agregan a tu Google Sheet.</li>
                <li>No necesitas calcular semanas ni fórmulas manualmente en Excel; el sistema lo hace automáticamente.</li>
                <li>Para movimientos de leche, ingresa litros y precio y el monto total se calculará solo.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: BITÁCORA HISTÓRICA DE MOVIMIENTOS               */}
      {/* ========================================================= */}
      {activeSubTab === 'bitacora' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Total Entradas</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg md:text-xl font-black text-emerald-700">
                {fmt(summary.totalEntradas)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Total Salidas</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-lg md:text-xl font-black text-rose-700">
                {fmt(summary.totalSalidas)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Balance Neto</span>
                <DollarSign className="w-4 h-4 text-slate-600" />
              </div>
              <div className={`text-lg md:text-xl font-black ${
                summary.totalNeto >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {fmt(summary.totalNeto)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Total Leche</span>
                <Milk className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg md:text-xl font-black text-amber-800">
                {fmt(summary.totalLeche)}
              </div>
              {summary.totalLitrosLeche > 0 && (
                <div className="text-[10px] text-amber-600 font-bold mt-0.5">
                  {summary.totalLitrosLeche.toLocaleString()} Litros
                </div>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Filter className="w-4 h-4 text-slate-500" />
                <span>Filtros de Búsqueda</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {/* Filter Year */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Año</label>
                <select
                  value={filterYear}
                  onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Todos los años</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              {/* Filter Month */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Mes</label>
                <select
                  value={filterMes}
                  onChange={(e) => { setFilterMes(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white capitalize"
                >
                  <option value="">Todos los meses</option>
                  {MESES_LIST.map(m => (
                    <option key={m} value={m} className="capitalize">{m}</option>
                  ))}
                </select>
              </div>

              {/* Filter Semana */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Semana</label>
                <select
                  value={filterSemana}
                  onChange={(e) => { setFilterSemana(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Todas</option>
                  {Array.from({ length: 53 }, (_, i) => i + 1).map(s => (
                    <option key={s} value={String(s)}>Semana {s}</option>
                  ))}
                </select>
              </div>

              {/* Filter Cuenta Menor */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Cuenta Menor</label>
                <select
                  value={filterCuentaMenor}
                  onChange={(e) => { setFilterCuentaMenor(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Todas</option>
                  {CUENTAS_MENORES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Filter Tipo */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
                <select
                  value={filterTipo}
                  onChange={(e) => { setFilterTipo(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Todos</option>
                  <option value="Entrada">Entrada</option>
                  <option value="Salida">Salida</option>
                  <option value="Control">Control</option>
                </select>
              </div>

              {/* Filter Cuenta Fiscal */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Caja / Cuenta</label>
                <select
                  value={filterCuentaFiscal}
                  onChange={(e) => { setFilterCuentaFiscal(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Todas</option>
                  {CUENTAS_FISCALES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por motivo, quien autoriza, folio o descripción..."
                value={filterSearch}
                onChange={(e) => { setFilterSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Movimientos Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loadingMovs ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                Cargando movimientos de Contabilidad...
              </div>
            ) : movimientos.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No se encontraron movimientos con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black text-[10px] tracking-wider">
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-2">Semana</th>
                      <th className="py-3 px-2">Empresa</th>
                      <th className="py-3 px-2">Tipo</th>
                      <th className="py-3 px-3">Cuenta Menor</th>
                      <th className="py-3 px-3 text-right">Monto</th>
                      <th className="py-3 px-3 text-right">Total Neto</th>
                      <th className="py-3 px-3">Motivo</th>
                      <th className="py-3 px-2">Caja / Cuenta</th>
                      <th className="py-3 px-2">Autoriza</th>
                      <th className="py-3 px-2">Folio</th>
                      <th className="py-3 px-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {m.fecha}
                          <span className="block text-[10px] text-slate-400 capitalize">{m.dia}</span>
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                            {m.semana || `Semana ${m.semanaNum}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap font-medium text-slate-700">
                          {m.empresa}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            m.tipoMovimiento === 'Entrada'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.tipoMovimiento === 'Salida'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {m.tipoMovimiento}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                          {m.cuentaMenor}
                          {m.litros && m.precioPorLitro && (
                            <span className="block text-[10px] text-amber-700 font-medium">
                              {m.litros} L × ${m.precioPorLitro}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                          {fmt(m.monto)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                          m.totalNeto > 0 ? 'text-emerald-700' :
                          m.totalNeto < 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}>
                          {fmt(m.totalNeto)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium max-w-[220px] truncate" title={m.motivo}>
                          {m.motivo || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 font-semibold whitespace-nowrap">
                          {m.cuentaFiscal}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                          {m.autoriza || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {m.folio || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteMovimiento(m.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Eliminar movimiento local"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3.5 border-t border-slate-200 bg-slate-50/50">
                <span className="text-xs text-slate-600 font-medium">
                  Página <span className="font-bold">{currentPage}</span> de <span className="font-bold">{totalPages}</span> ({totalRows.toLocaleString()} registros)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => loadMovimientos(currentPage - 1)}
                    disabled={currentPage <= 1 || loadingMovs}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => loadMovimientos(currentPage + 1)}
                    disabled={currentPage >= totalPages || loadingMovs}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: ESTADO DE RESULTADOS (SEMANA, MES, AÑO)        */}
      {/* ========================================================= */}
      {activeSubTab === 'estado_resultados' && (
        <EstadoResultadosView token={token} role={role} user={user} />
      )}
    </div>
  );
}
