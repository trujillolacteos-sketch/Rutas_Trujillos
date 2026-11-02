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
  variacionAñoPasado: number;
  crecimientoAñoPasado: number | null;
  litrosActual?: number;
  precioPromedioActual?: number;
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

  kpis: {
    ingresos: { actual: number; crecAnterior: number | null; crecAñoPasado: number | null };
    utilidadBruta: { actual: number; margenPct: number; crecAnterior: number | null };
    gastosOperativos: { actual: number; pctIngresos: number; crecAnterior: number | null };
    utilidadNeta: { actual: number; margenPct: number; crecAnterior: number | null; crecAñoPasado: number | null };
  };
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
    const headers = [
      'Concepto',
      `${data.periodoLabel} ($)`,
      '% s/Ventas',
      `${data.anteriorLabel} ($)`,
      'Variación vs Ant ($)',
      'Crecimiento vs Ant (%)',
      `${data.añoPasadoLabel} ($)`,
      'Variación vs Año Pasado ($)',
      'Crecimiento vs Año Pasado (%)'
    ];

    const allLines: LineaEstadoResultados[] = [
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

    const rows = allLines.map(l => [
      `"${l.concepto}"`,
      l.actual,
      `${l.porcentajeVentas}%`,
      l.anterior,
      l.variacionAnterior,
      l.crecimientoAnterior !== null ? `${l.crecimientoAnterior}%` : '',
      l.añoPasado,
      l.variacionAñoPasado,
      l.crecimientoAñoPasado !== null ? `${l.crecimientoAñoPasado}%` : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
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

          {/* Formal Estado de Resultados Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Estado de Resultados Consolidado: {data.periodoLabel}
                </h3>
                <p className="text-xs text-slate-500">
                  Cifras expresadas en MXN ($). Análisis vertical (% sobre ventas) y variaciones porcentuales (Δ%).
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200">
                P&L Comparativo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider border-b border-slate-300">
                    <th rowSpan={2} className="py-3 px-4 min-w-[220px] border-r border-slate-200">
                      Concepto / Cuenta
                    </th>
                    <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-300 bg-emerald-50 text-emerald-900">
                      {data.periodoLabel} (Actual)
                    </th>
                    <th colSpan={3} className="py-2 px-3 text-center border-r border-slate-300 bg-slate-100 text-slate-800">
                      vs {data.anteriorLabel}
                    </th>
                    <th colSpan={3} className="py-2 px-3 text-center bg-slate-200/60 text-slate-800">
                      vs {data.añoPasadoLabel}
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2 px-3 text-right">Monto ($)</th>
                    <th className="py-2 px-2 text-right border-r border-slate-300">% Ventas</th>
                    
                    <th className="py-2 px-3 text-right">Monto Ant.</th>
                    <th className="py-2 px-3 text-right">Dif ($)</th>
                    <th className="py-2 px-2 text-center border-r border-slate-300">Crec. (%)</th>

                    <th className="py-2 px-3 text-right">Mismo Per. Ant.</th>
                    <th className="py-2 px-3 text-right">Dif ($)</th>
                    <th className="py-2 px-2 text-center">Crec. (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* ================= 1. INGRESOS POR VENTAS ================= */}
                  <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px]">
                    <td colSpan={9} className="py-2 px-4 uppercase tracking-wider">
                      1. Ingresos Operativos (Ventas)
                    </td>
                  </tr>
                  {data.ingresos.map(l => (
                    <tr key={l.concepto} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 pl-8 font-medium text-slate-700 border-r border-slate-100">
                        {l.concepto}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {fmt(l.actual)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 border-r border-slate-200 font-semibold">
                        {l.porcentajeVentas}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.anterior)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAnterior)}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-200">
                        <GrowthBadge value={l.crecimientoAnterior} />
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.añoPasado)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAñoPasado)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <GrowthBadge value={l.crecimientoAñoPasado} />
                      </td>
                    </tr>
                  ))}
                  {/* TOTAL INGRESOS ROW */}
                  <tr className="bg-emerald-100/70 text-emerald-950 font-black border-y-2 border-emerald-300">
                    <td className="py-2.5 px-4 font-black border-r border-emerald-300 uppercase tracking-wide">
                      {data.totalIngresos.concepto}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-sm text-emerald-950">
                      {fmt(data.totalIngresos.actual)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-emerald-300 font-black">
                      100.0%
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {fmt(data.totalIngresos.anterior)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {fmt(data.totalIngresos.variacionAnterior)}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-emerald-300">
                      <GrowthBadge value={data.totalIngresos.crecimientoAnterior} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {fmt(data.totalIngresos.añoPasado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {fmt(data.totalIngresos.variacionAñoPasado)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <GrowthBadge value={data.totalIngresos.crecimientoAñoPasado} />
                    </td>
                  </tr>

                  {/* ================= 2. COSTOS DIRECTOS ================= */}
                  <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px]">
                    <td colSpan={9} className="py-2 px-4 uppercase tracking-wider">
                      2. Costos Directos de Producción
                    </td>
                  </tr>
                  {data.costosDirectos.map(l => (
                    <tr key={l.concepto} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 pl-8 font-medium text-slate-700 border-r border-slate-100">
                        {l.concepto}
                        {l.litrosActual && l.litrosActual > 0 && (
                          <span className="block text-[10px] text-amber-700 font-medium">
                            {l.litrosActual.toLocaleString()} Lts | Promedio: ${l.precioPromedioActual}/Lt
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {fmt(l.actual)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 border-r border-slate-200 font-semibold">
                        {l.porcentajeVentas}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.anterior)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAnterior)}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-200">
                        <GrowthBadge value={l.crecimientoAnterior} invertColors={true} />
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.añoPasado)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAñoPasado)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <GrowthBadge value={l.crecimientoAñoPasado} invertColors={true} />
                      </td>
                    </tr>
                  ))}
                  {/* TOTAL COSTOS DIRECTOS */}
                  <tr className="bg-amber-50 font-black text-amber-950 border-t border-amber-200">
                    <td className="py-2.5 px-4 font-black border-r border-amber-200 uppercase tracking-wide">
                      {data.totalCostosDirectos.concepto}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-amber-950">
                      {fmt(data.totalCostosDirectos.actual)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-amber-200 font-black text-amber-800">
                      {data.totalCostosDirectos.porcentajeVentas}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalCostosDirectos.anterior)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalCostosDirectos.variacionAnterior)}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-amber-200">
                      <GrowthBadge value={data.totalCostosDirectos.crecimientoAnterior} invertColors={true} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalCostosDirectos.añoPasado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalCostosDirectos.variacionAñoPasado)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <GrowthBadge value={data.totalCostosDirectos.crecimientoAñoPasado} invertColors={true} />
                    </td>
                  </tr>

                  {/* ================= 3. UTILIDAD BRUTA ================= */}
                  <tr className="bg-emerald-50 text-emerald-950 font-black border-y-2 border-emerald-400">
                    <td className="py-3 px-4 font-black text-sm border-r border-emerald-300">
                      = {data.utilidadBruta.concepto}
                      <span className="block text-[10px] font-bold text-emerald-700">
                        Margen Bruto: {data.margenBrutoPct.actual}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-sm text-emerald-900">
                      {fmt(data.utilidadBruta.actual)}
                    </td>
                    <td className="py-3 px-2 text-right border-r border-emerald-300 font-black text-emerald-800">
                      {data.margenBrutoPct.actual}%
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadBruta.anterior)}
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadBruta.variacionAnterior)}
                    </td>
                    <td className="py-3 px-2 text-center border-r border-emerald-300">
                      <GrowthBadge value={data.utilidadBruta.crecimientoAnterior} />
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadBruta.añoPasado)}
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadBruta.variacionAñoPasado)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <GrowthBadge value={data.utilidadBruta.crecimientoAñoPasado} />
                    </td>
                  </tr>

                  {/* ================= 4. GASTOS OPERATIVOS ================= */}
                  <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px]">
                    <td colSpan={9} className="py-2 px-4 uppercase tracking-wider">
                      4. Gastos Operativos y Nóminas (OPEX)
                    </td>
                  </tr>
                  {data.gastosOperativos.map(l => (
                    <tr key={l.concepto} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 pl-8 font-medium text-slate-700 border-r border-slate-100">
                        {l.concepto}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {fmt(l.actual)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 border-r border-slate-200 font-semibold">
                        {l.porcentajeVentas}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.anterior)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAnterior)}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-200">
                        <GrowthBadge value={l.crecimientoAnterior} invertColors={true} />
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.añoPasado)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAñoPasado)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <GrowthBadge value={l.crecimientoAñoPasado} invertColors={true} />
                      </td>
                    </tr>
                  ))}
                  {/* TOTAL GASTOS OPERATIVOS */}
                  <tr className="bg-rose-50 font-black text-rose-950 border-t border-rose-200">
                    <td className="py-2.5 px-4 font-black border-r border-rose-200 uppercase tracking-wide">
                      {data.totalGastosOperativos.concepto}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-950">
                      {fmt(data.totalGastosOperativos.actual)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-rose-200 font-black text-rose-800">
                      {data.totalGastosOperativos.porcentajeVentas}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalGastosOperativos.anterior)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalGastosOperativos.variacionAnterior)}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-rose-200">
                      <GrowthBadge value={data.totalGastosOperativos.crecimientoAnterior} invertColors={true} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalGastosOperativos.añoPasado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalGastosOperativos.variacionAñoPasado)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <GrowthBadge value={data.totalGastosOperativos.crecimientoAñoPasado} invertColors={true} />
                    </td>
                  </tr>

                  {/* ================= 5. OTROS GASTOS / INGRESOS ================= */}
                  <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px]">
                    <td colSpan={9} className="py-2 px-4 uppercase tracking-wider">
                      5. Otros Movimientos / Administrativos
                    </td>
                  </tr>
                  {data.otros.map(l => (
                    <tr key={l.concepto} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 pl-8 font-medium text-slate-700 border-r border-slate-100">
                        {l.concepto}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {fmt(l.actual)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 border-r border-slate-200 font-semibold">
                        {l.porcentajeVentas}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.anterior)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAnterior)}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-200">
                        <GrowthBadge value={l.crecimientoAnterior} invertColors={true} />
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {fmt(l.añoPasado)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {fmt(l.variacionAñoPasado)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <GrowthBadge value={l.crecimientoAñoPasado} invertColors={true} />
                      </td>
                    </tr>
                  ))}

                  {/* ================= TOTAL EGRESOS Y COSTOS ================= */}
                  <tr className="bg-slate-200/80 font-black text-slate-900 border-t-2 border-slate-400">
                    <td className="py-2.5 px-4 font-black border-r border-slate-400 uppercase tracking-wide">
                      {data.totalEgresos.concepto}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-950">
                      {fmt(data.totalEgresos.actual)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-slate-400 font-black">
                      {data.totalEgresos.porcentajeVentas}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalEgresos.anterior)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalEgresos.variacionAnterior)}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-400">
                      <GrowthBadge value={data.totalEgresos.crecimientoAnterior} invertColors={true} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalEgresos.añoPasado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {fmt(data.totalEgresos.variacionAñoPasado)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <GrowthBadge value={data.totalEgresos.crecimientoAñoPasado} invertColors={true} />
                    </td>
                  </tr>

                  {/* ================= 6. UTILIDAD NETA ================= */}
                  <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-950 shadow-md">
                    <td className="py-3 px-4 font-black text-base border-r border-slate-700 uppercase tracking-wider">
                      = {data.utilidadNeta.concepto}
                      <span className="block text-[11px] font-bold text-slate-300">
                        Margen Neto: {data.margenNetoPct.actual}%
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-black text-base ${
                      data.utilidadNeta.actual >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {fmt(data.utilidadNeta.actual)}
                    </td>
                    <td className="py-3 px-2 text-right border-r border-slate-700 font-black text-slate-300">
                      {data.margenNetoPct.actual}%
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadNeta.anterior)}
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadNeta.variacionAnterior)}
                    </td>
                    <td className="py-3 px-2 text-center border-r border-slate-700">
                      <GrowthBadge value={data.utilidadNeta.crecimientoAnterior} />
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadNeta.añoPasado)}
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {fmt(data.utilidadNeta.variacionAñoPasado)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <GrowthBadge value={data.utilidadNeta.crecimientoAñoPasado} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
