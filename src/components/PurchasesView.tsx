import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Search,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Coins,
  Save,
  Package,
  Layers,
  Clock,
  Tag,
  Scale,
  Receipt,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { AppState } from '../types';

interface IngredientItem {
  name: string;
  unitCost: number;
  isIngredient: boolean;
  applicableCategories?: string[];
  provider?: string;
  empaquePresentation?: string;
  empaqueCost?: number;
  baseUnit?: string;
}

interface PurchaseRecord {
  id: string;
  fechaCompra: string;
  fechaCaptura: string;
  folio?: string;
  itemNombre: string;
  isIngredient: boolean;
  proveedor: string;
  empaqueTipo: string;
  empaquesCantidad: number;
  contenidoPorEmpaque: number;
  unidadBase: string;
  totalUnidadesBase: number;
  costoTotal: number;
  costoPorEmpaque: number;
  costoUnitarioBase: number;
  costoAnteriorBase?: number;
  notas?: string;
}

export default function PurchasesView({
  role,
  user,
  state
}: {
  role?: string;
  user?: { username: string; role: string };
  state: AppState;
}) {
  const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit?usp=sharing';
  const todayStr = new Date().toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState<'register' | 'catalog' | 'history'>('register');
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State for Purchase Registration
  const [isIngredientType, setIsIngredientType] = useState<boolean>(true);
  const [selectedItemName, setSelectedItemName] = useState<string>('');
  const [fechaCompra, setFechaCompra] = useState<string>(todayStr);
  const [proveedor, setProveedor] = useState<string>('TASSA');
  const [folio, setFolio] = useState<string>('');
  const [empaqueTipo, setEmpaqueTipo] = useState<string>('Saco');
  const [empaquesCantidad, setEmpaquesCantidad] = useState<number | ''>(1);
  const [contenidoPorEmpaque, setContenidoPorEmpaque] = useState<number | ''>(50);
  const [unidadBase, setUnidadBase] = useState<string>('kg');
  const [costoTotal, setCostoTotal] = useState<number | ''>('');
  const [notas, setNotas] = useState<string>('');

  // Catalog Table State
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'ingredients' | 'packaging'>('all');
  const [editableCatalog, setEditableCatalog] = useState<IngredientItem[]>([]);
  const [showAddCatalogModal, setShowAddCatalogModal] = useState<boolean>(false);
  const [newCatalogItem, setNewCatalogItem] = useState<{
    name: string;
    isIngredient: boolean;
    unitCost: number;
    provider: string;
    empaquePresentation: string;
    baseUnit: string;
  }>({
    name: '',
    isIngredient: true,
    unitCost: 0,
    provider: 'TASSA',
    empaquePresentation: '50 kg (Saco)',
    baseUnit: 'kg'
  });

  // Purchase History Search
  const [historySearch, setHistorySearch] = useState<string>('');

  // Load initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [cfgRes, purRes] = await Promise.all([
        apiFetch('/api/production/config'),
        apiFetch('/api/production/purchases')
      ]);

      const cfgData = await cfgRes.json();
      const purData = await purRes.json();

      const items = cfgData.ingredients || [];
      setIngredients(items);
      setEditableCatalog(items);
      setPurchases(purData || []);

      if (items.length > 0 && !selectedItemName) {
        setSelectedItemName(items[0].name);
        setProveedor(items[0].provider || 'TASSA');
        if (items[0].isIngredient) {
          setIsIngredientType(true);
          setUnidadBase('kg');
          setEmpaqueTipo('Saco');
          setContenidoPorEmpaque(50);
        } else {
          setIsIngredientType(false);
          setUnidadBase('pz');
          setEmpaqueTipo('Caja');
          setContenidoPorEmpaque(1000);
        }
      }
    } catch (e: any) {
      console.error('Error cargando compras:', e);
      setErrorMessage('Error al cargar datos del catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected item changes, adapt defaults
  const handleItemSelect = (itemName: string) => {
    setSelectedItemName(itemName);
    const item = ingredients.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (item) {
      setIsIngredientType(item.isIngredient);
      if (item.provider) setProveedor(item.provider);
      if (item.baseUnit) {
        setUnidadBase(item.baseUnit);
      } else {
        setUnidadBase(item.isIngredient ? 'kg' : 'pz');
      }

      // Try parsing presentation if available
      if (item.empaquePresentation) {
        const numMatch = item.empaquePresentation.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) {
          setContenidoPorEmpaque(parseFloat(numMatch[1]));
        }
      }
    }
  };

  // When item type changes, suggest defaults
  const handleTypeChange = (isIng: boolean) => {
    setIsIngredientType(isIng);
    if (isIng) {
      setUnidadBase('kg');
      setEmpaqueTipo('Saco');
      setContenidoPorEmpaque(50);
    } else {
      setUnidadBase('pz');
      setEmpaqueTipo('Caja');
      setContenidoPorEmpaque(1000);
    }
  };

  // Calculations for Live Breakdown
  const liveBreakdown = useMemo(() => {
    const qtyEmpaques = typeof empaquesCantidad === 'number' ? empaquesCantidad : 0;
    const contEmpaque = typeof contenidoPorEmpaque === 'number' ? contenidoPorEmpaque : 0;
    const totalBase = qtyEmpaques * contEmpaque;
    const totalCostNum = typeof costoTotal === 'number' ? costoTotal : 0;

    const unitBaseCost = totalBase > 0 ? totalCostNum / totalBase : 0;
    const commercialEmpaqueCost = qtyEmpaques > 0 ? totalCostNum / qtyEmpaques : 0;

    const existingItem = ingredients.find(i => i.name.toLowerCase() === selectedItemName.trim().toLowerCase());
    const prevCost = existingItem ? (existingItem.unitCost || 0) : null;
    const diff = prevCost !== null && prevCost > 0 ? unitBaseCost - prevCost : null;
    const percentDiff = prevCost !== null && prevCost > 0 ? ((unitBaseCost - prevCost) / prevCost) * 100 : null;

    return {
      totalBase,
      unitBaseCost,
      commercialEmpaqueCost,
      prevCost,
      diff,
      percentDiff
    };
  }, [empaquesCantidad, contenidoPorEmpaque, costoTotal, selectedItemName, ingredients]);

  // Submit Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemName.trim()) {
      setErrorMessage('Por favor selecciona o escribe el insumo.');
      return;
    }
    if (!costoTotal || Number(costoTotal) <= 0) {
      setErrorMessage('Por favor ingresa el costo total de la compra.');
      return;
    }
    if (!empaquesCantidad || Number(empaquesCantidad) <= 0) {
      setErrorMessage('La cantidad de empaques debe ser mayor a 0.');
      return;
    }
    if (!contenidoPorEmpaque || Number(contenidoPorEmpaque) <= 0) {
      setErrorMessage('El contenido por empaque debe ser mayor a 0.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = {
        fechaCompra,
        folio: folio.trim(),
        itemNombre: selectedItemName.trim(),
        isIngredient: isIngredientType,
        proveedor: proveedor.trim() || 'General',
        empaqueTipo,
        empaquesCantidad: Number(empaquesCantidad),
        contenidoPorEmpaque: Number(contenidoPorEmpaque),
        unidadBase,
        costoTotal: Number(costoTotal),
        notas: notas.trim()
      };

      const res = await apiFetch('/api/production/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || '¡Compra registrada con éxito y catálogo actualizado!');
        setCostoTotal('');
        setFolio('');
        setNotas('');
        await loadData();
      } else {
        setErrorMessage(data.message || 'Error al registrar la compra.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Save modified catalog to Google Sheets
  const handleSaveCatalog = async () => {
    try {
      setSavingCatalog(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await apiFetch('/api/production/config/update-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: editableCatalog })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`¡Catálogo de ${data.count || editableCatalog.length} insumos y empaques sincronizado en Google Sheets!`);
        await loadData();
      } else {
        setErrorMessage(data.message || 'Error al guardar catálogo.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión.');
    } finally {
      setSavingCatalog(false);
    }
  };

  // Add new item modal submit
  const handleAddNewCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatalogItem.name.trim()) return;

    const exists = editableCatalog.some(
      i => i.name.toLowerCase() === newCatalogItem.name.trim().toLowerCase()
    );
    if (exists) {
      alert('Ya existe un insumo o empaque con este nombre en el catálogo.');
      return;
    }

    const item: IngredientItem = {
      name: newCatalogItem.name.trim(),
      unitCost: Number(newCatalogItem.unitCost) || 0,
      isIngredient: newCatalogItem.isIngredient,
      applicableCategories: [],
      provider: newCatalogItem.provider.trim() || 'General',
      empaquePresentation: newCatalogItem.empaquePresentation.trim() || '1 unidad',
      baseUnit: newCatalogItem.baseUnit
    };

    setEditableCatalog(prev => [item, ...prev]);
    setShowAddCatalogModal(false);
    setSelectedItemName(item.name);
    setIsIngredientType(item.isIngredient);
    setProveedor(item.provider || 'General');
    setUnidadBase(item.baseUnit || (item.isIngredient ? 'kg' : 'pz'));

    setNewCatalogItem({
      name: '',
      isIngredient: true,
      unitCost: 0,
      provider: 'TASSA',
      empaquePresentation: '50 kg (Saco)',
      baseUnit: 'kg'
    });
  };

  // Delete item from catalog
  const handleDeleteCatalogItem = (name: string) => {
    if (!window.confirm(`¿Estás seguro de quitar "${name}" del catálogo?`)) return;
    setEditableCatalog(prev => prev.filter(i => i.name !== name));
  };

  // Filtered catalog list
  const filteredCatalog = useMemo(() => {
    return editableCatalog.filter(item => {
      if (catalogFilter === 'ingredients' && !item.isIngredient) return false;
      if (catalogFilter === 'packaging' && item.isIngredient) return false;
      if (!catalogSearch) return true;
      const q = catalogSearch.toLowerCase();
      return (
        (item.name || '').toLowerCase().includes(q) ||
        (item.provider || '').toLowerCase().includes(q) ||
        (item.empaquePresentation || '').toLowerCase().includes(q)
      );
    });
  }, [editableCatalog, catalogFilter, catalogSearch]);

  // Filtered purchases history
  const filteredPurchases = useMemo(() => {
    if (!historySearch) return purchases;
    const q = historySearch.toLowerCase();
    return purchases.filter(p =>
      (p.itemNombre || '').toLowerCase().includes(q) ||
      (p.proveedor || '').toLowerCase().includes(q) ||
      (p.folio || '').toLowerCase().includes(q) ||
      (p.empaqueTipo || '').toLowerCase().includes(q)
    );
  }, [purchases, historySearch]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Compras e Insumos</h2>
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sheets Conectado
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Desglose automático de compras comerciales a unidades base de producción (kg, lt, pz, un)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Hoja Oficial Google Sheets</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </a>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === 'register'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>1. Registrar Compra y Desglose Base</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === 'catalog'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Inventario y Catálogo Base ({ingredients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>3. Historial de Compras ({purchases.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REGISTRAR COMPRA Y DESGLOSE A UNIDAD BASE */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <form onSubmit={handleSubmitPurchase} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Form Input */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  Datos de la Compra Comercial
                </h3>
                <span className="text-xs text-slate-400 font-medium">Factura o Remisión</span>
              </div>

              {/* Type Switcher */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  Tipo de Material
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                      isIngredientType
                        ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Materia Prima / Insumo (kg / lt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                      !isIngredientType
                        ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Empaque / Etiqueta (pz / un)</span>
                  </button>
                </div>
              </div>

              {/* Item Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">Insumo o Empaque a Actualizar</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCatalogModal(true)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Nuevo Insumo
                  </button>
                </div>
                <select
                  value={selectedItemName}
                  onChange={e => handleItemSelect(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="">-- Seleccionar Insumo o Empaque --</option>
                  <optgroup label="Materias Primas / Recetas">
                    {ingredients
                      .filter(i => i.isIngredient)
                      .map(i => (
                        <option key={i.name} value={i.name}>
                          {i.name} ({i.provider || 'TASSA'}) - Actual: ${Number(i.unitCost || 0).toFixed(2)}/kg
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Empaques y Etiquetas">
                    {ingredients
                      .filter(i => !i.isIngredient)
                      .map(i => (
                        <option key={i.name} value={i.name}>
                          {i.name} ({i.provider || 'Suintar'}) - Actual: ${Number(i.unitCost || 0).toFixed(3)}/pz
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Date, Provider & Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha Compra</label>
                  <input
                    type="date"
                    required
                    value={fechaCompra}
                    onChange={e => setFechaCompra(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Proveedor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. TASSA, Suintar"
                    value={proveedor}
                    onChange={e => setProveedor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Folio / Factura</label>
                  <input
                    type="text"
                    placeholder="Ej. F-10482"
                    value={folio}
                    onChange={e => setFolio(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Commercial Packaging Breakdown Fields */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  Presentación Comercial de Compra
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Tipo de Empaque</label>
                    <select
                      value={empaqueTipo}
                      onChange={e => setEmpaqueTipo(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="Saco">Saco / Bulto</option>
                      <option value="Caja">Caja</option>
                      <option value="Tambo">Tambo / Bidón</option>
                      <option value="Garrafa">Garrafa / Porrón</option>
                      <option value="Cubeta">Cubeta</option>
                      <option value="Rollo">Rollo</option>
                      <option value="Pieza">Pieza / Unidad</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Cant. Empaques Comprados
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      placeholder="Ej. 2"
                      value={empaquesCantidad}
                      onChange={e => setEmpaquesCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Contenido por Empaque
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      placeholder="Ej. 50"
                      value={contenidoPorEmpaque}
                      onChange={e => setContenidoPorEmpaque(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Base Unit Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Unidad Base de Producción (Fórmulas y Recetas)
                  </label>
                  <div className="flex items-center gap-2">
                    {['kg', 'lt', 'pz', 'un'].map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnidadBase(u)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          unidadBase === u
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {u === 'kg' ? 'Kilogramo (kg)' : u === 'lt' ? 'Litro (lt)' : u === 'pz' ? 'Pieza (pz)' : 'Unidad (un)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Total Purchase Cost */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Costo Total de la Compra Facturada ($ MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ej. 1680.00"
                    value={costoTotal}
                    onChange={e => setCostoTotal(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Notas / Observaciones (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Compra urgente por pedido especial o variación de precio TASSA"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            {/* Right 5 Columns: Live Converted Breakdown Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-6 rounded-2xl shadow-lg space-y-5">
                <div className="flex items-center justify-between border-b border-white/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-emerald-200" />
                    <h3 className="font-bold text-sm tracking-wide">Desglose a Unidad Base en Vivo</h3>
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
                    Automático
                  </span>
                </div>

                {/* Main Converted Unit Cost KPI */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                  <span className="text-xs text-emerald-100 font-medium block mb-1">
                    Costo Unitario Base Convertido ($ / {unidadBase})
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight">
                      ${liveBreakdown.unitBaseCost > 0 ? liveBreakdown.unitBaseCost.toFixed(4) : '0.0000'}
                    </span>
                    <span className="text-xs text-emerald-200 font-bold uppercase">
                      MXN por {unidadBase}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100/90 mt-1">
                    Este es el costo que se aplicará en las fórmulas de producción y empaque.
                  </p>
                </div>

                {/* Sub Metrics: Total Base Units & Commercial Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <span className="text-[11px] text-emerald-200 block mb-0.5">Total Unidades Base</span>
                    <span className="text-lg font-bold">
                      {liveBreakdown.totalBase.toLocaleString()} {unidadBase}
                    </span>
                    <span className="text-[10px] text-emerald-200/80 block mt-0.5">
                      ({empaquesCantidad || 0} {empaqueTipo}s × {contenidoPorEmpaque || 0} {unidadBase})
                    </span>
                  </div>

                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <span className="text-[11px] text-emerald-200 block mb-0.5">Costo por Empaque</span>
                    <span className="text-lg font-bold">
                      ${liveBreakdown.commercialEmpaqueCost.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-200/80 block mt-0.5">
                      por cada {empaqueTipo}
                    </span>
                  </div>
                </div>

                {/* Cost Comparison vs Previous */}
                {liveBreakdown.prevCost !== null && liveBreakdown.prevCost > 0 && (
                  <div className="bg-black/20 p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-emerald-200 block">Comparativa con Costo Anterior</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-slate-300">
                          Ant: ${liveBreakdown.prevCost.toFixed(4)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-white/60" />
                        <span className="text-xs font-bold text-white">
                          Nuevo: ${liveBreakdown.unitBaseCost.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {liveBreakdown.percentDiff !== null && (
                      <div
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          liveBreakdown.percentDiff > 0
                            ? 'bg-rose-500/80 text-white'
                            : liveBreakdown.percentDiff < 0
                            ? 'bg-emerald-400 text-slate-900'
                            : 'bg-white/20 text-white'
                        }`}
                      >
                        {liveBreakdown.percentDiff > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {liveBreakdown.percentDiff > 0 ? '+' : ''}
                          {liveBreakdown.percentDiff.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Explanation Banner */}
                <div className="p-3 bg-white/10 rounded-xl text-[11px] text-emerald-50 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-white">
                    <HelpCircle className="w-3.5 h-3.5" /> Sincronización Google Sheets
                  </div>
                  <p>
                    Al dar clic en guardar, se actualizará el catálogo maestro y se sobrescribirá la pestaña <code>Costos</code> en Google Sheets borrando el costo anterior y dejando registrado el nuevo costo unitario base.
                  </p>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !selectedItemName || !costoTotal}
                  className="w-full py-3.5 bg-white text-emerald-900 hover:bg-emerald-50 active:scale-[0.99] font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                  <span>
                    {submitting ? 'Actualizando Google Sheets...' : 'Guardar Compra y Actualizar Catálogo'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INVENTARIO Y CATÁLOGO BASE */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Catálogo de Insumos y Empaques (Unidades Base)</h3>
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {editableCatalog.length} Items Registrados
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Todos los insumos y materiales convertidos en su unidad base de producción (<strong>kg, lt, pz, un</strong>). Los cambios se sincronizan directamente con la pestaña <code>Costos</code> de Google Sheets.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCatalogModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nuevo Item</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCatalog}
                disabled={savingCatalog}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:bg-emerald-400"
              >
                <Save className={`w-4 h-4 ${savingCatalog ? 'animate-spin' : ''}`} />
                <span>{savingCatalog ? 'Sincronizando Sheets...' : 'Sincronizar Catálogo con Google Sheets'}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 sm:w-80">
              <input
                type="text"
                placeholder="Buscar insumo, empaque o proveedor..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setCatalogFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  catalogFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({editableCatalog.length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('ingredients')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  catalogFilter === 'ingredients'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Materias Primas ({editableCatalog.filter(i => i.isIngredient).length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('packaging')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  catalogFilter === 'packaging'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Empaques y Etiquetas ({editableCatalog.filter(i => !i.isIngredient).length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="p-3.5">Nombre / Descripción</th>
                    <th className="p-3.5">Tipo</th>
                    <th className="p-3.5">Unidad Base</th>
                    <th className="p-3.5">Presentación Compra</th>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5 text-right w-44">Costo Unitario Base ($)</th>
                    <th className="p-3.5 text-center w-20">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredCatalog.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">{item.name}</td>
                      <td className="p-3.5">
                        {item.isIngredient ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Materia Prima
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Empaque / Etiqueta
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          {item.baseUnit || (item.isIngredient ? 'kg' : 'pz')}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">{item.empaquePresentation || '1 unidad'}</td>
                      <td className="p-3.5 text-slate-500">{item.provider || 'TASSA'}</td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={item.unitCost}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditableCatalog(prev =>
                                prev.map(i => (i.name === item.name ? { ...i, unitCost: val } : i))
                              );
                            }}
                            className="w-28 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 text-right focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogItem(item.name)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                          title="Eliminar del catálogo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No se encontraron insumos o empaques con el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HISTORIAL DE COMPRAS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historial de Compras Registradas</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bitácora cronológica con desglose a unidades base y montos totales
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Buscar por insumo, proveedor o folio..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Folio</th>
                    <th className="p-3.5">Insumo / Material</th>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5">Presentación Comprada</th>
                    <th className="p-3.5 text-right">Total Unidades Base</th>
                    <th className="p-3.5 text-right">Costo Total</th>
                    <th className="p-3.5 text-right">Costo Unit. Base</th>
                    <th className="p-3.5">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-slate-800">{p.fechaCompra}</td>
                      <td className="p-3.5 text-slate-500">{p.folio || '---'}</td>
                      <td className="p-3.5 font-bold text-slate-900">{p.itemNombre}</td>
                      <td className="p-3.5 text-slate-600">{p.proveedor}</td>
                      <td className="p-3.5 text-slate-600">
                        {p.empaquesCantidad} {p.empaqueTipo}s de {p.contenidoPorEmpaque} {p.unidadBase}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900">
                        {p.totalUnidadesBase.toLocaleString()} {p.unidadBase}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-700">
                        ${p.costoTotal.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-black text-blue-700">
                        ${p.costoUnitarioBase.toFixed(4)} / {p.unidadBase}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px] truncate max-w-xs">{p.notas || '---'}</td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No hay compras registradas en el historial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Item to Master Catalog */}
      {showAddCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">Agregar Nuevo Insumo o Empaque</h4>
              <button
                onClick={() => setShowAddCatalogModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewCatalogItem} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nombre o Descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Bolsa Pounch 8 X 10 o Sal Yodada"
                  value={newCatalogItem.name}
                  onChange={e => setNewCatalogItem({ ...newCatalogItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tipo</label>
                  <select
                    value={newCatalogItem.isIngredient ? 'ingredient' : 'packaging'}
                    onChange={e => {
                      const isIng = e.target.value === 'ingredient';
                      setNewCatalogItem({
                        ...newCatalogItem,
                        isIngredient: isIng,
                        baseUnit: isIng ? 'kg' : 'pz'
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="ingredient">Materia Prima / Insumo</option>
                    <option value="packaging">Empaque / Etiqueta</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Unidad Base</label>
                  <select
                    value={newCatalogItem.baseUnit}
                    onChange={e => setNewCatalogItem({ ...newCatalogItem, baseUnit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="kg">kg (Kilogramo)</option>
                    <option value="lt">lt (Litro)</option>
                    <option value="pz">pz (Pieza)</option>
                    <option value="un">un (Unidad)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Costo Unitario Base ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    placeholder="0.00"
                    value={newCatalogItem.unitCost || ''}
                    onChange={e => setNewCatalogItem({ ...newCatalogItem, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Proveedor</label>
                  <input
                    type="text"
                    placeholder="Ej. TASSA o Suintar"
                    value={newCatalogItem.provider}
                    onChange={e => setNewCatalogItem({ ...newCatalogItem, provider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Presentación Comercial Típica</label>
                <input
                  type="text"
                  placeholder="Ej. 50 kg (Saco) o 1000 pz (Caja)"
                  value={newCatalogItem.empaquePresentation}
                  onChange={e => setNewCatalogItem({ ...newCatalogItem, empaquePresentation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCatalogModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  Agregar al Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
