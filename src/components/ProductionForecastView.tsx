import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import {
  TrendingUp,
  Package,
  Boxes,
  ShoppingCart,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Milk,
  DollarSign,
  Share2,
  Printer,
  FileSpreadsheet,
  Check,
  Sliders,
  Copy,
  Info,
  ArrowRight,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { AppState } from '../types';

interface ProductDemandItem {
  productId: number;
  productName: string;
  category: string;
  cleanCategory: string;
  pesoUnitarioKg: number;
  piezasSemanalesBase: number;
  piezasSemanalesProyectadas: number;
  kgSemanalesProyectados: number;
  montoVentaBase: number;
  empaques: string[];
  etiqueta: string;
  adicionales: string[];
  porcentajeCategoria: number;
}

interface CategoryProductionForecast {
  categoria: string;
  cleanCategoria: string;
  kgProyectados: number;
  piezasProyectadas: number;
  porcentajeDelTotal: number;
  litrosLecheRequeridos: number;
  rendimientoLitrosPorKg: number;
  productos: ProductDemandItem[];
}

interface SupplyRequirementItem {
  nombre: string;
  tipo: 'ingrediente' | 'empaque' | 'etiqueta';
  tipoLabel: string;
  unidadBase: string;
  proveedor: string;
  costoUnitario: number;
  stockActual: number;
  consumoSemanal: number;
  consumoDiario: number;
  stockSeguridad: number;
  abastoMinimoCiclo: number;
  diasCobertura: number;
  estatusAbasto: 'critico' | 'riesgo' | 'optimo';
  estatusLabel: string;
  compraSugerida: number;
  presentacionCompra?: string;
  costoEstimadoCompra: number;
  usadoEnCategorias: string[];
}

interface ProviderPurchaseSummary {
  proveedor: string;
  totalItems: number;
  itemsRequeridos: number;
  itemsCriticos: number;
  itemsRiesgo: number;
  costoTotalOrden: number;
  items: SupplyRequirementItem[];
}

interface ForecastResponse {
  periodType: 'last_week' | 'last_2_weeks' | 'last_4_weeks';
  periodLabel: string;
  leadTimeDays: number;
  safetyDays: number;
  growthFactor: number;
  fechaCalculo: string;
  kpis: {
    totalKgProduccion: number;
    totalPiezasProduccion: number;
    totalLitrosLeche: number;
    totalCategorias: number;
    totalProductosActivos: number;
    totalInsumosAlerta: number;
    costoTotalComprasSugeridas: number;
    coberturaPromedioDias: number;
  };
  productionByCategory: CategoryProductionForecast[];
  suppliesForecast: SupplyRequirementItem[];
  purchasesByProvider: ProviderPurchaseSummary[];
}

export default function ProductionForecastView({
  role,
  user,
  state
}: {
  role?: string;
  user?: { username: string; role: string };
  state: AppState;
}) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'production' | 'supplies' | 'purchases'>('production');

  // Filters and Control Parameters
  const [selectedPeriod, setSelectedPeriod] = useState<'last_week' | 'last_2_weeks' | 'last_4_weeks'>('last_4_weeks');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(2.5);
  const [growthFactor, setGrowthFactor] = useState<number>(1.0);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplyTypeFilter, setSupplyTypeFilter] = useState<'all' | 'ingrediente' | 'empaque' | 'etiqueta'>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critico' | 'riesgo' | 'optimo'>('all');

  // Manual Overrides for individual SKU pieces
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Action status
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [purchasingProvider, setPurchasingProvider] = useState<string | null>(null);
  const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);

  const formatMoney = (val: number) => {
    return '$' + Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (val: number, decimals = 1) => {
    return Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fetchForecast = async (force = false) => {
    try {
      setLoading(true);
      setErrorMsg('');

      const params = new URLSearchParams({
        period: selectedPeriod,
        leadTimeDays: String(leadTimeDays),
        safetyDays: String(leadTimeDays),
        growthFactor: String(growthFactor),
        force: force ? 'true' : 'false'
      });

      if (Object.keys(manualOverrides).length > 0) {
        params.append('overrides', JSON.stringify(manualOverrides));
      }

      const res = await apiFetch(`/api/production/forecast?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al obtener el pronóstico');
      }

      const result: ForecastResponse = await res.json();
      setData(result);

      // Auto-expand the top 3 categories by default
      if (result.productionByCategory && result.productionByCategory.length > 0) {
        const initialExpand: Record<string, boolean> = {};
        result.productionByCategory.slice(0, 3).forEach(c => {
          initialExpand[c.cleanCategoria] = true;
        });
        setExpandedCategories(prev => ({ ...initialExpand, ...prev }));
      }
    } catch (err: any) {
      console.error('[ProductionForecastView] Error:', err);
      setErrorMsg(err.message || 'Error cargando datos del pronóstico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [selectedPeriod, leadTimeDays, growthFactor]);

  // Handle in-line SKU projection adjustment
  const handleOverrideChange = (prodId: number, val: string) => {
    const num = parseInt(val, 10);
    setManualOverrides(prev => {
      const next = { ...prev };
      if (isNaN(num) || num < 0) {
        delete next[prodId];
      } else {
        next[prodId] = num;
      }
      return next;
    });
  };

  const handleApplyOverrides = () => {
    fetchForecast(false);
  };

  const handleResetOverrides = () => {
    setManualOverrides({});
    setGrowthFactor(1.0);
    fetchForecast(false);
  };

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Quick Purchase generation for a specific provider
  const handleQuickPurchaseForProvider = async (providerSummary: ProviderPurchaseSummary) => {
    const itemsToBuy = providerSummary.items.filter(i => i.compraSugerida > 0);
    if (itemsToBuy.length === 0) {
      alert('No hay insumos con compras sugeridas para este proveedor.');
      return;
    }

    const confirmMsg = `¿Deseas registrar la compra automática de ${itemsToBuy.length} insumos con el proveedor ${providerSummary.proveedor} por un total estimado de ${formatMoney(providerSummary.costoTotalOrden)}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setPurchasingProvider(providerSummary.proveedor);
      setPurchaseSuccessMessage(null);

      const res = await apiFetch('/api/production/forecast/quick-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor: providerSummary.proveedor,
          items: itemsToBuy.map(i => ({
            nombre: i.nombre,
            tipo: i.tipo,
            cantidad: i.compraSugerida,
            unidadBase: i.unidadBase,
            presentacion: i.presentacionCompra,
            costoUnitario: i.costoUnitario,
            costoTotal: i.costoEstimadoCompra
          })),
          notas: `Pedido semanal de abasto garantizado (Lead Time: ${leadTimeDays} días)`
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al registrar compras');
      }

      setPurchaseSuccessMessage(`¡Orden de compra generada exitosamente para ${providerSummary.proveedor}! Ya puedes verla en Compras e Insumos.`);
      fetchForecast(true);
    } catch (e: any) {
      alert('Error al registrar compra: ' + e.message);
    } finally {
      setPurchasingProvider(null);
    }
  };

  // Copy purchase order text for WhatsApp/Email
  const handleCopyProviderOrder = (prov: ProviderPurchaseSummary) => {
    const itemsToBuy = prov.items.filter(i => i.compraSugerida > 0);
    if (itemsToBuy.length === 0) {
      alert('No hay insumos con compra sugerida para este proveedor.');
      return;
    }

    const lines = [
      `🧀 *LÁCTEOS TRUJILLOS - PEDIDO SEMANAL DE INSUMOS* 🧀`,
      `📦 *Proveedor:* ${prov.proveedor}`,
      `📅 *Fecha de Solicitud:* ${new Date().toLocaleDateString('es-MX')}`,
      `⏱️ *Tiempo de Entrega Requerido:* ${leadTimeDays} días hábiles`,
      `------------------------------------------`,
      ...itemsToBuy.map(i => `• *${i.nombre}:* ${formatNumber(i.compraSugerida, 0)} ${i.unidadBase} (${i.presentacionCompra || 'Presentación Estándar'}) - Est: ${formatMoney(i.costoEstimadoCompra)}`),
      `------------------------------------------`,
      `💰 *Total Estimado Orden:* ${formatMoney(prov.costoTotalOrden)} MXN`,
      `_Favor de confirmar recepción y fecha estimada de entrega._`
    ];

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setCopySuccess(prov.proveedor);
    setTimeout(() => setCopySuccess(null), 3000);
  };

  // Filtered lists
  const filteredCategories = useMemo(() => {
    if (!data?.productionByCategory) return [];
    return data.productionByCategory.filter(cat => {
      if (categoryFilter !== 'all' && cat.cleanCategoria.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchCat = cat.cleanCategoria.toLowerCase().includes(s);
        const matchProd = cat.productos.some(p => p.productName.toLowerCase().includes(s));
        return matchCat || matchProd;
      }
      return true;
    });
  }, [data?.productionByCategory, categoryFilter, searchTerm]);

  const filteredSupplies = useMemo(() => {
    if (!data?.suppliesForecast) return [];
    return data.suppliesForecast.filter(item => {
      if (supplyTypeFilter !== 'all' && item.tipo !== supplyTypeFilter) return false;
      if (statusFilter !== 'all' && item.estatusAbasto !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return item.nombre.toLowerCase().includes(s) || item.proveedor.toLowerCase().includes(s);
      }
      return true;
    });
  }, [data?.suppliesForecast, supplyTypeFilter, statusFilter, searchTerm]);

  const filteredProviders = useMemo(() => {
    if (!data?.purchasesByProvider) return [];
    return data.purchasesByProvider.filter(prov => {
      if (providerFilter !== 'all' && prov.proveedor !== providerFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchProv = prov.proveedor.toLowerCase().includes(s);
        const matchItem = prov.items.some(i => i.nombre.toLowerCase().includes(s));
        return matchProv || matchItem;
      }
      return true;
    });
  }, [data?.purchasesByProvider, providerFilter, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 font-sans">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Modelo de Planificación de la Demanda & Abasto</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Pronóstico de Producción, Insumos y Compras</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Cálculo semanal basado en ritmo de ventas en Odoo y peso por producto. Garantiza abasto ininterrumpido considerando <span className="font-bold text-slate-700">tiempo de entrega de proveedores de 2 a 3 días</span> y pedidos semanales.
            </p>
          </div>

          {/* PARAMETROS Y RECALCULAR */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Periodo de Ventas */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">Base:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="last_4_weeks">Últimas 4 Semanas (Media)</option>
                <option value="last_2_weeks">Últimas 2 Semanas</option>
                <option value="last_week">Última Semana (7 Días)</option>
              </select>
            </div>

            {/* Tiempo de Entrega Proveedor (Lead Time) */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">Lead Time:</span>
              <select
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(parseFloat(e.target.value))}
                className="bg-transparent text-xs font-bold text-indigo-900 outline-none cursor-pointer font-mono"
              >
                <option value="2.0">2.0 días</option>
                <option value="2.5">2.5 días (Media)</option>
                <option value="3.0">3.0 días</option>
                <option value="4.0">4.0 días</option>
              </select>
            </div>

            {/* Multiplicador de Demanda */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">Demanda:</span>
              <select
                value={growthFactor}
                onChange={(e) => setGrowthFactor(parseFloat(e.target.value))}
                className="bg-transparent text-xs font-bold text-emerald-900 outline-none cursor-pointer font-mono"
              >
                <option value="0.9">90% (-10%)</option>
                <option value="1.0">100% (Normal)</option>
                <option value="1.1">110% (+10% Alta)</option>
                <option value="1.2">120% (+20% Pico)</option>
                <option value="1.3">130% (+30%)</option>
              </select>
            </div>

            {/* Botón Refrescar */}
            <button
              onClick={() => fetchForecast(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Recalcular desde Odoo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Calculando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>

        {/* NOTIFICACION DE ORDEN REGISTRADA */}
        {purchaseSuccessMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{purchaseSuccessMessage}</span>
            </div>
            <button onClick={() => setPurchaseSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* OVERRIDES APPLIED BANNER */}
        {Object.keys(manualOverrides).length > 0 && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
            <span>Se aplicaron {Object.keys(manualOverrides).length} ajustes manuales a productos específicos.</span>
            <div className="flex gap-2">
              <button onClick={handleApplyOverrides} className="px-2 py-0.5 bg-amber-600 text-white font-bold rounded text-[11px]">
                Recalcular
              </button>
              <button onClick={handleResetOverrides} className="px-2 py-0.5 bg-white border border-amber-300 font-bold rounded text-[11px]">
                Restablecer a Odoo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI CARDS RESUMEN EJECUTIVO */}
      {data?.kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {/* Leche Total */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Leche Requerida</span>
              <Milk className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900 font-mono">
              {formatNumber(data.kpis.totalLitrosLeche, 0)} <span className="text-xs font-normal text-slate-500">L</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Rendimiento promedio general
            </div>
          </div>

          {/* Producción Total Kg */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Producción Semanal</span>
              <Package className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900 font-mono">
              {formatNumber(data.kpis.totalKgProduccion, 1)} <span className="text-xs font-normal text-slate-500">kg</span>
            </div>
            <div className="text-[10px] text-indigo-600 font-bold mt-1">
              {data.kpis.totalCategorias} categorías lácteas
            </div>
          </div>

          {/* Piezas Totales */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Piezas a Empacar</span>
              <Boxes className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900 font-mono">
              {formatNumber(data.kpis.totalPiezasProduccion, 0)} <span className="text-xs font-normal text-slate-500">pz</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {data.kpis.totalProductosActivos} SKUs en movimiento
            </div>
          </div>

          {/* Insumos en Alerta */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Insumos en Alerta</span>
              <AlertTriangle className={`w-4 h-4 ${data.kpis.totalInsumosAlerta > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            </div>
            <div className={`text-xl md:text-2xl font-black font-mono ${data.kpis.totalInsumosAlerta > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {data.kpis.totalInsumosAlerta} <span className="text-xs font-normal text-slate-500">ítems</span>
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-1">
              Lead time 2 a 3 días
            </div>
          </div>

          {/* Inversión en Compras */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Compras Sugeridas</span>
              <ShoppingCart className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl md:text-2xl font-black text-emerald-700 font-mono">
              {formatMoney(data.kpis.costoTotalComprasSugeridas)}
            </div>
            <div className="text-[10px] text-emerald-700 font-bold mt-1">
              Para garantizar abasto
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑAS DE VISTA */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('production')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'production'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>1. Pronóstico de Producción por Categoría ({data?.productionByCategory?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('supplies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'supplies'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>2. Insumos y Materiales Requeridos ({data?.suppliesForecast?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'purchases'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>3. Plan de Compras y Abasto ({data?.purchasesByProvider?.length || 0} Proveedores)</span>
          {data?.kpis?.totalInsumosAlerta ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
              {data.kpis.totalInsumosAlerta}
            </span>
          ) : null}
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeTab === 'production' 
                ? 'Buscar producto o categoría...' 
                : activeTab === 'supplies' 
                  ? 'Buscar insumo, bolsa, etiqueta...' 
                  : 'Buscar proveedor o insumo...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filtros específicos según pestaña */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {activeTab === 'production' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">Todas las Categorías</option>
              {data?.productionByCategory?.map(c => (
                <option key={c.cleanCategoria} value={c.cleanCategoria}>
                  {c.cleanCategoria} ({formatNumber(c.kgProyectados, 0)} kg)
                </option>
              ))}
            </select>
          )}

          {activeTab === 'supplies' && (
            <>
              <select
                value={supplyTypeFilter}
                onChange={(e) => setSupplyTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Todos los Insumos</option>
                <option value="ingrediente">Ingredientes y Materia Prima</option>
                <option value="empaque">Empaques y Contenedores</option>
                <option value="etiqueta">Etiquetas</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Todos los Estatus</option>
                <option value="critico">🔴 Desabasto Inminente (&lt; 3 d)</option>
                <option value="riesgo">🟡 Reorden Necesario</option>
                <option value="optimo">🟢 Abasto Garantizado</option>
              </select>
            </>
          )}

          {activeTab === 'purchases' && (
            <>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Todos los Proveedores</option>
                {data?.purchasesByProvider?.map(p => (
                  <option key={p.proveedor} value={p.proveedor}>
                    {p.proveedor} ({formatMoney(p.costoTotalOrden)})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Todos los Estatus</option>
                <option value="critico">🔴 Críticos (&lt; 3 días)</option>
                <option value="riesgo">🟡 En Riesgo (Reorden)</option>
                <option value="optimo">🟢 Óptimos</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* CONTENIDO 1: PRONÓSTICO DE PRODUCCIÓN POR CATEGORÍA */}
      {activeTab === 'production' && (
        <div className="space-y-4">
          {filteredCategories.map((cat) => {
            const isExpanded = expandedCategories[cat.cleanCategoria] !== false;

            return (
              <div key={cat.cleanCategoria} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Cabecera de Categoría */}
                <div 
                  onClick={() => toggleCategoryExpand(cat.cleanCategoria)}
                  className="p-4 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                      {cat.cleanCategoria.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 text-base">{cat.cleanCategoria}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                          {cat.porcentajeDelTotal}% de producción
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                        <span>{cat.productos.length} productos</span>
                        <span>•</span>
                        <span className="font-mono">{formatNumber(cat.piezasProyectadas, 0)} piezas</span>
                        <span>•</span>
                        <span className="font-mono text-sky-800 font-bold">Leche: {formatNumber(cat.litrosLecheRequeridos, 0)} L</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-bold uppercase">Kg Proyectados</div>
                      <div className="font-mono font-black text-lg text-slate-900">
                        {formatNumber(cat.kgProyectados, 1)} kg
                      </div>
                    </div>
                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Desglose de Productos en la Categoría */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 font-bold text-slate-600 text-[11px] border-b border-slate-200">
                          <th className="p-3">Producto / Presentación</th>
                          <th className="p-3 text-center">Peso Unitario</th>
                          <th className="p-3 text-center">Venta Base Semanal</th>
                          <th className="p-3 text-center">Proyección Semanal</th>
                          <th className="p-3 text-right">Kg Proyectados</th>
                          <th className="p-3 text-right">% Categoría</th>
                          <th className="p-3">Materiales de Empaque</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {cat.productos.map(p => {
                          const isOverridden = manualOverrides[p.productId] !== undefined;

                          return (
                            <tr key={p.productId} className={`hover:bg-slate-50/60 transition-colors ${isOverridden ? 'bg-amber-50/40' : ''}`}>
                              <td className="p-3 font-sans">
                                <div className="font-bold text-slate-900 text-xs">{p.productName}</div>
                                {p.etiqueta && (
                                  <div className="text-[10px] text-slate-400">🏷️ {p.etiqueta}</div>
                                )}
                              </td>
                              <td className="p-3 text-center text-slate-700 font-bold">
                                {formatNumber(p.pesoUnitarioKg, 3)} kg
                              </td>
                              <td className="p-3 text-center text-slate-500">
                                {p.piezasSemanalesBase} pz
                              </td>
                              <td className="p-3 text-center">
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={manualOverrides[p.productId] !== undefined ? manualOverrides[p.productId] : p.piezasSemanalesProyectadas}
                                    onChange={(e) => handleOverrideChange(p.productId, e.target.value)}
                                    className={`w-20 px-2 py-1 text-center font-bold font-mono rounded-lg border text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${
                                      isOverridden ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-800'
                                    }`}
                                  />
                                  <span className="text-[10px] text-slate-400 font-sans">pz</span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-black text-slate-900">
                                {formatNumber(p.kgSemanalesProyectados, 1)} kg
                              </td>
                              <td className="p-3 text-right text-slate-600 font-bold">
                                {p.porcentajeCategoria}%
                              </td>
                              <td className="p-3 font-sans">
                                {p.empaques && p.empaques.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {p.empaques.map(emp => (
                                      <span key={emp} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                        {emp}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Sin empaque configurado</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CONTENIDO 2: INSUMOS Y EXPLOSIÓN DE MATERIALES */}
      {activeTab === 'supplies' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Explosión de Insumos para la Semana</h3>
              <p className="text-xs text-slate-500">
                Cantidades netas requeridas para producir los {formatNumber(data?.kpis?.totalKgProduccion || 0, 1)} kg pronosticados.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Total Insumos: <span className="text-slate-900 font-mono">{filteredSupplies.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 font-bold text-slate-600 text-[11px] border-b border-slate-200">
                  <th className="p-3">Insumo / Material</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">Consumo Semanal</th>
                  <th className="p-3 text-right">Consumo Diario</th>
                  <th className="p-3 text-right">Stock Seguridad ({leadTimeDays}d)</th>
                  <th className="p-3 text-right">Stock Actual</th>
                  <th className="p-3 text-center">Cobertura</th>
                  <th className="p-3 text-center">Estatus Abasto</th>
                  <th className="p-3">Usado En</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredSupplies.map(item => (
                  <tr key={item.nombre} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-sans">
                      <div className="font-bold text-slate-900 text-xs">{item.nombre}</div>
                      <div className="text-[10px] text-slate-400">Prov: {item.proveedor}</div>
                    </td>
                    <td className="p-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.tipo === 'ingrediente' ? 'bg-sky-50 text-sky-800 border border-sky-200' :
                        item.tipo === 'empaque' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' :
                        'bg-purple-50 text-purple-800 border border-purple-200'
                      }`}>
                        {item.tipoLabel}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      {formatNumber(item.consumoSemanal, 1)} {item.unidadBase}
                    </td>
                    <td className="p-3 text-right text-slate-600">
                      {formatNumber(item.consumoDiario, 1)} {item.unidadBase}/d
                    </td>
                    <td className="p-3 text-right text-indigo-700 font-bold">
                      {formatNumber(item.stockSeguridad, 1)} {item.unidadBase}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800">
                      {formatNumber(item.stockActual, 1)} {item.unidadBase}
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className={item.diasCobertura < leadTimeDays ? 'text-rose-600 font-black' : item.diasCobertura < 7 ? 'text-amber-600' : 'text-emerald-600'}>
                        {item.diasCobertura >= 900 ? 'Sin consumo' : `${item.diasCobertura} d`}
                      </span>
                    </td>
                    <td className="p-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                        item.estatusAbasto === 'critico' ? 'bg-rose-100 text-rose-800 font-black' :
                        item.estatusAbasto === 'riesgo' ? 'bg-amber-100 text-amber-800 font-bold' :
                        'bg-emerald-100 text-emerald-800 font-bold'
                      }`}>
                        {item.estatusLabel}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-500 text-[10px]">
                      {item.usadoEnCategorias?.slice(0, 3).join(', ') || 'General'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO 3: PLAN DE COMPRAS Y ABASTO POR PROVEEDOR */}
      {activeTab === 'purchases' && (
        <div className="space-y-6">
          {filteredProviders.map(prov => {
            const itemsWithOrders = prov.items.filter(i => i.compraSugerida > 0);

            return (
              <div key={prov.proveedor} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Cabecera Proveedor */}
                <div className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-base">{prov.proveedor}</h3>
                      {prov.itemsCriticos > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse">
                          {prov.itemsCriticos} críticos
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {itemsWithOrders.length} de {prov.totalItems} insumos requieren pedido para garantizar el abasto semanal
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Total Orden Estimado</div>
                      <div className="font-mono font-black text-base text-emerald-700">
                        {formatMoney(prov.costoTotalOrden)}
                      </div>
                    </div>

                    {/* Botón WhatsApp / Copiar */}
                    <button
                      onClick={() => handleCopyProviderOrder(prov)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                      title="Copiar lista para WhatsApp o Correo"
                    >
                      {copySuccess === prov.proveedor ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copySuccess === prov.proveedor ? '¡Copiado!' : 'Compartir Pedido'}</span>
                    </button>

                    {/* Botón Generar Compra Automática */}
                    <button
                      onClick={() => handleQuickPurchaseForProvider(prov)}
                      disabled={purchasingProvider === prov.proveedor || itemsWithOrders.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-40"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{purchasingProvider === prov.proveedor ? 'Registrando...' : 'Registrar Compra'}</span>
                    </button>
                  </div>
                </div>

                {/* Tabla de Insumos del Proveedor */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/60 font-bold text-slate-600 text-[11px] border-b border-slate-200">
                        <th className="p-3">Insumo</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3 text-right">Stock Actual</th>
                        <th className="p-3 text-right">Consumo Semanal</th>
                        <th className="p-3 text-right">Stock Seguridad ({leadTimeDays}d)</th>
                        <th className="p-3 text-center">Cobertura Actual</th>
                        <th className="p-3 text-center">Estatus</th>
                        <th className="p-3 text-right bg-amber-50 text-amber-900">Compra Sugerida</th>
                        <th className="p-3 text-right bg-emerald-50 text-emerald-900">Costo Estimado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {prov.items.map(item => (
                        <tr key={item.nombre} className={`hover:bg-slate-50/60 transition-colors ${item.compraSugerida > 0 ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-slate-900 text-xs">{item.nombre}</div>
                            {item.presentacionCompra && (
                              <div className="text-[10px] text-slate-400">Presentación: {item.presentacionCompra}</div>
                            )}
                          </td>
                          <td className="p-3 font-sans">
                            <span className="text-[10px] font-bold text-slate-600">
                              {item.tipoLabel}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            {formatNumber(item.stockActual, 1)} {item.unidadBase}
                          </td>
                          <td className="p-3 text-right text-slate-600">
                            {formatNumber(item.consumoSemanal, 1)} {item.unidadBase}
                          </td>
                          <td className="p-3 text-right text-indigo-700 font-bold">
                            {formatNumber(item.stockSeguridad, 1)} {item.unidadBase}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={item.diasCobertura < leadTimeDays ? 'text-rose-600 font-black' : item.diasCobertura < 7 ? 'text-amber-600' : 'text-emerald-600'}>
                              {item.diasCobertura >= 900 ? 'Sin consumo' : `${item.diasCobertura} d`}
                            </span>
                          </td>
                          <td className="p-3 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              item.estatusAbasto === 'critico' ? 'bg-rose-100 text-rose-800 font-black' :
                              item.estatusAbasto === 'riesgo' ? 'bg-amber-100 text-amber-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.estatusLabel}
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-amber-950 bg-amber-50/50">
                            {item.compraSugerida > 0 ? `${formatNumber(item.compraSugerida, 0)} ${item.unidadBase}` : '0'}
                          </td>
                          <td className="p-3 text-right font-black text-emerald-800 bg-emerald-50/50">
                            {item.compraSugerida > 0 ? formatMoney(item.costoEstimadoCompra) : '---'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
