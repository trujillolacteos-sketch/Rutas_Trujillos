import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import {
  Boxes,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  Tag,
  ArrowUpDown,
  History,
  Sliders,
  X,
  FileSpreadsheet,
  PlusCircle,
  ShoppingCart,
  DollarSign,
  Info
} from 'lucide-react';
import { AppState } from '../types';

interface SupplyMovement {
  id: string;
  fecha: string;
  tipo: 'compra' | 'produccion' | 'empaque' | 'linea' | 'ajuste_inicial';
  referencia: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  costoUnitario?: number;
  costoTotal?: number;
}

interface SupplyItemSummary {
  id: string;
  nombre: string;
  tipo: 'ingrediente' | 'empaque' | 'etiqueta';
  tipoLabel: string;
  unidadBase: string;
  proveedor: string;
  costoUnitario: number;
  stockInicial: number;
  minStock: number;
  totalComprado: number;
  totalConsumido: number;
  stockActual: number;
  estado: 'critico' | 'bajo' | 'optimo';
  estadoLabel: string;
  montoInvertidoCompras: number;
  valorInventarioActual: number;
  ultimaCompraFecha?: string;
  ultimaCompraProveedor?: string;
  movimientos: SupplyMovement[];
}

interface InventoryResponse {
  supplies: SupplyItemSummary[];
  stats: {
    totalItems: number;
    criticos: number;
    bajos: number;
    optimos: number;
    valorTotalAlmacen: number;
    montoTotalInvertido: number;
  };
}

export default function SuppliesInventoryView({
  role,
  user,
  state
}: {
  role?: string;
  user?: { username: string; role: string };
  state: AppState;
}) {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critico' | 'bajo' | 'optimo'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ingrediente' | 'empaque' | 'etiqueta'>('all');

  // Modal Kárdex
  const [selectedSupplyForKardex, setSelectedSupplyForKardex] = useState<SupplyItemSummary | null>(null);

  // Modal Ajuste de Stock
  const [editingItem, setEditingItem] = useState<SupplyItemSummary | null>(null);
  const [editInitialStock, setEditInitialStock] = useState<string>('0');
  const [editMinStock, setEditMinStock] = useState<string>('15');
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/production/supplies-inventory');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching supplies inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenEdit = (item: SupplyItemSummary) => {
    setEditingItem(item);
    setEditInitialStock(String(item.stockInicial || 0));
    setEditMinStock(String(item.minStock || 15));
  };

  const handleSaveStockConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setSavingConfig(true);
      const res = await apiFetch('/api/production/supplies-stock-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: editingItem.nombre,
          initialStock: Number(editInitialStock) || 0,
          minStock: Number(editMinStock) || 0
        })
      });

      if (res.ok) {
        showToast(`Stock y umbral guardados para "${editingItem.nombre}"`, 'success');
        setEditingItem(null);
        fetchInventory();
      } else {
        const errJson = await res.json();
        showToast(errJson.error || 'Error al guardar configuración', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de conexión', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Filtered supplies
  const filteredSupplies = useMemo(() => {
    if (!data?.supplies) return [];
    return data.supplies.filter(item => {
      // Status
      if (statusFilter !== 'all' && item.estado !== statusFilter) return false;
      // Type
      if (typeFilter !== 'all' && item.tipo !== typeFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.nombre.toLowerCase().includes(q);
        const matchesProvider = item.proveedor.toLowerCase().includes(q);
        if (!matchesName && !matchesProvider) return false;
      }
      return true;
    });
  }, [data, statusFilter, typeFilter, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredSupplies.length) return;
    const headers = [
      'Insumo / Material',
      'Tipo',
      'Unidad Base',
      'Proveedor Principal',
      'Stock Inicial',
      'Total Comprado (+)',
      'Total Gastado (-)',
      'Stock Actual',
      'Stock Mínimo (Alerta)',
      'Estado',
      'Costo Unitario ($)',
      'Valor en Almacén ($)',
      'Última Compra Fecha'
    ];

    const rows = filteredSupplies.map(s => [
      `"${s.nombre.replace(/"/g, '""')}"`,
      `"${s.tipoLabel}"`,
      s.unidadBase,
      `"${s.proveedor}"`,
      s.stockInicial,
      s.totalComprado,
      s.totalConsumido,
      s.stockActual,
      s.minStock,
      `"${s.estadoLabel}"`,
      s.costoUnitario,
      s.valorInventarioActual,
      s.ultimaCompraFecha || 'Sin registro'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_insumos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-sm font-semibold animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              Inventario de Insumos y Empaques
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              Control de compras vs consumos en producción, balance en almacén y alertas de reorden
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Recargar datos de inventario"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!filteredSupplies.length}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Hero Stats */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Insumos Totales</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-800">{data.stats.totalItems}</p>
            <span className="text-[11px] text-slate-400 font-medium">Registrados en catálogo</span>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'critico' ? 'all' : 'critico')}
            className={`cursor-pointer transition-all p-4 rounded-2xl border shadow-sm ${
              statusFilter === 'critico'
                ? 'bg-rose-100/70 border-rose-400 ring-2 ring-rose-400'
                : 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/50'
            }`}
          >
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Agotados / Críticos</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-black text-rose-700">{data.stats.criticos}</p>
            <span className="text-[11px] text-rose-600 font-bold">Stock ≤ 0 (Requiere compra)</span>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'bajo' ? 'all' : 'bajo')}
            className={`cursor-pointer transition-all p-4 rounded-2xl border shadow-sm ${
              statusFilter === 'bajo'
                ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-400'
                : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/50'
            }`}
          >
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Próximos a Agotarse</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-700">{data.stats.bajos}</p>
            <span className="text-[11px] text-amber-700 font-bold">Bajo el stock mínimo</span>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'optimo' ? 'all' : 'optimo')}
            className={`cursor-pointer transition-all p-4 rounded-2xl border shadow-sm ${
              statusFilter === 'optimo'
                ? 'bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-400'
                : 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/50'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Stock Óptimo</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700">{data.stats.optimos}</p>
            <span className="text-[11px] text-emerald-600 font-medium">Existencia suficiente</span>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-indigo-600 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Valor en Almacén</span>
              <DollarSign className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              ${data.stats.valorTotalAlmacen.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">Insumos con existencia</span>
          </div>
        </div>
      )}

      {/* Critical Reorder Warning Banner */}
      {data && (data.stats.criticos > 0 || data.stats.bajos > 0) && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent p-4 rounded-2xl border border-amber-300/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Atención: Hay <span className="text-rose-600 font-black">{data.stats.criticos}</span> insumos agotados y <span className="text-amber-700 font-black">{data.stats.bajos}</span> próximos a terminarse.
              </p>
              <p className="text-xs text-slate-600">
                Verifica las órdenes de compra para evitar que las líneas de quesos o el empacado se detengan por falta de material.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter(statusFilter === 'all' ? 'critico' : 'all')}
            className="px-3.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all whitespace-nowrap self-end md:self-auto"
          >
            {statusFilter === 'all' ? 'Ver Insumos en Riesgo' : 'Ver Todos los Insumos'}
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por insumo, empaque, etiqueta o proveedor..."
            className="w-full pl-10 pr-4 py-2 text-xs md:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Todos ({data?.supplies.length || 0})
            </button>
            <button
              onClick={() => setStatusFilter('critico')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                statusFilter === 'critico' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
              Agotados ({data?.stats.criticos || 0})
            </button>
            <button
              onClick={() => setStatusFilter('bajo')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                statusFilter === 'bajo' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Bajos ({data?.stats.bajos || 0})
            </button>
            <button
              onClick={() => setStatusFilter('optimo')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                statusFilter === 'optimo' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Óptimos ({data?.stats.optimos || 0})
            </button>
          </div>

          {/* Type Select */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tipo: Todos</option>
            <option value="ingrediente">Ingredientes / Materia Prima</option>
            <option value="empaque">Empaques / Contenedores</option>
            <option value="etiqueta">Etiquetas</option>
          </select>
        </div>
      </div>

      {/* Supplies Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Insumo / Material</th>
                <th className="py-3 px-3 text-center">Unidad</th>
                <th className="py-3 px-3 text-right">Stock Inicial</th>
                <th className="py-3 px-3 text-right text-emerald-700">Compras (+)</th>
                <th className="py-3 px-3 text-right text-rose-700">Gastado (-)</th>
                <th className="py-3 px-4 text-right">Stock Actual</th>
                <th className="py-3 px-3 text-center">Umbral Mín.</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-right">Costo Unit.</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Calculando balance de inventario y consumos...
                  </td>
                </tr>
              ) : filteredSupplies.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No se encontraron insumos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredSupplies.map(item => {
                  const isCritical = item.estado === 'critico';
                  const isLow = item.estado === 'bajo';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCritical ? 'bg-rose-50/20' : isLow ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Name & Type */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.nombre}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                item.tipo === 'ingrediente'
                                  ? 'bg-blue-100 text-blue-700'
                                  : item.tipo === 'empaque'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.tipoLabel}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {item.proveedor}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase">
                        {item.unidadBase}
                      </td>

                      {/* Initial Stock */}
                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {item.stockInicial.toLocaleString('es-MX')}
                      </td>

                      {/* Purchases (+) */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        +{item.totalComprado.toLocaleString('es-MX')}
                      </td>

                      {/* Consumed (-) */}
                      <td className="py-3 px-3 text-right font-bold text-rose-600">
                        -{item.totalConsumido.toLocaleString('es-MX')}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span
                            className={`font-black text-sm ${
                              isCritical
                                ? 'text-rose-700'
                                : isLow
                                ? 'text-amber-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {item.stockActual.toLocaleString('es-MX')} {item.unidadBase}
                          </span>
                        </div>
                      </td>

                      {/* Min Threshold */}
                      <td className="py-3 px-3 text-center text-xs text-slate-500 font-semibold">
                        {item.minStock} {item.unidadBase}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isLow
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCritical ? 'bg-rose-600' : isLow ? 'bg-amber-600' : 'bg-emerald-600'
                            }`}
                          />
                          {item.estadoLabel}
                        </span>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-3 text-right text-xs text-slate-600 font-medium">
                        ${item.costoUnitario.toFixed(2)}
                      </td>

                      {/* Total Value */}
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        ${item.valorInventarioActual.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedSupplyForKardex(item)}
                            title="Ver Kárdex / Historial de Movimientos"
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Ajustar Stock Inicial y Umbral Mínimo"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Kárdex / Movimientos */}
      {selectedSupplyForKardex && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Kárdex y Trazabilidad de Movimientos
                </span>
                <h3 className="text-lg font-black text-slate-800">
                  {selectedSupplyForKardex.nombre}
                </h3>
                <span className="text-xs text-slate-500">
                  Stock Actual:{' '}
                  <strong className="text-slate-800 font-black">
                    {selectedSupplyForKardex.stockActual} {selectedSupplyForKardex.unidadBase}
                  </strong>{' '}
                  | Umbral Mínimo: {selectedSupplyForKardex.minStock} {selectedSupplyForKardex.unidadBase}
                </span>
              </div>
              <button
                onClick={() => setSelectedSupplyForKardex(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {selectedSupplyForKardex.movimientos.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold">Sin movimientos registrados</p>
                  <p className="text-xs text-slate-400">
                    Este insumo no tiene compras ni consumos en lotes registrados todavía.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedSupplyForKardex.movimientos.map(mov => {
                    const isPositive = mov.cantidad > 0;
                    return (
                      <div
                        key={mov.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isPositive
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                              isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{mov.descripcion}</p>
                            <span className="text-[11px] text-slate-400">
                              {mov.fecha} • {mov.referencia}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-black text-sm block ${
                              isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isPositive ? `+${mov.cantidad}` : mov.cantidad} {mov.unidad}
                          </span>
                          {mov.costoTotal ? (
                            <span className="text-[11px] text-slate-500 font-medium">
                              ${mov.costoTotal.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-end">
              <button
                onClick={() => setSelectedSupplyForKardex(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ajustar Stock Inicial y Umbral Mínimo */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Configuración de Parámetros
                </span>
                <h3 className="text-base font-black text-slate-800">{editingItem.nombre}</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stock Inicial ({editingItem.unidadBase})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editInitialStock}
                  onChange={e => setEditInitialStock(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  placeholder="0"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Existencia física inicial en planta antes de registrar consumos.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stock Mínimo para Alerta ({editingItem.unidadBase})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editMinStock}
                  onChange={e => setEditMinStock(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  placeholder="15"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Cuando la existencia caiga a este nivel o menos, el sistema avisará "Próximo a Agotarse".
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  {savingConfig ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sliders className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar Parámetros</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
