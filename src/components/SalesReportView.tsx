import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { AppState } from '../types';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingBag,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Award,
  Users,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus
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
  Tooltip,
  Legend,
} from 'recharts';

interface TopItem {
  id: number;
  name: string;
  pieces: number;
  amount: number;
  avgPrice: number;
  orderCount?: number;
}

interface SalesReportData {
  periodType: 'weekly' | 'monthly' | 'yearly';
  periodLabel: string;
  currentRange: { start: string; end: string };
  previousRange: { start: string; end: string };
  lastYearRange: { start: string; end: string };
  kpis: {
    current: {
      totalSales: number;
      totalPieces: number;
      totalOrders: number;
      ticketAvgAmount: number;
      ticketAvgPieces: number;
    };
    previousPeriod: {
      totalSales: number;
      totalPieces: number;
      totalOrders: number;
      ticketAvgAmount: number;
      ticketAvgPieces: number;
    };
    samePeriodLastYear: {
      totalSales: number;
      totalPieces: number;
      totalOrders: number;
      ticketAvgAmount: number;
      ticketAvgPieces: number;
    };
    growthVsPrevious: {
      salesPct: number;
      salesDiff: number;
      piecesPct: number;
      piecesDiff: number;
      ordersPct: number;
      ordersDiff: number;
      ticketAmountPct: number;
      ticketPiecesPct: number;
    };
    growthVsLastYear: {
      salesPct: number;
      salesDiff: number;
      piecesPct: number;
      piecesDiff: number;
      ordersPct: number;
      ordersDiff: number;
      ticketAmountPct: number;
      ticketPiecesPct: number;
    };
  };
  dualAxisChart: {
    label: string;
    dateKey: string;
    totalSales: number;
    totalPieces: number;
    orders: number;
    ticketAvgAmount: number;
    ticketAvgPieces: number;
  }[];
  comparisonSalesChart: {
    label: string;
    actual: number;
    anterior: number;
    anoPasado: number;
  }[];
  topProducts: {
    byAmount: TopItem[];
    byPieces: TopItem[];
  };
  topClients: {
    byAmount: TopItem[];
    byPieces: TopItem[];
  };
}

function pad(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function SalesReportView({ state }: { state: AppState }) {
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [targetDate, setTargetDate] = useState<string>(() => formatDateStr(new Date()));
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Top rankings selectors
  const [topMetric, setTopMetric] = useState<'amount' | 'pieces'>('amount');
  const [topCategory, setTopCategory] = useState<'products' | 'clients'>('products');

  const fetchReport = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const params = new URLSearchParams({
        type: periodType,
        date: targetDate,
      });
      if (selectedRoute !== 'all') {
        params.append('routeId', selectedRoute);
      }

      const res = await apiFetch(`/api/reports/sales?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        setErrorMsg(`Error ${res.status}: no se pudo cargar el reporte`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [periodType, targetDate, selectedRoute]);

  // Date navigation handlers
  const handlePrevPeriod = () => {
    const d = new Date(targetDate + (targetDate.includes('T') ? '' : 'T12:00:00'));
    if (periodType === 'weekly') {
      d.setDate(d.getDate() - 7);
    } else if (periodType === 'monthly') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setFullYear(d.getFullYear() - 1);
    }
    setTargetDate(formatDateStr(d));
  };

  const handleNextPeriod = () => {
    const d = new Date(targetDate + (targetDate.includes('T') ? '' : 'T12:00:00'));
    if (periodType === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (periodType === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setFullYear(d.getFullYear() + 1);
    }
    setTargetDate(formatDateStr(d));
  };

  const handleResetToToday = () => {
    setTargetDate(formatDateStr(new Date()));
  };

  // Badge rendering helper for comparative % and absolute values
  const renderComparisonBadge = (pct: number, diff: number, prefix = '$', isCurrency = true) => {
    const isPositive = pct > 0;
    const isZero = pct === 0;

    const colorClasses = isPositive
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : isZero
      ? 'bg-slate-50 text-slate-600 border-slate-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';

    const Icon = isPositive ? ArrowUpRight : isZero ? Minus : ArrowDownRight;
    const diffFormatted = `${isPositive ? '+' : ''}${isCurrency ? prefix : ''}${diff.toLocaleString(undefined, { maximumFractionDigits: 1 })}${!isCurrency ? ' ' + prefix : ''}`;
    const pctFormatted = `${isPositive ? '+' : ''}${pct}%`;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${colorClasses}`}>
        <Icon className="w-3 h-3 shrink-0" />
        <span>{pctFormatted}</span>
        <span className="text-[10px] font-normal opacity-75">
          {`(${diffFormatted})`}
        </span>
      </span>
    );
  };

  // Active top items
  const activeTopItems = useMemo(() => {
    if (!report) return [];
    if (topCategory === 'products') {
      return topMetric === 'amount' ? report.topProducts.byAmount : report.topProducts.byPieces;
    } else {
      return topMetric === 'amount' ? report.topClients.byAmount : report.topClients.byPieces;
    }
  }, [report, topCategory, topMetric]);

  const maxTopValue = useMemo(() => {
    if (!activeTopItems || activeTopItems.length === 0) return 1;
    return topMetric === 'amount'
      ? Math.max(...activeTopItems.map(i => i.amount))
      : Math.max(...activeTopItems.map(i => i.pieces));
  }, [activeTopItems, topMetric]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Reportes de Ventas & Analítica</h1>
              <p className="text-xs text-slate-500">
                Comparativas vs periodo anterior, año pasado y rendimiento por ticket
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Type Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 notranslate" translate="no">
            <button
              onClick={() => setPeriodType('weekly')}
              translate="no"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all notranslate ${
                periodType === 'weekly'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setPeriodType('monthly')}
              translate="no"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all notranslate ${
                periodType === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setPeriodType('yearly')}
              translate="no"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all notranslate ${
                periodType === 'yearly'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anual
            </button>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <button
              onClick={handlePrevPeriod}
              title="Periodo Anterior"
              className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-800 px-2 min-w-[140px] text-center">
              {report?.periodLabel || 'Cargando...'}
            </span>
            <button
              onClick={handleNextPeriod}
              title="Periodo Siguiente"
              className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetToToday}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-slate-200 transition-colors"
          >
            Hoy
          </button>

          {/* Route Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRoute}
              onChange={e => setSelectedRoute(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Todas las Rutas</option>
              {(state.routes || []).map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-slate-200 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Venta Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Venta Total</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {`$${report?.kpis.current.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Anterior:</span>
              {report && renderComparisonBadge(report.kpis.growthVsPrevious.salesPct, report.kpis.growthVsPrevious.salesDiff, '$', true)}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Año Pasado:</span>
              {report && renderComparisonBadge(report.kpis.growthVsLastYear.salesPct, report.kpis.growthVsLastYear.salesDiff, '$', true)}
            </div>
          </div>
        </div>

        {/* Card 2: Total Piezas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Piezas Vendidas</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {`${report?.kpis.current.totalPieces.toLocaleString() || '0'} `}
              <span className="text-xs font-medium text-slate-400">pzas</span>
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Anterior:</span>
              {report && renderComparisonBadge(report.kpis.growthVsPrevious.piecesPct, report.kpis.growthVsPrevious.piecesDiff, 'pzas', false)}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Año Pasado:</span>
              {report && renderComparisonBadge(report.kpis.growthVsLastYear.piecesPct, report.kpis.growthVsLastYear.piecesDiff, 'pzas', false)}
            </div>
          </div>
        </div>

        {/* Card 3: Total Tickets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tickets (Órdenes)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {`${report?.kpis.current.totalOrders.toLocaleString() || '0'} `}
              <span className="text-xs font-medium text-slate-400">pedidos</span>
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Anterior:</span>
              {report && renderComparisonBadge(report.kpis.growthVsPrevious.ordersPct, report.kpis.growthVsPrevious.ordersDiff, 'pedidos', false)}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Año Pasado:</span>
              {report && renderComparisonBadge(report.kpis.growthVsLastYear.ordersPct, report.kpis.growthVsLastYear.ordersDiff, 'pedidos', false)}
            </div>
          </div>
        </div>

        {/* Card 4: Ticket Promedio ($) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Prom. ($)</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {`$${report?.kpis.current.ticketAvgAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Anterior:</span>
              {report && renderComparisonBadge(report.kpis.growthVsPrevious.ticketAmountPct, (report.kpis.current.ticketAvgAmount - report.kpis.previousPeriod.ticketAvgAmount), '$', true)}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Año Pasado:</span>
              {report && renderComparisonBadge(report.kpis.growthVsLastYear.ticketAmountPct, (report.kpis.current.ticketAvgAmount - report.kpis.samePeriodLastYear.ticketAvgAmount), '$', true)}
            </div>
          </div>
        </div>

        {/* Card 5: Ticket Promedio (Piezas) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Prom. (Pzas)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {`${report?.kpis.current.ticketAvgPieces || 0} `}
              <span className="text-xs font-medium text-slate-400">pzas/pedido</span>
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Anterior:</span>
              {report && renderComparisonBadge(report.kpis.growthVsPrevious.ticketPiecesPct, (report.kpis.current.ticketAvgPieces - report.kpis.previousPeriod.ticketAvgPieces), 'pzas', false)}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">vs Año Pasado:</span>
              {report && renderComparisonBadge(report.kpis.growthVsLastYear.ticketPiecesPct, (report.kpis.current.ticketAvgPieces - report.kpis.samePeriodLastYear.ticketAvgPieces), 'pzas', false)}
            </div>
          </div>
        </div>
      </div>

      {/* Gráfica Principal: Ticket Promedio con Doble Eje Y */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              <h3 className="font-bold text-slate-900 text-lg">
                Ticket Promedio en Piezas y Monto (Doble Eje Y)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Eje Verde (Izquierdo): Monto Promedio ($/ticket) • Eje Morado (Derecho): Piezas Promedio (pzas/ticket)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block"></span>
              <span>{`Ticket ($): $${report?.kpis.current.ticketAvgAmount.toFixed(2) || '0.00'}`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              <span className="w-3 h-1.5 bg-indigo-600 rounded-full inline-block"></span>
              <span>{`Ticket (Pzas): ${report?.kpis.current.ticketAvgPieces || 0} pzas`}</span>
            </div>
          </div>
        </div>

        <div className="h-80 w-full">
          {report && report.dualAxisChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.dualAxisChart} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} />
                {/* Eje Izquierdo: Monto ($) */}
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#059669"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `$${val.toLocaleString()}`}
                />
                {/* Eje Derecho: Piezas */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#4f46e5"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `${val} pz`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 text-xs space-y-2">
                          <p className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 text-sm">{label}</p>
                          <div className="flex items-center justify-between gap-6 text-emerald-700 font-semibold">
                            <span>Ticket Promedio ($):</span>
                            <span>${data.ticketAvgAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6 text-indigo-700 font-semibold">
                            <span>Ticket Promedio (Piezas):</span>
                            <span>{data.ticketAvgPieces} pzas</span>
                          </div>
                          <div className="pt-2 border-t border-slate-100 text-slate-500 space-y-1">
                            <div className="flex justify-between gap-4">
                              <span>Venta Total:</span>
                              <span className="font-semibold text-slate-800">${data.totalSales.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Total Piezas:</span>
                              <span className="font-semibold text-slate-800">{data.totalPieces.toLocaleString()} pzas</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Total Pedidos:</span>
                              <span className="font-semibold text-slate-800">{data.orders} pedidos</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  yAxisId="left"
                  dataKey="ticketAvgAmount"
                  name="Ticket Promedio ($)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ticketAvgPieces"
                  name="Ticket Promedio (Piezas)"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Sin datos para este periodo
            </div>
          )}
        </div>
      </div>

      {/* Gráfica de Comparativa de Ventas vs Periodo Anterior y Año Pasado */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              Comparativa de Ventas: Actual vs Anterior vs Año Pasado
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Desglose comparativo por subperiodos de venta
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-blue-700">
              <span className="w-3 h-3 bg-blue-600 rounded-sm"></span>
              <span>{`Periodo Actual ($${report?.kpis.current.totalSales.toLocaleString() || 0})`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-3 bg-slate-400 rounded-sm"></span>
              <span>{`Periodo Anterior ($${report?.kpis.previousPeriod.totalSales.toLocaleString() || 0})`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-600">
              <span className="w-3 h-3 bg-amber-400 rounded-sm"></span>
              <span>{`Año Pasado ($${report?.kpis.samePeriodLastYear.totalSales.toLocaleString() || 0})`}</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {report && report.comparisonSalesChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.comparisonSalesChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    `$${val.toLocaleString()}`,
                    name === 'actual' ? 'Periodo Actual' : name === 'anterior' ? 'Periodo Anterior' : 'Mismo Periodo Año Pasado'
                  ]}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="actual" name="actual" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="anterior" name="anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="anoPasado" name="anoPasado" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Sin datos para este periodo
            </div>
          )}
        </div>
      </div>

      {/* Sección Top de Ventas en Piezas y Monto */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Rankings Top de Venta
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Productos y clientes líderes durante el periodo seleccionado
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Toggle: Productos vs Clientes */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setTopCategory('products')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  topCategory === 'products'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Productos
              </button>
              <button
                onClick={() => setTopCategory('clients')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  topCategory === 'clients'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clientes
              </button>
            </div>

            {/* Metric Toggle: Piezas vs Monto */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setTopMetric('amount')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  topMetric === 'amount'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top en Monto ($)
              </button>
              <button
                onClick={() => setTopMetric('pieces')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  topMetric === 'pieces'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top en Piezas
              </button>
            </div>
          </div>
        </div>

        {/* Top List */}
        <div className="space-y-3">
          {activeTopItems.length > 0 ? (
            activeTopItems.map((item, idx) => {
              const mainVal = topMetric === 'amount' ? item.amount : item.pieces;
              const barPercent = Math.min(100, Math.round((mainVal / maxTopValue) * 100));

              return (
                <div
                  key={item.id || idx}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Position Badge */}
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-800 border border-slate-300'
                          : idx === 2
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-white text-slate-500 border border-slate-200'
                      }`}
                    >
                      {`#${idx + 1}`}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">{item.name}</h4>
                        {item.avgPrice > 0 && (
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            {`Precio prom: $${item.avgPrice.toFixed(2)}`}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            topMetric === 'amount' ? 'bg-emerald-500' : 'bg-purple-600'
                          }`}
                          style={{ width: `${barPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Right numbers */}
                  <div className="flex items-center gap-6 self-end sm:self-center shrink-0 pl-10 sm:pl-0">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Piezas</span>
                      <span className="text-sm font-bold text-slate-800">
                        {`${item.pieces.toLocaleString()} pzas`}
                      </span>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <span className="text-xs text-slate-400 block font-medium">Venta Total</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {`$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              No hay datos disponibles para mostrar en este periodo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
