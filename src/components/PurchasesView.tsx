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
  HelpCircle,
  Calculator,
  Info,
  ListPlus,
  ClipboardList
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

// In-memory line item for an invoice being captured
interface InvoiceLine {
  id: string;
  itemNombre: string;
  isIngredient: boolean;
  empaqueTipo: string;
  empaquesCantidad: number;
  contenidoPorEmpaque: number;
  unidadBase: string;
  totalUnidadesBase: number;
  costoTotal: number;
  costoPorEmpaque: number;
  costoUnitarioBase: number;
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

  // Invoice Header State (Shared by all accumulated lines in this invoice)
  const [fechaCompra, setFechaCompra] = useState<string>(todayStr);
  const [proveedor, setProveedor] = useState<string>('TASSA');
  const [folio, setFolio] = useState<string>('');
  const [notasFactura, setNotasFactura] = useState<string>('');

  // Accumulated Lines for the current Invoice
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);

  // Current Line Input Fields
  const [isIngredientType, setIsIngredientType] = useState<boolean>(true);
  const [selectedItemName, setSelectedItemName] = useState<string>('');
  const [empaqueTipo, setEmpaqueTipo] = useState<string>('Saco');
  const [empaquesCantidad, setEmpaquesCantidad] = useState<number | ''>(1);
  const [contenidoPorEmpaque, setContenidoPorEmpaque] = useState<number | ''>(50);
  const [unidadBase, setUnidadBase] = useState<string>('kg');
  // Dedicated expenditure input requested by user: "¿Cuánto va a ser del insumo o cosa que se vaya a gastar?"
  const [costoTotal, setCostoTotal] = useState<number | ''>('');
  const [notasLinea, setNotasLinea] = useState<string>('');

  // Catalog Table State
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'ingredients' | 'packaging'>('all');
  const [editableCatalog, setEditableCatalog] = useState<IngredientItem[]>([]);
  const [showAddCatalogModal, setShowAddCatalogModal] = useState<boolean>(false);
  const [newCatalogItem, setNewCatalogItem] = useState<{
    name: string;
    isIngredient: boolean;
    costoGastoTotal: number | '';
    empaquesCantidad: number;
    contenidoPorEmpaque: number;
    provider: string;
    empaqueTipo: string;
    baseUnit: string;
  }>({
    name: '',
    isIngredient: true,
    costoGastoTotal: '',
    empaquesCantidad: 1,
    contenidoPorEmpaque: 50,
    provider: 'TASSA',
    empaqueTipo: 'Saco',
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
        if (items[0].provider) setProveedor(items[0].provider);
        if (items[0].isIngredient) {
          setIsIngredientType(true);
          setUnidadBase(items[0].baseUnit || 'kg');
          setEmpaqueTipo('Saco');
          setContenidoPorEmpaque(50);
        } else {
          setIsIngredientType(false);
          setUnidadBase(items[0].baseUnit || 'pz');
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

  // When selected item changes, adapt packaging defaults (without showing/asking for old cost)
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
        const tipoMatch = item.empaquePresentation.match(/\((.*?)\)/);
        if (tipoMatch && tipoMatch[1]) {
          setEmpaqueTipo(tipoMatch[1]);
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

  // Derived Calculations for CURRENT Line: "A partir de la compra y no al revés"
  const liveBreakdown = useMemo(() => {
    const qtyEmpaques = typeof empaquesCantidad === 'number' && empaquesCantidad > 0 ? empaquesCantidad : 0;
    const contEmpaque = typeof contenidoPorEmpaque === 'number' && contenidoPorEmpaque > 0 ? contenidoPorEmpaque : 0;
    const totalBase = qtyEmpaques * contEmpaque;
    const totalCostNum = typeof costoTotal === 'number' && costoTotal > 0 ? costoTotal : 0;

    const unitBaseCost = totalBase > 0 ? totalCostNum / totalBase : 0;
    const commercialEmpaqueCost = qtyEmpaques > 0 ? totalCostNum / qtyEmpaques : 0;

    const existingItem = ingredients.find(i => i.name.toLowerCase() === selectedItemName.trim().toLowerCase());
    const prevCost = existingItem ? (existingItem.unitCost || 0) : null;
    const diff = prevCost !== null && prevCost > 0 && unitBaseCost > 0 ? unitBaseCost - prevCost : null;
    const percentDiff = prevCost !== null && prevCost > 0 && unitBaseCost > 0 ? ((unitBaseCost - prevCost) / prevCost) * 100 : null;

    const presentationLabel = contEmpaque > 0 ? `${contEmpaque} ${unidadBase} (${empaqueTipo})` : `1 ${unidadBase}`;

    return {
      totalBase,
      unitBaseCost,
      commercialEmpaqueCost,
      presentationLabel,
      prevCost,
      diff,
      percentDiff
    };
  }, [empaquesCantidad, contenidoPorEmpaque, costoTotal, empaqueTipo, unidadBase, selectedItemName, ingredients]);

  // Invoice Summary (Totals across all accumulated lines)
  const invoiceSummary = useMemo(() => {
    const totalLines = invoiceLines.length;
    const totalCost = invoiceLines.reduce((acc, l) => acc + (l.costoTotal || 0), 0);
    return {
      totalLines,
      totalCost
    };
  }, [invoiceLines]);

  // Action: Add current product line to the Invoice Accumulator
  const handleAddLineToInvoice = () => {
    if (!selectedItemName.trim()) {
      setErrorMessage('Por favor selecciona o escribe el insumo para agregarlo a la factura.');
      return;
    }
    if (!costoTotal || Number(costoTotal) <= 0) {
      setErrorMessage('Por favor ingresa cuánto se va a gastar en este insumo.');
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

    const qty = Number(empaquesCantidad);
    const cont = Number(contenidoPorEmpaque);
    const totalBase = qty * cont;
    const gasto = Number(costoTotal);
    const costEmpaque = qty > 0 ? gasto / qty : 0;
    const costUnitBase = totalBase > 0 ? gasto / totalBase : 0;

    const newLine: InvoiceLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemNombre: selectedItemName.trim(),
      isIngredient: isIngredientType,
      empaqueTipo,
      empaquesCantidad: qty,
      contenidoPorEmpaque: cont,
      unidadBase,
      totalUnidadesBase: totalBase,
      costoTotal: gasto,
      costoPorEmpaque: Number(costEmpaque.toFixed(2)),
      costoUnitarioBase: Number(costUnitBase.toFixed(4)),
      notas: notasLinea.trim()
    };

    setInvoiceLines(prev => [...prev, newLine]);
    setCostoTotal('');
    setNotasLinea('');
    setErrorMessage(null);
    setSuccessMessage(`✓ Línea "${newLine.itemNombre}" ($${gasto.toFixed(2)} MXN) agregada a la factura.`);
  };

  // Action: Remove a line from the Invoice Accumulator
  const handleRemoveLine = (id: string) => {
    setInvoiceLines(prev => prev.filter(l => l.id !== id));
  };

  // Action: Clear all accumulated lines
  const handleClearInvoice = () => {
    if (invoiceLines.length > 0 && !window.confirm('¿Deseas vaciar todas las líneas acumuladas de esta factura?')) return;
    setInvoiceLines([]);
    setCostoTotal('');
    setNotasLinea('');
  };

  // Submit the Entire Invoice with all its accumulated lines to Server and Google Sheets
  const handleSubmitEntireInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    // If there are no lines in the table, check if the user filled in the line form and auto-add it
    let linesToSubmit = [...invoiceLines];
    if (selectedItemName.trim() && costoTotal && Number(costoTotal) > 0) {
      const qty = Number(empaquesCantidad) || 1;
      const cont = Number(contenidoPorEmpaque) || 1;
      const totalBase = qty * cont;
      const gasto = Number(costoTotal);
      const costEmpaque = qty > 0 ? gasto / qty : 0;
      const costUnitBase = totalBase > 0 ? gasto / totalBase : 0;

      const currentLine: InvoiceLine = {
        id: `line-${Date.now()}`,
        itemNombre: selectedItemName.trim(),
        isIngredient: isIngredientType,
        empaqueTipo,
        empaquesCantidad: qty,
        contenidoPorEmpaque: cont,
        unidadBase,
        totalUnidadesBase: totalBase,
        costoTotal: gasto,
        costoPorEmpaque: Number(costEmpaque.toFixed(2)),
        costoUnitarioBase: Number(costUnitBase.toFixed(4)),
        notas: notasLinea.trim()
      };
      linesToSubmit.push(currentLine);
    }

    if (linesToSubmit.length === 0) {
      setErrorMessage('Debes agregar al menos una línea de producto antes de registrar la factura.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = {
        fechaCompra,
        folio: folio.trim(),
        proveedor: proveedor.trim() || 'General',
        notas: notasFactura.trim(),
        lines: linesToSubmit.map(l => ({
          itemNombre: l.itemNombre,
          isIngredient: l.isIngredient,
          empaqueTipo: l.empaqueTipo,
          empaquesCantidad: l.empaquesCantidad,
          contenidoPorEmpaque: l.contenidoPorEmpaque,
          unidadBase: l.unidadBase,
          costoTotal: l.costoTotal,
          notas: l.notas
        }))
      };

      const res = await apiFetch('/api/production/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || `¡Factura registrada con éxito (${linesToSubmit.length} líneas) y Google Sheets actualizado!`);
        setInvoiceLines([]);
        setCostoTotal('');
        setFolio('');
        setNotasLinea('');
        setNotasFactura('');
        await loadData();
      } else {
        setErrorMessage(data.message || 'Error al registrar la factura.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Save modified catalog directly to Google Sheets Costos tab
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
        setSuccessMessage(`¡Catálogo de ${data.count || editableCatalog.length} insumos y empaques sincronizado en Google Sheets (Hoja Costos)!`);
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

  // Add new item modal submit (Calculated from expenditure)
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

    const gastoTotal = Number(newCatalogItem.costoGastoTotal) || 0;
    const empaques = Number(newCatalogItem.empaquesCantidad) || 1;
    const cont = Number(newCatalogItem.contenidoPorEmpaque) || 1;
    const totalUnidades = empaques * cont;

    const empaqueCost = empaques > 0 ? gastoTotal / empaques : 0;
    const unitCost = totalUnidades > 0 ? gastoTotal / totalUnidades : 0;
    const presentationStr = `${cont} ${newCatalogItem.baseUnit} (${newCatalogItem.empaqueTipo})`;

    const item: IngredientItem = {
      name: newCatalogItem.name.trim(),
      unitCost: Number(unitCost.toFixed(4)),
      isIngredient: newCatalogItem.isIngredient,
      applicableCategories: [],
      provider: newCatalogItem.provider.trim() || 'General',
      empaquePresentation: presentationStr,
      empaqueCost: Number(empaqueCost.toFixed(2)),
      baseUnit: newCatalogItem.baseUnit
    };

    setEditableCatalog(prev => [item, ...prev]);
    setShowAddCatalogModal(false);
    setSelectedItemName(item.name);
    setIsIngredientType(item.isIngredient);
    setProveedor(item.provider || 'General');
    setUnidadBase(item.baseUnit || (item.isIngredient ? 'kg' : 'pz'));
    setEmpaqueTipo(newCatalogItem.empaqueTipo);
    setContenidoPorEmpaque(cont);
    setEmpaquesCantidad(empaques);
    if (gastoTotal > 0) {
      setCostoTotal(gastoTotal);
    }

    setNewCatalogItem({
      name: '',
      isIngredient: true,
      costoGastoTotal: '',
      empaquesCantidad: 1,
      contenidoPorEmpaque: 50,
      provider: 'TASSA',
      empaqueTipo: 'Saco',
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
              Captura de facturas multi-línea con desglose automático de costo por empaque y unidad base
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
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
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
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
          <ListPlus className="w-4 h-4" />
          <span>1. Factura Multi-Línea ({invoiceLines.length} en proceso)</span>
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
          <span>2. Hoja Costos en Google Sheets ({ingredients.length})</span>
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
      {/* TAB 1: REGISTRAR COMPRA MULTI-LÍNEA POR FACTURA */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          {/* HEADER DE LA FACTURA: Proveedor, Folio y Fecha */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Encabezado de la Factura / Remisión
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                  {invoiceLines.length} línea{invoiceLines.length === 1 ? '' : 's'} acumulada{invoiceLines.length === 1 ? '' : 's'}
                </span>
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                  Total Factura: ${invoiceSummary.totalCost.toFixed(2)} MXN
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha de Factura / Compra</label>
                <input
                  type="date"
                  required
                  value={fechaCompra}
                  onChange={e => setFechaCompra(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Proveedor General de la Factura</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. TASSA, Suintar, etc."
                  value={proveedor}
                  onChange={e => setProveedor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Folio / No. Factura o Remisión</label>
                <input
                  type="text"
                  placeholder="Ej. F-10482 o REM-982"
                  value={folio}
                  onChange={e => setFolio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Notas de la Factura (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Compra mensual con descuento"
                  value={notasFactura}
                  onChange={e => setNotasFactura(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* FORMULARIO DE CAPTURA DE LÍNEA Y TARJETA EN VIVO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Form Input for the current line */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  Agregar Producto o Insumo a la Factura
                </h3>
                <span className="text-xs text-slate-400 font-medium">Captura línea por línea</span>
              </div>

              {/* Type Switcher */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  Tipo de Insumo o Material
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

              {/* Item Selection (Without showing "Costo actual") */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Insumo o Empaque de esta Línea</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCatalogModal(true)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> + Crear Nuevo Insumo
                  </button>
                </div>
                <select
                  value={selectedItemName}
                  onChange={e => handleItemSelect(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="">-- Selecciona el insumo o empaque --</option>
                  <optgroup label="Materias Primas / Ingredientes">
                    {ingredients
                      .filter(i => i.isIngredient)
                      .map(i => (
                        <option key={i.name} value={i.name}>
                          {i.name} {i.empaquePresentation ? `[${i.empaquePresentation}]` : ''} - {i.provider || 'TASSA'}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Empaques y Etiquetas">
                    {ingredients
                      .filter(i => !i.isIngredient)
                      .map(i => (
                        <option key={i.name} value={i.name}>
                          {i.name} {i.empaquePresentation ? `[${i.empaquePresentation}]` : ''} - {i.provider || 'Suintar'}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* DEDICATED PROMINENT EXPENDITURE INPUT: "¿Cuánto va a ser del insumo o cosa que se vaya a gastar?" */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500/40 rounded-2xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-emerald-950 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-emerald-600" />
                    ¿Cuánto va a ser de esta línea que se vaya a gastar?
                  </label>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Gasto de la Línea ($ MXN)
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Ingresa el importe de esta partida en la factura. El costo por empaque y por unidad base se calcularán automáticamente a partir de este monto.
                </p>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-3 text-emerald-700 font-black text-2xl">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={costoTotal}
                    onChange={e => setCostoTotal(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-emerald-500 rounded-xl text-2xl font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-sm"
                  />
                </div>
              </div>

              {/* Commercial Packaging Breakdown Fields */}
              <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    Presentación de esta línea
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Empaque de entrega
                  </span>
                </div>

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
                      <option value="Pieza">Pieza / Paquete</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Cant. Empaques Recibidos
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder="Ej. 2"
                      value={empaquesCantidad}
                      onChange={e => setEmpaquesCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900"
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
                      placeholder="Ej. 50"
                      value={contenidoPorEmpaque}
                      onChange={e => setContenidoPorEmpaque(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                    />
                  </div>
                </div>

                {/* Base Unit Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Unidad Base de Producción
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

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Notas de esta Línea (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Descuento por volumen o cambio de lote"
                  value={notasLinea}
                  onChange={e => setNotasLinea(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              {/* Botón: Agregar Línea a la Factura */}
              <button
                type="button"
                onClick={handleAddLineToInvoice}
                disabled={!selectedItemName || !costoTotal || Number(costoTotal) <= 0}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusCircle className="w-5 h-5" />
                <span>+ Agregar Línea a la Factura</span>
              </button>
            </div>

            {/* Right 5 Columns: Live Converted Breakdown Card for current line */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-5 border border-emerald-600/30">
                <div className="flex items-center justify-between border-b border-white/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-emerald-300" />
                    <h3 className="font-bold text-sm tracking-wide">Cálculo Derivado de la Línea</h3>
                  </div>
                  <span className="text-[10px] uppercase font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                    A Partir del Gasto
                  </span>
                </div>

                {/* Primary Calculated KPIs */}
                <div className="grid grid-cols-1 gap-3">
                  {/* Costo por Unidad Base */}
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                    <span className="text-xs text-emerald-200 font-bold block mb-1 uppercase tracking-wider">
                      Costo por Unidad Base ($ / {unidadBase})
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-white">
                        ${liveBreakdown.unitBaseCost > 0 ? liveBreakdown.unitBaseCost.toFixed(4) : '0.0000'}
                      </span>
                      <span className="text-xs text-emerald-300 font-bold uppercase">
                        MXN por {unidadBase}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-100/90 mt-1">
                      Fórmula: Gasto ${Number(costoTotal || 0).toFixed(2)} ÷ {liveBreakdown.totalBase.toLocaleString()} {unidadBase} totales
                    </p>
                  </div>

                  {/* Costo por Empaque y Unidades Totales */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 p-3.5 rounded-xl border border-white/15">
                      <span className="text-[11px] text-emerald-200 font-semibold block mb-0.5">
                        Costo por Empaque
                      </span>
                      <span className="text-xl font-black text-white">
                        ${liveBreakdown.commercialEmpaqueCost.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-200/80 block mt-0.5">
                        por cada {empaqueTipo}
                      </span>
                    </div>

                    <div className="bg-white/10 p-3.5 rounded-xl border border-white/15">
                      <span className="text-[11px] text-emerald-200 font-semibold block mb-0.5">
                        Total Unidades Base
                      </span>
                      <span className="text-xl font-black text-white">
                        {liveBreakdown.totalBase.toLocaleString()} {unidadBase}
                      </span>
                      <span className="text-[10px] text-emerald-200/80 block mt-0.5">
                        ({empaquesCantidad || 0} × {contenidoPorEmpaque || 0} {unidadBase})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Preview: How it will overwrite Google Sheets 'Costos' tab */}
                <div className="bg-black/30 p-4 rounded-xl border border-white/15 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300 border-b border-white/10 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Vista Previa Google Sheets (Fila de esta Línea)
                    </span>
                    <span className="text-[10px] text-slate-300">Hoja Costos</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead>
                        <tr className="text-slate-400 border-b border-white/10">
                          <th className="py-1">Col A: Ingrediente</th>
                          <th className="py-1">Col B: Empaque</th>
                          <th className="py-1 text-right">Col C: Costo Empaque</th>
                          <th className="py-1 text-right">Col D: Costo Base</th>
                          <th className="py-1 text-right">Col E: Prov</th>
                        </tr>
                      </thead>
                      <tbody className="font-semibold text-white">
                        <tr>
                          <td className="py-1 text-emerald-200">{selectedItemName || 'Insumo'}</td>
                          <td className="py-1 text-slate-300">{liveBreakdown.presentationLabel}</td>
                          <td className="py-1 text-right text-emerald-300 font-bold">
                            ${liveBreakdown.commercialEmpaqueCost.toFixed(2)}
                          </td>
                          <td className="py-1 text-right text-cyan-300 font-black">
                            ${liveBreakdown.unitBaseCost > 0 ? liveBreakdown.unitBaseCost.toFixed(4) : '0.00'}
                          </td>
                          <td className="py-1 text-right text-slate-300">{proveedor || 'TASSA'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[10px] text-emerald-200/80 pt-1 border-t border-white/10">
                    ✓ Al guardar la factura completa, se actualizarán todas las líneas en Google Sheets en un solo paso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TABLA DE LÍNEAS ACUMULADAS EN ESTA FACTURA */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Líneas Acumuladas en esta Factura ({invoiceLines.length})
                </h3>
              </div>

              {invoiceLines.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearInvoice}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Vaciar Líneas
                </button>
              )}
            </div>

            {invoiceLines.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <ListPlus className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Aún no hay líneas agregadas a esta factura</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Selecciona un insumo arriba, indica cuánto se va a gastar y la cantidad de empaques, luego presiona <strong>"+ Agregar Línea a la Factura"</strong> para ir acumulándolas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Insumo / Material</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Presentación Comprada</th>
                      <th className="p-3 text-right">Total Base</th>
                      <th className="p-3 text-right">Costo x Empaque</th>
                      <th className="p-3 text-right">Costo Unit. Base</th>
                      <th className="p-3 text-right">Gasto de la Línea</th>
                      <th className="p-3 text-center w-16">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {invoiceLines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{line.itemNombre}</td>
                        <td className="p-3">
                          {line.isIngredient ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Materia Prima
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Empaque
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">
                          {line.empaquesCantidad} {line.empaqueTipo}s de {line.contenidoPorEmpaque} {line.unidadBase}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800">
                          {line.totalUnidadesBase.toLocaleString()} {line.unidadBase}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          ${line.costoPorEmpaque.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-black text-blue-700">
                          ${line.costoUnitarioBase.toFixed(4)} / {line.unidadBase}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700 text-sm">
                          ${line.costoTotal.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                            title="Quitar esta línea de la factura"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={7} className="p-3.5 text-right font-black text-slate-900 text-sm">
                        TOTAL DE LA FACTURA ({invoiceLines.length} líneas):
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-800 text-base">
                        ${invoiceSummary.totalCost.toFixed(2)} MXN
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* BOTÓN DE GUARDADO DEFINITIVO DE LA FACTURA */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Al guardar, todas las líneas se añadirán al historial de compras y se sobrescribirá la pestaña <code>Costos</code> en Google Sheets.
              </div>

              <button
                type="button"
                onClick={handleSubmitEntireInvoice}
                disabled={submitting || (invoiceLines.length === 0 && (!selectedItemName || !costoTotal))}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className={`w-5 h-5 ${submitting ? 'animate-spin' : ''}`} />
                <span>
                  {submitting
                    ? 'Sincronizando Factura con Google Sheets...'
                    : `Guardar Factura Completa (${invoiceLines.length > 0 ? invoiceLines.length : (selectedItemName && costoTotal ? 1 : 0)} Líneas) en Google Sheets`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INVENTARIO Y CATÁLOGO BASE (HOJA COSTOS) */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Catálogo Maestro y Hoja "Costos" de Google Sheets</h3>
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {editableCatalog.length} Items Registrados
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Reflejo directo de la pestaña <code>Costos</code> de Google Sheets. Muestra el Costo por Empaque (Col C) y el Costo por Unidad Base (Col D). Puedes editarlos directamente o a través de facturas de compra.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCatalogModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nuevo Insumo / Empaque</span>
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
                    <th className="p-3.5">Col A: Insumo / Empaque</th>
                    <th className="p-3.5">Tipo</th>
                    <th className="p-3.5">Unidad Base</th>
                    <th className="p-3.5">Col B: Presentación Empaque</th>
                    <th className="p-3.5">Col E: Proveedor</th>
                    <th className="p-3.5 text-right w-40">Col C: Costo Empaque ($)</th>
                    <th className="p-3.5 text-right w-44">Col D: Costo Unidad Base ($)</th>
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
                            step="0.01"
                            min="0"
                            value={item.empaqueCost || ''}
                            onChange={e => {
                              const empaqueVal = parseFloat(e.target.value) || 0;
                              // Auto calculate unitCost if presentation has numbers
                              const numMatch = (item.empaquePresentation || '').match(/(\d+(?:\.\d+)?)/);
                              const cont = numMatch ? parseFloat(numMatch[1]) : 1;
                              const newUnit = cont > 0 ? empaqueVal / cont : empaqueVal;
                              setEditableCatalog(prev =>
                                prev.map(i =>
                                  i.name === item.name
                                    ? { ...i, empaqueCost: empaqueVal, unitCost: Number(newUnit.toFixed(4)) }
                                    : i
                                )
                              );
                            }}
                            className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </td>
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
                              const numMatch = (item.empaquePresentation || '').match(/(\d+(?:\.\d+)?)/);
                              const cont = numMatch ? parseFloat(numMatch[1]) : 1;
                              const newEmpaque = val * cont;
                              setEditableCatalog(prev =>
                                prev.map(i =>
                                  i.name === item.name
                                    ? { ...i, unitCost: val, empaqueCost: Number(newEmpaque.toFixed(2)) }
                                    : i
                                )
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
                      <td colSpan={8} className="p-8 text-center text-slate-400">
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
                    <th className="p-3.5 text-right">Gasto de la Línea</th>
                    <th className="p-3.5 text-right">Costo Empaque</th>
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
                      <td className="p-3.5 text-right font-semibold text-slate-800">
                        ${(p.costoPorEmpaque || (p.costoTotal / (p.empaquesCantidad || 1))).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-black text-blue-700">
                        ${p.costoUnitarioBase.toFixed(4)} / {p.unidadBase}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px] truncate max-w-xs">{p.notas || '---'}</td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
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

      {/* Modal: Add New Item to Master Catalog (Derived from expenditure) */}
      {showAddCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                Agregar Nuevo Insumo o Empaque
              </h4>
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
                        baseUnit: isIng ? 'kg' : 'pz',
                        empaqueTipo: isIng ? 'Saco' : 'Caja',
                        contenidoPorEmpaque: isIng ? 50 : 1000
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

              {/* Expenditure Input in Modal */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <label className="text-xs font-bold text-emerald-900 block">
                  ¿Cuánto se gasta en esta compra o presentación? ($ MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-emerald-700 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Ej. 840.00"
                    value={newCatalogItem.costoGastoTotal}
                    onChange={e =>
                      setNewCatalogItem({
                        ...newCatalogItem,
                        costoGastoTotal: e.target.value === '' ? '' : parseFloat(e.target.value)
                      })
                    }
                    className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Empaque</label>
                  <select
                    value={newCatalogItem.empaqueTipo}
                    onChange={e => setNewCatalogItem({ ...newCatalogItem, empaqueTipo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="Saco">Saco</option>
                    <option value="Caja">Caja</option>
                    <option value="Tambo">Tambo</option>
                    <option value="Garrafa">Garrafa</option>
                    <option value="Cubeta">Cubeta</option>
                    <option value="Pieza">Pieza</option>
                    <option value="Rollo">Rollo</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Contenido por Empaque ({newCatalogItem.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    value={newCatalogItem.contenidoPorEmpaque}
                    onChange={e =>
                      setNewCatalogItem({
                        ...newCatalogItem,
                        contenidoPorEmpaque: parseFloat(e.target.value) || 1
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
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

              {/* Live derivation summary in modal */}
              {Number(newCatalogItem.costoGastoTotal) > 0 && (
                <div className="p-2.5 bg-slate-100 rounded-xl text-xs text-slate-700 flex justify-between items-center">
                  <span>Costo derivado por {newCatalogItem.baseUnit}:</span>
                  <span className="font-black text-emerald-700">
                    ${(
                      Number(newCatalogItem.costoGastoTotal) /
                      ((Number(newCatalogItem.empaquesCantidad) || 1) * (Number(newCatalogItem.contenidoPorEmpaque) || 1))
                    ).toFixed(4)} / {newCatalogItem.baseUnit}
                  </span>
                </div>
              )}

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
