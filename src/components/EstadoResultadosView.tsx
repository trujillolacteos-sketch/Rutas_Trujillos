import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, RefreshCw, 
  Download, ArrowUpRight, ArrowDownLeft, BarChart3, HelpCircle, 
  Layers, Milk, ChevronRight, Minus, PieChart, ShieldCheck, 
  FileSpreadsheet, Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  CartesianGrid, Legend 
} from 'recharts';

interface LineaEstadoResultados {
  concepto: string;
  actual: number;
  porcentajeVentas: number;
  anterior: number;
  variacionAnterior: number;
  crecimientoAnterior: number | null;
  añoPasado: number;
  porcentajeVentasAñoPasado?: number;
  variacionAñoPasado: number;
  crecimientoAñoPasado: number | null;
  litrosActual?: number;
  precioPromedioActual?: number;
}

interface ValorPeriodoReciente {
  key: string;
  label: string;
  año: number;
  semanaNum?: number;
  mes?: string;
  isActual: boolean;
  monto: number;
  porcentajeVentas: number;
  variacionVsInmediata: number;
  crecimientoVsInmediata: number | null;
}

interface LineaReciente {
  concepto: string;
  litrosActual?: number;
  precioPromedioActual?: number;
  valores: ValorPeriodoReciente[];
}

interface ColumnaPeriodoReciente {
  key: string;
  label: string;
  año: number;
  semanaNum?: number;
  mes?: string;
  isActual: boolean;
  totalIngresos: number;
  crecimientoIngresosVsInmediata: number | null;
}

interface TendenciaRecienteData {
  tipo: 'semana' | 'mes' | 'año';
  columnas: ColumnaPeriodoReciente[];
  ingresos: LineaReciente[];
  totalIngresos: LineaReciente;
  costosDirectos: LineaReciente[];
  totalCostosDirectos: LineaReciente;
  utilidadBruta: LineaReciente;
  margenBrutoPct: {
    valores: { key: string; label: string; pct: number; variacionVsInmediata: number | null }[];
  };
  gastosOperativos: LineaReciente[];
  totalGastosOperativos: LineaReciente;
  otros: LineaReciente[];
  totalOtros: LineaReciente;
  totalEgresos: LineaReciente;
  utilidadNeta: LineaReciente;
  margenNetoPct: {
    valores: { key: string; label: string; pct: number; variacionVsInmediata: number | null }[];
  };
}

interface EstadoResultadosData {
  tipo: 'semana' | 'mes' | 'año';
  periodoLabel: string;
  anteriorLabel: string;
  añoPasadoLabel: string;
  año: number;
  semana?: number;
  mes?: string;
  disponibleAños: number[];
  disponibleMeses: string[];
  disponibleSemanas: number[];

  ingresos: LineaEstadoResultados[];
  totalIngresos: LineaEstadoResultados;

  costosDirectos: LineaEstadoResultados[];
  totalCostosDirectos: LineaEstadoResultados;

  utilidadBruta: LineaEstadoResultados;
  margenBrutoPct: {
    actual: number;
    anterior: number;
    variacionAnterior: number;
    añoPasado: number;
    variacionAñoPasado: number;
  };

  gastosOperativos: LineaEstadoResultados[];
  totalGastosOperativos: LineaEstadoResultados;

  otros: LineaEstadoResultados[];
  totalOtros: LineaEstadoResultados;

  totalEgresos: LineaEstadoResultados;

  utilidadNeta: LineaEstadoResultados;
  margenNetoPct: {
    actual: number;
    anterior: number;
    variacionAnterior: number;
    añoPasado: number;
    variacionAñoPasado: number;
  };

  cuentaCorrienteRancho?: {
    lecheRecibida: number;
    litrosLeche: number;
    precioPromedioLeche: number;
    abonosRancho: number;
    creditoAbono: number;
    estado: string;
  };

  kpis: {
    ingresos: { actual: number; crecAnterior: number | null; crecAñoPasado: number | null };
    utilidadBruta: { actual: number; margenPct: number; crecAnterior: number | null };
    gastosOperativos: { actual: number; pctIngresos: number; crecAnterior: number | null };
    utilidadNeta: { actual: number; margenPct: number; crecAnterior: number | null; crecAñoPasado: number | null };
    creditoRancho?: { leche: number; abonoRancho: number; balanceCredito: number };
  };

  tendenciaReciente?: TendenciaRecienteData;
}

interface EstadoResultadosViewProps {
  token: string;
  state?: any;
  role?: string;
  user?: any;
}

const MESES_LABEL_MAP: Record<string, string> = {
  enero: 'Enero',
  febrero: 'Febrero',
  marzo: 'Marzo',
  abril: 'Abril',
  mayo: 'Mayo',
  junio: 'Junio',
  julio: 'Julio',
  agosto: 'Agosto',
  septiembre: 'Septiembre',
  octubre: 'Octubre',
  noviembre: 'Noviembre',
  diciembre: 'Diciembre'
};

// Excel NUM.DE.SEMANA helper
function getExcelWeekNumber(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((target.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const startDayOfWeek = yearStart.getDay();
  return Math.ceil((dayOfYear + startDayOfWeek) / 7);
}

export default function EstadoResultadosView({ token }: EstadoResultadosViewProps) {
  // Granularity mode
  const [tipo, setTipo] = useState<'semana' | 'mes' | 'año'>('semana');

  // Selectors
  const [año, setAño] = useState<number>(2026);
  const [semana, setSemana] = useState<number>(44);
  const [mes, setMes] = useState<string>('octubre');

  // Data & loading
  const [data, setData] = useState<EstadoResultadosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [vistaTablas, setVistaTablas] = useState<'ambas' | 'reciente' | 'anual'>('ambas');

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('tipo', tipo);
      params.append('year', String(año));
      if (tipo === 'semana') params.append('semana', String(semana));
      if (tipo === 'mes') params.append('mes', mes);

      const res = await fetch(`/api/contabilidad/estado-resultados?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar Estado de Resultados');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tipo, año, semana, mes]);

  // Jump to Current Week/Month
  const handleCurrentPeriod = () => {
    const now = new Date();
    setAño(now.getFullYear());
    if (tipo === 'semana') {
      setSemana(getExcelWeekNumber(now));
    } else if (tipo === 'mes') {
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      setMes(meses[now.getMonth()]);
    }
  };

  // Sync with Google Sheets
  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    try {
      const res = await fetch('/api/contabilidad/sync-sheets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const resJson = await res.json();
      if (resJson.success) {
        alert(`¡Sincronizado! Se recargaron ${resJson.count} movimientos.`);
        fetchData();
      } else {
        alert(resJson.error || 'Error al sincronizar');
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setSyncingSheets(false);
    }
  };

  // Formatter Currency
  const fmt = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Growth Pill Component
  const GrowthBadge = ({ value, invertColors = false }: { value: number | null | undefined; invertColors?: boolean }) => {
    if (value === null || value === undefined) {
      return <span className="text-slate-400 font-medium text-[11px]">-</span>;
    }
    const isPositive = value > 0;
    const isZero = value === 0;

    // For expenses, growth is negative for the company
    const isGood = invertColors ? !isPositive : isPositive;

    if (isZero) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
          <Minus className="w-3 h-3" /> 0.0%
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black ${
        isGood 
          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
          : 'bg-rose-100 text-rose-800 border border-rose-200'
      }`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? `+${value}%` : `${value}%`}
      </span>
    );
  };

  // Chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      {
        name: 'Ingresos',
        [data.periodoLabel]: data.totalIngresos.actual,
        [data.anteriorLabel]: data.totalIngresos.anterior,
        [data.añoPasadoLabel]: data.totalIngresos.añoPasado,
      },
      {
        name: 'Costos Directos',
        [data.periodoLabel]: data.totalCostosDirectos.actual,
        [data.anteriorLabel]: data.totalCostosDirectos.anterior,
        [data.añoPasadoLabel]: data.totalCostosDirectos.añoPasado,
      },
      {
        name: 'Utilidad Bruta',
        [data.periodoLabel]: data.utilidadBruta.actual,
        [data.anteriorLabel]: data.utilidadBruta.anterior,
        [data.añoPasadoLabel]: data.utilidadBruta.añoPasado,
      },
      {
        name: 'Gastos Operativos',
        [data.periodoLabel]: data.totalGastosOperativos.actual,
        [data.anteriorLabel]: data.totalGastosOperativos.anterior,
        [data.añoPasadoLabel]: data.totalGastosOperativos.añoPasado,
      },
      {
        name: 'Utilidad Neta',
        [data.periodoLabel]: data.utilidadNeta.actual,
        [data.anteriorLabel]: data.utilidadNeta.anterior,
        [data.añoPasadoLabel]: data.utilidadNeta.añoPasado,
      }
    ];
  }, [data]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data) return;

    const sections: string[] = [];

    // SECCIÓN 1: TABLA 1 (Últimas 4 Semanas / Períodos)
    if (data.tendenciaReciente) {
      sections.push(`"TABLA 1: COMPARATIVO RECIENTE (ÚLTIMAS 4 SEMANAS / PERÍODOS - TENDENCIA)"`);
      const recHeaders = ['Concepto'];
      data.tendenciaReciente.columnas.forEach(c => {
        recHeaders.push(`"${c.label} ($)"`);
        if (c.isActual) recHeaders.push(`"${c.label} (% Ventas)"`);
        recHeaders.push(`"${c.label} (Δ% vs Inmediata)"`);
      });
      sections.push(recHeaders.join(','));

      const allRecLines: LineaReciente[] = [
        ...data.tendenciaReciente.ingresos,
        data.tendenciaReciente.totalIngresos,
        ...data.tendenciaReciente.costosDirectos,
        data.tendenciaReciente.totalCostosDirectos,
        data.tendenciaReciente.utilidadBruta,
        ...data.tendenciaReciente.gastosOperativos,
        data.tendenciaReciente.totalGastosOperativos,
        ...data.tendenciaReciente.otros,
        data.tendenciaReciente.totalEgresos,
        data.tendenciaReciente.utilidadNeta
      ];

      allRecLines.forEach(l => {
        const row = [`"${l.concepto}"`];
        l.valores.forEach(v => {
          row.push(String(v.monto));
          if (v.isActual) row.push(`"${v.porcentajeVentas}%"`);
          row.push(v.crecimientoVsInmediata !== null ? `"${v.crecimientoVsInmediata}%"` : '""');
        });
        sections.push(row.join(','));
      });

      sections.push('""'); // separador
    }

    // SECCIÓN 2: TABLA 2 (Misma Semana vs Año Pasado)
    sections.push(`"TABLA 2: COMPARATIVO ANUAL (${data.periodoLabel} vs ${data.añoPasadoLabel}) - INTERANUAL"`);
    const anualHeaders = [
      'Concepto',
      `"${data.periodoLabel} ($)"`,
      `"${data.periodoLabel} (% Ventas)"`,
      `"${data.añoPasadoLabel} ($)"`,
      `"${data.añoPasadoLabel} (% Ventas)"`,
      '"Variación ($)"',
      '"Crecimiento Anual (%)"'
    ];
    sections.push(anualHeaders.join(','));

    const allAnualLines: LineaEstadoResultados[] = [
      ...data.ingresos,
      data.totalIngresos,
      ...data.costosDirectos,
      data.totalCostosDirectos,
      data.utilidadBruta,
      ...data.gastosOperativos,
      data.totalGastosOperativos,
      ...data.otros,
      data.totalEgresos,
      data.utilidadNeta
    ];

    allAnualLines.forEach(l => {
      sections.push([
        `"${l.concepto}"`,
        l.actual,
        `"${l.porcentajeVentas}%"`,
        l.añoPasado,
        `"${l.porcentajeVentasAñoPasado || 0}%"`,
        l.variacionAñoPasado,
        l.crecimientoAñoPasado !== null ? `"${l.crecimientoAñoPasado}%"` : '""'
      ].join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + sections.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `estado_resultados_${tipo}_${año}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/80">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/20 rounded-2xl backdrop-blur-md border border-emerald-400/30 shadow-inner">
            <BarChart3 className="w-8 h-8 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">Estado de Resultados</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                P&L Comparativo
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-0.5">
              Análisis financiero por semana, mes y año con tasas de crecimiento vs período anterior y vs año pasado.
            </p>
          </div>
        </div>

        {/* Sync & Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleSyncSheets}
            disabled={syncingSheets}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-xs font-bold text-white transition-all shadow-md disabled:opacity-50"
            title="Recargar desde la pestaña Contabilidad de Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 ${syncingSheets ? 'animate-spin' : ''}`} />
            <span>{syncingSheets ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Mode & Selectors */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-fit">
          <button
            onClick={() => setTipo('semana')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              tipo === 'semana'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Por Semana</span>
          </button>

          <button
            onClick={() => setTipo('mes')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              tipo === 'mes'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Por Mes</span>
          </button>

          <button
            onClick={() => setTipo('año')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              tipo === 'año'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Por Año</span>
          </button>
        </div>

        {/* Dynamic Period Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase">Año:</span>
            <select
              value={año}
              onChange={(e) => setAño(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[2026, 2025, 2024].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Semana Picker */}
          {tipo === 'semana' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Semana:</span>
              <select
                value={semana}
                onChange={(e) => setSemana(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Array.from({ length: 53 }, (_, i) => i + 1).map(s => (
                  <option key={s} value={s}>Semana {s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Mes Picker */}
          {tipo === 'mes' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Mes:</span>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(MESES_LABEL_MAP).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Jump to current button */}
          <button
            onClick={handleCurrentPeriod}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all"
          >
            Período Actual
          </button>

          {/* Toggle Chart */}
          <button
            onClick={() => setShowChart(!showChart)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              showChart
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {showChart ? 'Ocultar Gráfica' : 'Ver Gráfica'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-slate-500 border border-slate-200 shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
          <div className="text-base font-bold text-slate-800">Calculando Estado de Resultados...</div>
          <div className="text-xs text-slate-400 mt-1">Comparando con período anterior y año pasado</div>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
          No hay información disponible para el período seleccionado.
        </div>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Ventas / Total Ingresos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Ventas Totales</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {fmt(data.totalIngresos.actual)}
              </div>
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 truncate" title={`vs ${data.anteriorLabel}`}>
                    vs {data.anteriorLabel}:
                  </span>
                  <GrowthBadge value={data.totalIngresos.crecimientoAnterior} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 truncate" title={`vs ${data.añoPasadoLabel}`}>
                    vs {data.añoPasadoLabel}:
                  </span>
                  <GrowthBadge value={data.totalIngresos.crecimientoAñoPasado} />
                </div>
              </div>
            </div>

            {/* 2. Costos Directos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Costos Directos</span>
                <Layers className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {fmt(data.totalCostosDirectos.actual)}
              </div>
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">% s/Ventas:</span>
                  <span className="font-bold text-slate-800">{data.totalCostosDirectos.porcentajeVentas}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 truncate">vs {data.anteriorLabel}:</span>
                  <GrowthBadge value={data.totalCostosDirectos.crecimientoAnterior} invertColors={true} />
                </div>
              </div>
            </div>

            {/* 3. Utilidad Bruta */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>Utilidad Bruta</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-950">
                {fmt(data.utilidadBruta.actual)}
              </div>
              <div className="space-y-1 pt-1 border-t border-emerald-200/60">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800">Margen Bruto:</span>
                  <span className="font-black text-emerald-900">{data.margenBrutoPct.actual}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800 truncate">vs {data.anteriorLabel}:</span>
                  <GrowthBadge value={data.utilidadBruta.crecimientoAnterior} />
                </div>
              </div>
            </div>

            {/* 4. Gastos Operativos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Gastos Operación</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {fmt(data.totalGastosOperativos.actual)}
              </div>
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">% s/Ventas:</span>
                  <span className="font-bold text-slate-800">{data.totalGastosOperativos.porcentajeVentas}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 truncate">vs {data.anteriorLabel}:</span>
                  <GrowthBadge value={data.totalGastosOperativos.crecimientoAnterior} invertColors={true} />
                </div>
              </div>
            </div>

            {/* 5. Utilidad Neta */}
            <div className={`p-4 rounded-2xl border shadow-sm space-y-2 ${
              data.utilidadNeta.actual >= 0 
                ? 'bg-slate-900 text-white border-slate-800' 
                : 'bg-rose-50 text-rose-950 border-rose-200'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold opacity-80">
                <span>Utilidad Neta</span>
                <DollarSign className="w-4 h-4" />
              </div>
              <div className={`text-xl font-black ${
                data.utilidadNeta.actual >= 0 ? 'text-emerald-400' : 'text-rose-700'
              }`}>
                {fmt(data.utilidadNeta.actual)}
              </div>
              <div className="space-y-1 pt-1 border-t border-white/10">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="opacity-80">Margen Neto:</span>
                  <span className="font-black">{data.margenNetoPct.actual}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="opacity-80 truncate">vs {data.anteriorLabel}:</span>
                  <GrowthBadge value={data.utilidadNeta.crecimientoAnterior} />
                </div>
              </div>
            </div>
          </div>

          {/* Card Destacada: Control de Crédito de Leche y Cuenta Corriente Rancho */}
          {data.cuentaCorrienteRancho && (
            <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 rounded-2xl p-5 text-white border border-amber-700/60 shadow-md space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    <Milk className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white">
                        Control de Crédito de Leche y Cuenta Corriente Rancho
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40">
                        {data.periodoLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      La leche cruda se recibe a crédito. En el Estado de Resultados el costo real son los abonos pagados al Rancho.
                    </p>
                  </div>
                </div>

                {/* Badge de Diagnóstico */}
                <div className="self-start md:self-center">
                  {data.cuentaCorrienteRancho.creditoAbono > 0 ? (
                    <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black flex items-center gap-1.5">
                      <span>⚠️ Quedó a deber al Rancho: +{fmt(data.cuentaCorrienteRancho.creditoAbono)}</span>
                    </div>
                  ) : data.cuentaCorrienteRancho.creditoAbono < 0 ? (
                    <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-black flex items-center gap-1.5">
                      <span>✅ Abonó a deuda histórica: -{fmt(Math.abs(data.cuentaCorrienteRancho.creditoAbono))}</span>
                    </div>
                  ) : (
                    <div className="px-3.5 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/40 text-xs font-black">
                      <span>Crédito liquidado sin diferencia en el período</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid de 3 Columnas: Leche Recibida, Abonos Rancho, Diferencia */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                    1. Leche Recibida (A Crédito)
                  </span>
                  <div className="text-xl font-black text-white">
                    {fmt(data.cuentaCorrienteRancho.lecheRecibida)}
                  </div>
                  <span className="text-[11px] text-slate-300 block">
                    {data.cuentaCorrienteRancho.litrosLeche.toLocaleString()} Lts a ${data.cuentaCorrienteRancho.precioPromedioLeche}/Lt prom.
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                    2. Abonos Pagados al Rancho
                  </span>
                  <div className="text-xl font-black text-emerald-300">
                    {fmt(data.cuentaCorrienteRancho.abonosRancho)}
                  </div>
                  <span className="text-[11px] text-slate-300 block">
                    Costo real contabilizado en el P&L
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    3. Crédito / Abono Neto (Leche - Rancho)
                  </span>
                  <div className={`text-xl font-black ${
                    data.cuentaCorrienteRancho.creditoAbono > 0 ? 'text-amber-300' :
                    data.cuentaCorrienteRancho.creditoAbono < 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
                    {data.cuentaCorrienteRancho.creditoAbono > 0 ? '+' : ''}{fmt(data.cuentaCorrienteRancho.creditoAbono)}
                  </div>
                  <span className="text-[11px] text-slate-300 block">
                    {data.cuentaCorrienteRancho.creditoAbono > 0 
                      ? 'Aumento de saldo por pagar al Rancho' 
                      : data.cuentaCorrienteRancho.creditoAbono < 0 
                      ? 'Reducción de saldo histórico por pagar' 
                      : 'Saldo del período liquidado'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comparative Chart */}
          {showChart && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    Comparativo Visual: {data.periodoLabel} vs Período Anterior vs Año Pasado
                  </h3>
                  <p className="text-xs text-slate-500">
                    Evolución de Ingresos, Costos y Resultados.
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} fontStyle="bold" />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val: any) => fmt(val)} />
                    <Legend />
                    <Bar dataKey={data.periodoLabel} fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={data.anteriorLabel} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={data.añoPasadoLabel} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Selector de Vista de Tablas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Tablas:</span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  onClick={() => setVistaTablas('ambas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    vistaTablas === 'ambas'
                      ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ambas Tablas
                </button>
                <button
                  onClick={() => setVistaTablas('reciente')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    vistaTablas === 'reciente'
                      ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabla 1: Últimas 4 Semanas
                </button>
                <button
                  onClick={() => setVistaTablas('anual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    vistaTablas === 'anual'
                      ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabla 2: vs Año Pasado
                </button>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-slate-500">
              {vistaTablas === 'ambas' && 'Visualizando análisis semanal reciente y comparativo interanual'}
              {vistaTablas === 'reciente' && 'Visualizando evolución de las últimas 4 semanas con % vs semana inmediata'}
              {vistaTablas === 'anual' && `Visualizando misma semana (${data.periodoLabel}) vs año pasado (${data.añoPasadoLabel})`}
            </div>
          </div>

          {/* ======================================================== */}
          {/* TABLA 1: COMPARATIVO SEMANAL RECIENTE (ÚLTIMAS 4 SEMANAS) */}
          {/* ======================================================== */}
          {(vistaTablas === 'ambas' || vistaTablas === 'reciente') && data.tendenciaReciente && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Tabla 1: Comparativo Semanal Reciente (Últimas 4 Semanas)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Tendencia Semanal
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cifras expresadas en MXN ($). Cada semana incluye su porcentaje de variación respecto a su semana inmediata anterior (Δ% vs Inmediata).
                  </p>
                </div>
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 self-start sm:self-center">
                  Período Activo: {data.periodoLabel}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider border-b border-slate-300">
                      <th rowSpan={2} className="py-3 px-4 min-w-[220px] border-r border-slate-200 bg-slate-100">
                        Concepto / Cuenta
                      </th>
                      {data.tendenciaReciente.columnas.map((col, idx) => {
                        const isActual = col.isActual;
                        return (
                          <th
                            key={col.key}
                            colSpan={isActual ? 3 : 2}
                            className={`py-2 px-3 text-center border-r border-slate-300 ${
                              isActual
                                ? 'bg-emerald-100 text-emerald-950 font-black'
                                : idx % 2 === 0
                                ? 'bg-slate-50 text-slate-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span>{col.label}</span>
                              {isActual && (
                                <span className="px-1.5 py-0.2 rounded-md bg-emerald-600 text-white text-[9px] font-bold">
                                  Actual
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                      {data.tendenciaReciente.columnas.map((col) => {
                        const isActual = col.isActual;
                        return (
                          <React.Fragment key={`sub-${col.key}`}>
                            <th className="py-2 px-3 text-right">Monto ($)</th>
                            {isActual && (
                              <th className="py-2 px-2 text-right border-r border-slate-200">% Ventas</th>
                            )}
                            <th className="py-2 px-2 text-center border-r border-slate-300">Δ% vs Inmediata</th>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Helper to render rows in Table 1 */}
                    {(() => {
                      const renderRecienteRow = (
                        l: LineaReciente,
                        opts?: {
                          isTotal?: boolean;
                          isUtilidad?: boolean;
                          customBg?: string;
                          invertColors?: boolean;
                        }
                      ) => {
                        const isTotal = opts?.isTotal;
                        const isUtilidad = opts?.isUtilidad;
                        const invert = opts?.invertColors || false;
                        return (
                          <tr
                            key={l.concepto}
                            className={`transition-colors ${
                              opts?.customBg
                                ? opts.customBg
                                : isTotal
                                ? 'bg-slate-100 font-black text-slate-900 border-t border-slate-300'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <td
                              className={`py-2 px-4 border-r border-slate-200 ${
                                isTotal ? 'font-black uppercase tracking-wide' : 'pl-8 font-medium'
                              }`}
                            >
                              {l.concepto}
                              {l.litrosActual && l.litrosActual > 0 && (
                                <span className="block text-[10px] text-amber-700 font-medium">
                                  {l.litrosActual.toLocaleString()} Lts | Promedio: ${l.precioPromedioActual}/Lt
                                </span>
                              )}
                            </td>
                            {l.valores.map((v) => (
                              <React.Fragment key={`td-${l.concepto}-${v.key}`}>
                                <td
                                  className={`py-2 px-3 text-right ${
                                    isTotal || isUtilidad ? 'font-black' : 'font-bold text-slate-900'
                                  }`}
                                >
                                  {fmt(v.monto)}
                                </td>
                                {v.isActual && (
                                  <td
                                    className={`py-2 px-2 text-right border-r border-slate-200 ${
                                      isTotal ? 'font-black' : 'text-slate-500 font-semibold'
                                    }`}
                                  >
                                    {v.porcentajeVentas}%
                                  </td>
                                )}
                                <td className="py-2 px-2 text-center border-r border-slate-300">
                                  <GrowthBadge value={v.crecimientoVsInmediata} invertColors={invert} />
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        );
                      };

                      return (
                        <>
                          {/* 1. INGRESOS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td
                              colSpan={1 + (data.tendenciaReciente.columnas.length * 2) + 1}
                              className="py-2 px-4 uppercase tracking-wider"
                            >
                              1. Ingresos Operativos (Ventas)
                            </td>
                          </tr>
                          {data.tendenciaReciente.ingresos.map((l) => renderRecienteRow(l))}
                          {renderRecienteRow(data.tendenciaReciente.totalIngresos, {
                            isTotal: true,
                            customBg: 'bg-emerald-100/70 text-emerald-950 font-black border-y-2 border-emerald-300'
                          })}

                          {/* 2. COSTOS DIRECTOS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td
                              colSpan={1 + (data.tendenciaReciente.columnas.length * 2) + 1}
                              className="py-2 px-4 uppercase tracking-wider"
                            >
                              2. Costos Directos de Producción
                            </td>
                          </tr>
                          {data.tendenciaReciente.costosDirectos.map((l) =>
                            renderRecienteRow(l, { invertColors: true })
                          )}
                          {renderRecienteRow(data.tendenciaReciente.totalCostosDirectos, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-amber-50 font-black text-amber-950 border-t border-amber-200'
                          })}

                          {/* 3. UTILIDAD BRUTA */}
                          {renderRecienteRow(data.tendenciaReciente.utilidadBruta, {
                            isUtilidad: true,
                            customBg: 'bg-emerald-50 text-emerald-950 font-black border-y-2 border-emerald-400'
                          })}
                          {/* Margen Bruto % Row */}
                          <tr className="bg-emerald-50/50 text-emerald-950 font-bold border-b border-emerald-200">
                            <td className="py-1.5 px-4 pl-8 border-r border-emerald-200 text-[11px]">
                              % Margen Bruto
                            </td>
                            {data.tendenciaReciente.margenBrutoPct.valores.map((m, idx) => {
                              const isActual = idx === data.tendenciaReciente!.margenBrutoPct.valores.length - 1;
                              return (
                                <React.Fragment key={`rec-mbruto-${m.key}`}>
                                  <td className="py-1.5 px-3 text-right font-black text-emerald-900">
                                    {m.pct}%
                                  </td>
                                  {isActual && (
                                    <td className="py-1.5 px-2 text-right border-r border-emerald-200 font-black text-emerald-800">
                                      {m.pct}%
                                    </td>
                                  )}
                                  <td className="py-1.5 px-2 text-center border-r border-slate-300">
                                    <GrowthBadge value={m.variacionVsInmediata} />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>

                          {/* 4. GASTOS OPERATIVOS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td
                              colSpan={1 + (data.tendenciaReciente.columnas.length * 2) + 1}
                              className="py-2 px-4 uppercase tracking-wider"
                            >
                              4. Gastos Operativos y Nóminas (OPEX)
                            </td>
                          </tr>
                          {data.tendenciaReciente.gastosOperativos.map((l) =>
                            renderRecienteRow(l, { invertColors: true })
                          )}
                          {renderRecienteRow(data.tendenciaReciente.totalGastosOperativos, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-rose-50 font-black text-rose-950 border-t border-rose-200'
                          })}

                          {/* 5. OTROS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td
                              colSpan={1 + (data.tendenciaReciente.columnas.length * 2) + 1}
                              className="py-2 px-4 uppercase tracking-wider"
                            >
                              5. Otros Movimientos / Administrativos
                            </td>
                          </tr>
                          {data.tendenciaReciente.otros.map((l) =>
                            renderRecienteRow(l, { invertColors: true })
                          )}
                          {renderRecienteRow(data.tendenciaReciente.totalOtros, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-slate-100 font-black text-slate-900 border-t border-slate-200'
                          })}

                          {/* TOTAL EGRESOS Y COSTOS */}
                          {renderRecienteRow(data.tendenciaReciente.totalEgresos, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-slate-200/80 font-black text-slate-900 border-t-2 border-slate-400'
                          })}

                          {/* 6. UTILIDAD NETA */}
                          {renderRecienteRow(data.tendenciaReciente.utilidadNeta, {
                            isUtilidad: true,
                            customBg: 'bg-slate-900 text-white font-black border-t-2 border-slate-950 shadow-md'
                          })}
                          {/* Margen Neto % Row */}
                          <tr className="bg-slate-800 text-slate-200 font-bold border-b border-slate-900">
                            <td className="py-1.5 px-4 pl-8 border-r border-slate-700 text-[11px]">
                              % Margen Neto
                            </td>
                            {data.tendenciaReciente.margenNetoPct.valores.map((m, idx) => {
                              const isActual = idx === data.tendenciaReciente!.margenNetoPct.valores.length - 1;
                              return (
                                <React.Fragment key={`rec-mneto-${m.key}`}>
                                  <td
                                    className={`py-1.5 px-3 text-right font-black ${
                                      m.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {m.pct}%
                                  </td>
                                  {isActual && (
                                    <td className="py-1.5 px-2 text-right border-r border-slate-700 font-black text-slate-300">
                                      {m.pct}%
                                    </td>
                                  )}
                                  <td className="py-1.5 px-2 text-center border-r border-slate-700">
                                    <GrowthBadge value={m.variacionVsInmediata} />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TABLA 2: COMPARATIVO ANUAL (MISMA SEMANA VS AÑO PASADO)  */}
          {/* ======================================================== */}
          {(vistaTablas === 'ambas' || vistaTablas === 'anual') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Tabla 2: Comparativo Anual ({data.periodoLabel} vs {data.añoPasadoLabel})
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      Misma Semana vs Año Pasado
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cifras expresadas en MXN ($). Comparación directa entre la semana seleccionada de este año contra la misma semana del año anterior.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 self-start sm:self-center">
                  Año vs Año
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider border-b border-slate-300">
                      <th rowSpan={2} className="py-3 px-4 min-w-[220px] border-r border-slate-200 bg-slate-100">
                        Concepto / Cuenta
                      </th>
                      <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-300 bg-emerald-50 text-emerald-900 font-black">
                        {data.periodoLabel} (Actual)
                      </th>
                      <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-300 bg-slate-100 text-slate-800 font-black">
                        {data.añoPasadoLabel} (Año Pasado)
                      </th>
                      <th colSpan={2} className="py-2 px-3 text-center bg-blue-50 text-blue-950 font-black">
                        Variación Interanual
                      </th>
                    </tr>
                    <tr className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2 px-3 text-right">Monto ($)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">% Ventas</th>
                      
                      <th className="py-2 px-3 text-right">Monto ($)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">% Ventas</th>

                      <th className="py-2 px-3 text-right">Diferencia ($)</th>
                      <th className="py-2 px-2 text-center">Crecimiento Anual (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Helper to render rows in Table 2 */}
                    {(() => {
                      const renderAnualRow = (
                        l: LineaEstadoResultados,
                        opts?: {
                          isTotal?: boolean;
                          isUtilidad?: boolean;
                          customBg?: string;
                          invertColors?: boolean;
                        }
                      ) => {
                        const isTotal = opts?.isTotal;
                        const isUtilidad = opts?.isUtilidad;
                        const invert = opts?.invertColors || false;
                        return (
                          <tr
                            key={l.concepto}
                            className={`transition-colors ${
                              opts?.customBg
                                ? opts.customBg
                                : isTotal
                                ? 'bg-slate-100 font-black text-slate-900 border-t border-slate-300'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <td
                              className={`py-2 px-4 border-r border-slate-200 ${
                                isTotal ? 'font-black uppercase tracking-wide' : 'pl-8 font-medium'
                              }`}
                            >
                              {l.concepto}
                              {l.litrosActual && l.litrosActual > 0 && (
                                <span className="block text-[10px] text-amber-700 font-medium">
                                  {l.litrosActual.toLocaleString()} Lts | Promedio: ${l.precioPromedioActual}/Lt
                                </span>
                              )}
                            </td>
                            {/* Actual */}
                            <td className={`py-2 px-3 text-right ${isTotal || isUtilidad ? 'font-black' : 'font-bold text-slate-900'}`}>
                              {fmt(l.actual)}
                            </td>
                            <td className={`py-2 px-2 text-right border-r border-slate-200 ${isTotal ? 'font-black' : 'text-slate-500 font-semibold'}`}>
                              {l.porcentajeVentas}%
                            </td>

                            {/* Año Pasado */}
                            <td className={`py-2 px-3 text-right ${isTotal || isUtilidad ? 'font-bold' : 'text-slate-600'}`}>
                              {fmt(l.añoPasado)}
                            </td>
                            <td className={`py-2 px-2 text-right border-r border-slate-200 ${isTotal ? 'font-bold' : 'text-slate-500 font-semibold'}`}>
                              {l.porcentajeVentasAñoPasado || 0}%
                            </td>

                            {/* Variación */}
                            <td className={`py-2 px-3 text-right font-semibold ${isTotal || isUtilidad ? 'font-bold' : 'text-slate-700'}`}>
                              {fmt(l.variacionAñoPasado)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <GrowthBadge value={l.crecimientoAñoPasado} invertColors={invert} />
                            </td>
                          </tr>
                        );
                      };

                      return (
                        <>
                          {/* 1. INGRESOS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td colSpan={7} className="py-2 px-4 uppercase tracking-wider">
                              1. Ingresos Operativos (Ventas)
                            </td>
                          </tr>
                          {data.ingresos.map((l) => renderAnualRow(l))}
                          {renderAnualRow(data.totalIngresos, {
                            isTotal: true,
                            customBg: 'bg-emerald-100/70 text-emerald-950 font-black border-y-2 border-emerald-300'
                          })}

                          {/* 2. COSTOS DIRECTOS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td colSpan={7} className="py-2 px-4 uppercase tracking-wider">
                              2. Costos Directos de Producción
                            </td>
                          </tr>
                          {data.costosDirectos.map((l) => renderAnualRow(l, { invertColors: true }))}
                          {renderAnualRow(data.totalCostosDirectos, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-amber-50 font-black text-amber-950 border-t border-amber-200'
                          })}

                          {/* 3. UTILIDAD BRUTA */}
                          {renderAnualRow(data.utilidadBruta, {
                            isUtilidad: true,
                            customBg: 'bg-emerald-50 text-emerald-950 font-black border-y-2 border-emerald-400'
                          })}
                          {/* Margen Bruto % Row */}
                          <tr className="bg-emerald-50/50 text-emerald-950 font-bold border-b border-emerald-200">
                            <td className="py-1.5 px-4 pl-8 border-r border-emerald-200 text-[11px]">
                              % Margen Bruto
                            </td>
                            <td className="py-1.5 px-3 text-right font-black text-emerald-900">
                              {data.margenBrutoPct.actual}%
                            </td>
                            <td className="py-1.5 px-2 text-right border-r border-emerald-200 font-black text-emerald-800">
                              {data.margenBrutoPct.actual}%
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-700">
                              {data.margenBrutoPct.añoPasado}%
                            </td>
                            <td className="py-1.5 px-2 text-right border-r border-slate-200 font-semibold text-slate-500">
                              {data.margenBrutoPct.añoPasado}%
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-800">
                              {data.margenBrutoPct.variacionAñoPasado > 0 ? '+' : ''}{data.margenBrutoPct.variacionAñoPasado} pts
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <GrowthBadge value={data.margenBrutoPct.variacionAñoPasado} />
                            </td>
                          </tr>

                          {/* 4. GASTOS OPERATIVOS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td colSpan={7} className="py-2 px-4 uppercase tracking-wider">
                              4. Gastos Operativos y Nóminas (OPEX)
                            </td>
                          </tr>
                          {data.gastosOperativos.map((l) => renderAnualRow(l, { invertColors: true }))}
                          {renderAnualRow(data.totalGastosOperativos, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-rose-50 font-black text-rose-950 border-t border-rose-200'
                          })}

                          {/* 5. OTROS */}
                          <tr className="bg-slate-100/70 font-black text-slate-800 text-[11px]">
                            <td colSpan={7} className="py-2 px-4 uppercase tracking-wider">
                              5. Otros Movimientos / Administrativos
                            </td>
                          </tr>
                          {data.otros.map((l) => renderAnualRow(l, { invertColors: true }))}
                          {renderAnualRow(data.totalOtros, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-slate-100 font-black text-slate-900 border-t border-slate-200'
                          })}

                          {/* TOTAL EGRESOS Y COSTOS */}
                          {renderAnualRow(data.totalEgresos, {
                            isTotal: true,
                            invertColors: true,
                            customBg: 'bg-slate-200/80 font-black text-slate-900 border-t-2 border-slate-400'
                          })}

                          {/* 6. UTILIDAD NETA */}
                          {renderAnualRow(data.utilidadNeta, {
                            isUtilidad: true,
                            customBg: 'bg-slate-900 text-white font-black border-t-2 border-slate-950 shadow-md'
                          })}
                          {/* Margen Neto % Row */}
                          <tr className="bg-slate-800 text-slate-200 font-bold border-b border-slate-900">
                            <td className="py-1.5 px-4 pl-8 border-r border-slate-700 text-[11px]">
                              % Margen Neto
                            </td>
                            <td className={`py-1.5 px-3 text-right font-black ${data.margenNetoPct.actual >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {data.margenNetoPct.actual}%
                            </td>
                            <td className="py-1.5 px-2 text-right border-r border-slate-700 font-black text-slate-300">
                              {data.margenNetoPct.actual}%
                            </td>
                            <td className={`py-1.5 px-3 text-right font-bold ${data.margenNetoPct.añoPasado >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {data.margenNetoPct.añoPasado}%
                            </td>
                            <td className="py-1.5 px-2 text-right border-r border-slate-700 font-semibold text-slate-400">
                              {data.margenNetoPct.añoPasado}%
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-200">
                              {data.margenNetoPct.variacionAñoPasado > 0 ? '+' : ''}{data.margenNetoPct.variacionAñoPasado} pts
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <GrowthBadge value={data.margenNetoPct.variacionAñoPasado} />
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
