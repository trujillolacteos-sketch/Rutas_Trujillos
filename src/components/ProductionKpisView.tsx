import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import {
  Activity,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  PieChart as PieChartIcon,
  BarChart3,
  Scale,
  Percent,
  DollarSign,
  Droplets,
  PackageCheck,
  AlertTriangle,
  FileSpreadsheet,
  Factory,
  ChevronDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { AppState } from '../types';

interface KpiSummary {
  totalKgProduced: number;
  totalMilkLiters: number;
  globalYieldLtPerKg: number;
  totalBatches: number;
  totalKgPackaged: number;
  totalPiecesPackaged: number;
  globalPackagingYield: number;
  totalMermaKg: number;
  globalWastePercentage: number;
  totalProductionCost: number;
  avgCostPerKg: number;
  totalSueroLiters: number;
  totalCremaKg: number;
  linesTotalMilkEntera: number;
  linesTotalMilkDescremada: number;
  linesTotalKgObtained: number;
}

interface CategoryKpi {
  categoria: string;
  lotes: number;
  kgProduced: number;
  milkLiters: number;
  totalCost: number;
  kgPackaged: number;
  mermaKg: number;
  yieldLtPerKg: number;
  packagingYield: number;
  avgCostPerKg: number;
}

interface LineKpi {
  lineId: string;
  lineNombre: string;
  reportesCount: number;
  lecheEntera: number;
  lecheDescremada: number;
  kgObtenidos: number;
  suero: number;
  crema: number;
  merma: number;
  sobrante: number;
}

interface DailyTrendItem {
  fecha: string;
  kgProduced: number;
  milkLiters: number;
  yieldLtPerKg: number;
  kgPackaged: number;
  costo: number;
}

interface RecentBatchItem {
  lote: string;
  categoria: string;
  fechaProduccion: string;
  kgTotal: number;
  milkLiters: number;
  yieldLtPerKg: number;
  costoPorKg: number;
  costoTotal: number;
  kgPackaged: number | null;
  packYield: number | null;
  status: string;
}

interface KpisResponse {
  summary: KpiSummary;
  byCategory: CategoryKpi[];
  byLine: LineKpi[];
  dailyTrend: DailyTrendItem[];
  recentBatches: RecentBatchItem[];
}

const COLORS = ['#4f46e5', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#e11d48'];

export default function ProductionKpisView({
  role,
  user,
  state
}: {
  role?: string;
  user?: { username: string; role: string };
  state: AppState;
}) {
  const [data, setData] = useState<KpisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodPreset, setPeriodPreset] = useState<'all' | 'today' | 'week' | 'month' | 'last30' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'graficos' | 'categorias' | 'lineas' | 'lotes'>('graficos');

  // Compute dates based on preset
  const handlePresetChange = (preset: 'all' | 'today' | 'week' | 'month' | 'last30' | 'custom') => {
    setPeriodPreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(startOfMonth);
      setEndDate(todayStr);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    }
  };

  const fetchKpis = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedCategory && selectedCategory !== 'all') params.append('categoria', selectedCategory);

      const res = await apiFetch(`/api/production/kpis?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching production KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [startDate, endDate, selectedCategory]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data?.byCategory.length) return;
    const headers = [
      'Categoría',
      'Lotes Elaborados',
      'Leche Procesada (Lts)',
      'Queso Producido (Kg)',
      'Rendimiento (Lt/Kg)',
      'Queso Empacado (Kg)',
      '% Aprovechamiento Empaque',
      'Merma Registrada (Kg)',
      'Costo Invertido ($)',
      'Costo Promedio ($/Kg)'
    ];

    const rows = data.byCategory.map(c => [
      `"${c.categoria}"`,
      c.lotes,
      c.milkLiters,
      c.kgProduced,
      c.yieldLtPerKg,
      c.kgPackaged,
      `${c.packagingYield}%`,
      c.mermaKg,
      c.totalCost,
      c.avgCostPerKg
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kpis_produccion_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              KPIs e Indicadores de Producción
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              Rendimiento de leche, conversión Lt/Kg, aprovechamiento de empacado, mermas y costos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchKpis}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Recargar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!data?.byCategory.length}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Reporte</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => handlePresetChange('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodPreset === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Histórico Completo
          </button>
          <button
            onClick={() => handlePresetChange('today')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodPreset === 'today' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => handlePresetChange('week')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodPreset === 'week' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Últimos 7 Días
          </button>
          <button
            onClick={() => handlePresetChange('month')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodPreset === 'month' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => handlePresetChange('last30')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodPreset === 'last30' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Últimos 30 Días
          </button>
        </div>

        {/* Custom date range & Category */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="bg-transparent border-none text-slate-700 focus:outline-none text-xs font-semibold"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="bg-transparent border-none text-slate-700 focus:outline-none text-xs font-semibold"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas las Categorías</option>
            {data?.byCategory.map(c => (
              <option key={c.categoria} value={c.categoria}>
                {c.categoria}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI HERO CARDS */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
          {/* 1. Rendimiento Leche/Queso */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-4.5 rounded-2xl shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between opacity-85">
              <span className="text-xs font-bold uppercase tracking-wider">Rendimiento Leche</span>
              <Droplets className="w-4 h-4 text-indigo-200" />
            </div>
            <div className="my-2">
              <p className="text-3xl font-black tracking-tight">
                {summary.globalYieldLtPerKg} <span className="text-base font-semibold text-indigo-200">Lt/Kg</span>
              </p>
              <span className="text-[11px] text-indigo-100 font-medium block mt-0.5">
                {summary.totalMilkLiters.toLocaleString('es-MX')} Lts procesados
              </span>
            </div>
            <div className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">
              {summary.globalYieldLtPerKg <= 10 ? '✓ Conversión Óptima' : 'Revisar Conversión'}
            </div>
          </div>

          {/* 2. Producción Total */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Queso Elaborado</span>
              <Scale className="w-4 h-4 text-blue-500" />
            </div>
            <div className="my-2">
              <p className="text-2xl md:text-3xl font-black text-slate-800">
                {summary.totalKgProduced.toLocaleString('es-MX')} <span className="text-sm font-bold text-slate-500">Kg</span>
              </p>
              <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                En {summary.totalBatches} {summary.totalBatches === 1 ? 'lote elaborado' : 'lotes elaborados'}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
              Volumen de Planta
            </span>
          </div>

          {/* 3. Aprovechamiento de Empaque */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Aprovechamiento</span>
              <PackageCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <p className="text-2xl md:text-3xl font-black text-emerald-600">
                {summary.globalPackagingYield}%
              </p>
              <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                {summary.totalKgPackaged.toLocaleString('es-MX')} Kg en {summary.totalPiecesPackaged} pz
              </span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
              Rendimiento Empaque
            </span>
          </div>

          {/* 4. Merma Registrada */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Merma Registrada</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="my-2">
              <p className="text-2xl md:text-3xl font-black text-amber-600">
                {summary.totalMermaKg.toLocaleString('es-MX')} <span className="text-sm font-bold text-slate-500">Kg</span>
              </p>
              <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                {summary.globalWastePercentage}% sobre volumen
              </span>
            </div>
            <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
              Desperdicio / Merma
            </span>
          </div>

          {/* 5. Costo Promedio / Kg */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Costo Promedio</span>
              <DollarSign className="w-4 h-4 text-slate-500" />
            </div>
            <div className="my-2">
              <p className="text-2xl md:text-3xl font-black text-slate-800">
                ${summary.avgCostPerKg.toFixed(2)} <span className="text-xs font-bold text-slate-400">/ Kg</span>
              </p>
              <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                Total: ${summary.totalProductionCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full w-fit">
              Costo de Fabricación
            </span>
          </div>

          {/* 6. Subproductos Recuperados */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Subproductos</span>
              <Factory className="w-4 h-4 text-purple-500" />
            </div>
            <div className="my-2">
              <p className="text-base font-black text-slate-800">
                Crema: <span className="text-purple-600">{summary.totalCremaKg} kg</span>
              </p>
              <p className="text-base font-black text-slate-800 mt-1">
                Suero: <span className="text-blue-600">{summary.totalSueroLiters} L</span>
              </p>
            </div>
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full w-fit">
              Recuperación Extra
            </span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('graficos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'graficos'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Gráficos de Rendimiento</span>
        </button>

        <button
          onClick={() => setActiveTab('categorias')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'categorias'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Por Categoría de Queso ({data?.byCategory.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('lineas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'lineas'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>Líneas de Producción ({data?.byLine.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('lotes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'lotes'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Lotes Recientes ({data?.recentBatches.length || 0})</span>
        </button>
      </div>

      {/* VIEW 1: GRÁFICOS */}
      {activeTab === 'graficos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Producción vs Empaque en el tiempo */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Producción vs Empaque (Kg)</h3>
                <span className="text-[11px] text-slate-400">Kilos elaborados vs kilos empacados por día</span>
              </div>
              <BarChart3 className="w-4 h-4 text-indigo-500" />
            </div>

            <div className="h-64 w-full">
              {data?.dailyTrend && data.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="kgProduced" name="Kg Producidos" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="kgPackaged" name="Kg Empacados" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros suficientes para graficar
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Rendimiento Leche/Queso por Categoría */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Rendimiento (Lt Leche / Kg Queso)</h3>
                <span className="text-[11px] text-slate-400">Eficiencia de conversión por tipo de queso</span>
              </div>
              <Droplets className="w-4 h-4 text-blue-500" />
            </div>

            <div className="h-64 w-full">
              {data?.byCategory && data.byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="categoria" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={v => v.replace('All / Quesos / ', '')} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                      formatter={(val: any) => [`${val} Lt/Kg`, 'Conversión']}
                    />
                    <Bar dataKey="yieldLtPerKg" name="Lt Leche por Kg" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros suficientes para graficar
                </div>
              )}
            </div>
          </div>

          {/* Chart 3: Distribución del Volumen Producido */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Distribución de Producción por Categoría</h3>
                <span className="text-[11px] text-slate-400">Participación en volumen (Kg)</span>
              </div>
              <PieChartIcon className="w-4 h-4 text-purple-500" />
            </div>

            <div className="h-64 w-full flex items-center justify-center">
              {data?.byCategory && data.byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byCategory}
                      dataKey="kgProduced"
                      nameKey="categoria"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={4}
                      label={({ name, percent }) => `${(name || '').replace('All / Quesos / ', '')} (${((percent || 0) * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {data.byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                      formatter={(val: any) => [`${val} Kg`, 'Volumen']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros de producción
                </div>
              )}
            </div>
          </div>

          {/* Chart 4: Aprovechamiento vs Merma (%) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Aprovechamiento vs Merma (%)</h3>
                <span className="text-[11px] text-slate-400">% de aprovechamiento de empacado por categoría</span>
              </div>
              <Percent className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="h-64 w-full">
              {data?.byCategory && data.byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="categoria" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={v => v.replace('All / Quesos / ', '')} />
                    <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                      formatter={(val: any) => [`${val}%`, 'Aprovechamiento']}
                    />
                    <Bar dataKey="packagingYield" name="% Aprovechamiento" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros suficientes para graficar
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: TABLA POR CATEGORÍA */}
      {activeTab === 'categorias' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Desglose de KPIs por Categoría</h3>
              <span className="text-xs text-slate-400">Métricas consolidadas de producción y empacado</span>
            </div>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all"
            >
              Exportar Categorías
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-3 text-center">Lotes</th>
                  <th className="py-3 px-3 text-right">Leche Usada (L)</th>
                  <th className="py-3 px-3 text-right">Producido (Kg)</th>
                  <th className="py-3 px-3 text-right text-indigo-600">Rendimiento (Lt/Kg)</th>
                  <th className="py-3 px-3 text-right text-emerald-600">Empacado (Kg)</th>
                  <th className="py-3 px-3 text-center">% Aprovechamiento</th>
                  <th className="py-3 px-3 text-right text-amber-600">Merma (Kg)</th>
                  <th className="py-3 px-4 text-right">Costo / Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.byCategory.map(c => (
                  <tr key={c.categoria} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800">{c.categoria}</td>
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-600">{c.lotes}</td>
                    <td className="py-3.5 px-3 text-right font-medium text-slate-700">{c.milkLiters.toLocaleString('es-MX')}</td>
                    <td className="py-3.5 px-3 text-right font-black text-slate-800">{c.kgProduced.toLocaleString('es-MX')}</td>
                    <td className="py-3.5 px-3 text-right font-black text-indigo-600">{c.yieldLtPerKg} Lt/Kg</td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-600">{c.kgPackaged.toLocaleString('es-MX')}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        {c.packagingYield}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-amber-600">{c.mermaKg}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-800">${c.avgCostPerKg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TABLA POR LÍNEA DE PRODUCCIÓN */}
      {activeTab === 'lineas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Desglose por Línea de Planta</h3>
            <span className="text-xs text-slate-400">Datos registrados en reportes diarios de líneas de producción</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Línea de Proceso</th>
                  <th className="py-3 px-3 text-center">Reportes</th>
                  <th className="py-3 px-3 text-right">Leche Entera (L)</th>
                  <th className="py-3 px-3 text-right">Leche Descrem. (L)</th>
                  <th className="py-3 px-3 text-right">Kg Obtenidos</th>
                  <th className="py-3 px-3 text-right text-blue-600">Suero (L)</th>
                  <th className="py-3 px-3 text-right text-purple-600">Crema (Kg)</th>
                  <th className="py-3 px-4 text-right text-amber-600">Merma (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.byLine.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Sin reportes diarios en las líneas de producción para este periodo.
                    </td>
                  </tr>
                ) : (
                  data?.byLine.map(l => (
                    <tr key={l.lineId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{l.lineNombre}</td>
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-600">{l.reportesCount}</td>
                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">{l.lecheEntera.toLocaleString('es-MX')}</td>
                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">{l.lecheDescremada.toLocaleString('es-MX')}</td>
                      <td className="py-3.5 px-3 text-right font-black text-slate-800">{l.kgObtenidos.toLocaleString('es-MX')}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-blue-600">{l.suero.toLocaleString('es-MX')}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-purple-600">{l.crema.toLocaleString('es-MX')}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-amber-600">{l.merma.toLocaleString('es-MX')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: TABLA DE LOTES RECIENTES */}
      {activeTab === 'lotes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Trazabilidad de Lotes de Producción</h3>
            <span className="text-xs text-slate-400">Rendimiento y costo individual por lote elaborado</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Lote</th>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-3 text-right">Kg Lote</th>
                  <th className="py-3 px-3 text-right">Leche Usada (L)</th>
                  <th className="py-3 px-3 text-right text-indigo-600">Rendimiento (Lt/Kg)</th>
                  <th className="py-3 px-3 text-right text-emerald-600">Kg Empacados</th>
                  <th className="py-3 px-3 text-center">% Aprovechamiento</th>
                  <th className="py-3 px-4 text-right">Costo / Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentBatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Sin lotes registrados para el periodo seleccionado.
                    </td>
                  </tr>
                ) : (
                  data?.recentBatches.map(b => (
                    <tr key={b.lote} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{b.lote}</td>
                      <td className="py-3.5 px-3 text-xs text-slate-500">{b.fechaProduccion}</td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">{b.categoria}</td>
                      <td className="py-3.5 px-3 text-right font-black text-slate-800">{b.kgTotal}</td>
                      <td className="py-3.5 px-3 text-right font-medium text-slate-600">{b.milkLiters}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-indigo-600">{b.yieldLtPerKg} Lt/Kg</td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                        {b.kgPackaged != null ? `${b.kgPackaged} kg` : '-'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {b.packYield != null ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                            {b.packYield}%
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">${b.costoPorKg.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
