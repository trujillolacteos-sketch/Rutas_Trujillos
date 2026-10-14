import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import {
  Factory,
  Package,
  Layers,
  Database,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Info,
  DollarSign,
  Coins,
  Save,
  Filter,
  X
} from 'lucide-react';
import { AppState } from '../types';

interface ProductionConfig {
  categories: string[];
  ingredients: {
    name: string;
    unitCost: number;
    isIngredient: boolean;
    applicableCategories: string[];
    provider: string;
  }[];
  skus: {
    product: string;
    category: string;
    adicionales: string[];
    empaques: string[];
    etiqueta: string;
  }[];
}

interface LotOption {
  lote: string;
  categoria: string;
  fechaProduccion: string;
  kgTotal: number;
  kgEmpacados: number;
  kgDisponible: number;
  costoPorKg: number;
  costoTotal: number;
  display: string;
}

export default function ProductionView({
  role,
  user,
  state,
  canManageCosts
}: {
  role?: string;
  user?: { username: string; role: string };
  state: AppState;
  canManageCosts?: boolean;
}) {
  const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit?usp=sharing';
  const todayStr = new Date().toISOString().slice(0, 10);
  const canEditCosts = canManageCosts ?? (role === 'admin' || role === 'gerencia' || role === 'supervisor_produccion');

  // Active Sub-Tab
  const [subTab, setSubTab] = useState<'production' | 'packaging' | 'history' | 'inventory' | 'costs'>('production');

  // Master Configuration
  const [config, setConfig] = useState<ProductionConfig>({ categories: [], ingredients: [], skus: [] });
  const [availableLots, setAvailableLots] = useState<LotOption[]>([]);
  const [historyData, setHistoryData] = useState<{ production: any[]; packaging: any[] }>({ production: [], packaging: [] });
  const [odooInventory, setOdooInventory] = useState<any[]>([]);
  
  // Loading & Feedback
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // ==========================================
  // TAB 1: PRODUCTION BATCH STATE
  // ==========================================
  const [prodDate, setProdDate] = useState<string>(todayStr);
  const [prodCategory, setProdCategory] = useState<string>('');
  const [prodKgTotal, setProdKgTotal] = useState<number | ''>('');
  const [prodIngredients, setProdIngredients] = useState<
    { id: string; name: string; quantity: number | ''; unitCost: number }[]
  >([]);
  const [cremaNaturalKg, setCremaNaturalKg] = useState<number | ''>('');
  const [searchIngredientQuery, setSearchIngredientQuery] = useState('');

  // ==========================================
  // TAB 2: PACKAGING BATCH STATE
  // ==========================================
  const [packLote, setPackLote] = useState<string>('');
  const [packDate, setPackDate] = useState<string>(todayStr);
  const [packItems, setPackItems] = useState<
    {
      id: string;
      product: string;
      display: string;
      peso: number;
      piezas: number | '';
      adicionales: string[];
      empaques: string[];
      etiqueta: string;
    }[]
  >([]);
  const [packAdicionalesKg, setPackAdicionalesKg] = useState<Record<string, number>>({});

  // ==========================================
  // TAB 3 & 4 FILTERS
  // ==========================================
  const [historySearch, setHistorySearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');

  // ==========================================
  // TAB 5: COSTS & PACKAGING CATALOG STATE
  // ==========================================
  const [editableIngredients, setEditableIngredients] = useState<any[]>([]);
  const [costSearch, setCostSearch] = useState('');
  const [costFilter, setCostFilter] = useState<'all' | 'ingredients' | 'packaging'>('all');
  const [savingCosts, setSavingCosts] = useState(false);
  const [showAddCostModal, setShowAddCostModal] = useState(false);
  const [newCostItem, setNewCostItem] = useState({
    name: '',
    unitCost: 0,
    isIngredient: true,
    provider: 'General',
    empaquePresentation: '1'
  });

  // Fetch initial master data
  const loadMasterConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await apiFetch('/api/production/config');
      const data = await res.json();
      setConfig(data);
      setEditableIngredients(data.ingredients || []);
      if (data.categories && data.categories.length > 0 && !prodCategory) {
        setProdCategory(data.categories[0]);
      }
    } catch (e: any) {
      console.error('Error cargando configuración:', e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveCosts = async () => {
    try {
      setSavingCosts(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await apiFetch('/api/production/config/update-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: editableIngredients })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`¡Catálogo de ${data.count || editableIngredients.length} costos actualizado con éxito y sincronizado en Google Sheets!`);
        await loadMasterConfig();
      } else {
        setErrorMessage(data.message || 'Error al actualizar catálogo de costos.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión.');
    } finally {
      setSavingCosts(false);
    }
  };

  const handleAddNewCostItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCostItem.name.trim()) return;
    const exists = editableIngredients.some(i => i.name.toLowerCase() === newCostItem.name.trim().toLowerCase());
    if (exists) {
      alert('Ya existe un insumo o empaque con este nombre en el catálogo.');
      return;
    }
    const itemToAdd = {
      name: newCostItem.name.trim(),
      unitCost: Number(newCostItem.unitCost) || 0,
      isIngredient: newCostItem.isIngredient,
      applicableCategories: [],
      provider: newCostItem.provider || 'General',
      empaquePresentation: newCostItem.empaquePresentation || '1'
    };
    setEditableIngredients(prev => [itemToAdd, ...prev]);
    setShowAddCostModal(false);
    setNewCostItem({
      name: '',
      unitCost: 0,
      isIngredient: true,
      provider: 'General',
      empaquePresentation: '1'
    });
  };

  const handleDeleteCostItem = (name: string) => {
    if (!window.confirm(`¿Estás seguro de quitar "${name}" del catálogo?`)) return;
    setEditableIngredients(prev => prev.filter(i => i.name !== name));
  };

  const loadLots = async () => {
    try {
      const res = await apiFetch('/api/production/lots');
      const data = await res.json();
      setAvailableLots(data || []);
    } catch (e: any) {
      console.error('Error cargando lotes:', e);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await apiFetch('/api/production/history');
      const data = await res.json();
      setHistoryData(data || { production: [], packaging: [] });
    } catch (e: any) {
      console.error('Error cargando historial:', e);
    }
  };

  const loadInventory = async () => {
    try {
      setLoadingInventory(true);
      const res = await apiFetch('/api/production/inventory');
      const data = await res.json();
      setOdooInventory(data || []);
    } catch (e: any) {
      console.error('Error cargando inventario Odoo:', e);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    loadMasterConfig();
    loadLots();
    loadHistory();
  }, []);

  useEffect(() => {
    if (subTab === 'inventory' && odooInventory.length === 0) {
      loadInventory();
    }
    if (subTab === 'packaging' || subTab === 'history') {
      loadLots();
      loadHistory();
    }
  }, [subTab]);

  // Map of unit costs
  const costMap = useMemo(() => {
    const map: Record<string, number> = {};
    (config.ingredients || []).forEach(ing => {
      map[ing.name] = ing.unitCost || 0;
    });
    return map;
  }, [config.ingredients]);

  // When production category changes, populate default applicable ingredients
  useEffect(() => {
    if (!prodCategory || !config.ingredients) return;
    const applicable = config.ingredients.filter(ing => {
      if (!ing.applicableCategories || ing.applicableCategories.length === 0) return false;
      return ing.applicableCategories.some(cat => 
        cat.toLowerCase() === prodCategory.toLowerCase() ||
        prodCategory.toLowerCase().includes(cat.toLowerCase())
      );
    });

    setProdIngredients(
      applicable.map((ing, idx) => ({
        id: `${ing.name}-${idx}`,
        name: ing.name,
        quantity: '',
        unitCost: ing.unitCost
      }))
    );
  }, [prodCategory, config.ingredients]);

  // Parse default weight from SKU product string (e.g. "1 kg" -> 1.0, "500 g" -> 0.5, "250 gr" -> 0.25)
  const parseWeightFromTitle = (title: string): number => {
    const lower = title.toLowerCase();
    const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/);
    if (kgMatch) return parseFloat(kgMatch[1]);

    const gMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos?)/);
    if (gMatch) return parseFloat(gMatch[1]) / 1000;

    const lMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litro?s?)/);
    if (lMatch) return parseFloat(lMatch[1]);

    const mlMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ml|mililitros?)/);
    if (mlMatch) return parseFloat(mlMatch[1]) / 1000;

    return 1.0;
  };

  // ==========================================
  // TAB 1: PRODUCTION CALCULATIONS
  // ==========================================
  const calculatedProdSummary = useMemo(() => {
    let rawTotalCost = 0;
    let totalKgInsumos = 0;
    let costoLeche = 0;
    let kgLeche = 0;

    prodIngredients.forEach(item => {
      const q = typeof item.quantity === 'number' ? item.quantity : 0;
      const c = q * (item.unitCost || 0);
      rawTotalCost += c;
      totalKgInsumos += q;

      const lower = item.name.toLowerCase();
      if (['leche entera', 'leche pipa', 'leche descremada', 'leche en polvo'].includes(lower)) {
        costoLeche += c;
        kgLeche += q;
      }
    });

    // Ajuste Crema Natural
    let ajusteCrema = 0;
    const cremaKg = typeof cremaNaturalKg === 'number' ? cremaNaturalKg : 0;
    if (cremaKg > 0) {
      const costoUnitCrema = costMap['Crema natural'] || costMap['Crema natural compra'] || 55;
      ajusteCrema = cremaKg * costoUnitCrema;
      if (costoLeche > 0 && kgLeche > 0) {
        const costoKgLeche = costoLeche / kgLeche;
        ajusteCrema = Math.max(0, ajusteCrema - (cremaKg * costoKgLeche));
      }
    }

    // Mozzarella discount logic
    const isMozzarella = prodCategory.toLowerCase().includes('mozzarella');
    let descuentoMozzarella = 0;
    if (isMozzarella && rawTotalCost > 0) {
      descuentoMozzarella = rawTotalCost * 0.15;
    }

    const netCost = Math.max(0, rawTotalCost - ajusteCrema - descuentoMozzarella);
    const kgFinal = typeof prodKgTotal === 'number' && prodKgTotal > 0 ? prodKgTotal : 0;
    const costPerKg = kgFinal > 0 ? netCost / kgFinal : 0;

    return {
      rawTotalCost,
      ajusteCrema,
      descuentoMozzarella,
      netCost,
      kgFinal,
      costPerKg,
      totalKgInsumos
    };
  }, [prodIngredients, cremaNaturalKg, prodKgTotal, prodCategory, costMap]);

  // Dynamic Batch Code Preview
  const previewLotCode = useMemo(() => {
    if (!prodCategory || !prodDate) return '---';
    const base = prodCategory
      .replace(/All\s*\/\s*Quesos\s*\/\s*/i, '')
      .replace(/All\s*\/\s*/i, '')
      .replace(/All\//i, '')
      .substring(0, 4)
      .toLowerCase();

    const parts = prodDate.split('-');
    if (parts.length < 3) return '---';
    const day = parts[2];
    const month = parts[1];
    const year = parts[0].slice(-2);
    return `${base}${day}${month}${year}-01`;
  }, [prodCategory, prodDate]);

  // Handle Save Production Batch
  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const kg = typeof prodKgTotal === 'number' ? prodKgTotal : 0;
    if (kg <= 0) {
      setErrorMessage('Por favor ingresa un Kilogramo total producido válido (> 0).');
      return;
    }

    const validInsumos = prodIngredients
      .filter(i => typeof i.quantity === 'number' && i.quantity > 0)
      .map(i => ({
        nombre: i.name,
        cantidad: Number(i.quantity)
      }));

    if (validInsumos.length === 0) {
      setErrorMessage('Debes registrar la cantidad consumida de al menos 1 insumo.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/production/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaProduccion: prodDate,
          categoria: prodCategory,
          kgTotal: kg,
          insumos: validInsumos
        })
      });

      const result = await res.json();
      if (result.success) {
        setSuccessMessage(`¡Lote ${result.lote} registrado y sincronizado en Google Sheet exitosamente!`);
        // Reset form
        setProdKgTotal('');
        setCremaNaturalKg('');
        loadLots();
        loadHistory();
      } else {
        setErrorMessage(result.message || 'Error al guardar lote de producción.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // TAB 2: PACKAGING CALCULATIONS
  // ==========================================
  const selectedLotInfo = useMemo(() => {
    return availableLots.find(l => l.lote === packLote);
  }, [availableLots, packLote]);

  // SKUs filtered for selected lot's category
  const filteredSkus = useMemo(() => {
    if (!selectedLotInfo) return config.skus || [];
    const catClean = selectedLotInfo.categoria
      .replace(/All\s*\/\s*Quesos\s*\/\s*/i, '')
      .replace(/All\s*\/\s*/i, '')
      .toLowerCase();

    return (config.skus || []).filter(s => {
      const pCat = (s.category || '').toLowerCase();
      const pName = (s.product || '').toLowerCase();
      return pCat.includes(catClean) || pName.includes(catClean);
    });
  }, [config.skus, selectedLotInfo]);

  // When lot selected, set default SKU line if empty
  useEffect(() => {
    if (selectedLotInfo && packItems.length === 0 && filteredSkus.length > 0) {
      const firstSku = filteredSkus[0];
      const defaultPeso = parseWeightFromTitle(firstSku.product);
      setPackItems([
        {
          id: `item-${Date.now()}`,
          product: firstSku.product,
          display: firstSku.product,
          peso: defaultPeso,
          piezas: '',
          adicionales: firstSku.adicionales || [],
          empaques: firstSku.empaques || [],
          etiqueta: firstSku.etiqueta || ''
        }
      ]);
    }
  }, [selectedLotInfo, filteredSkus]);

  // Calculate packaging lines and yields
  const calculatedPackagingSummary = useMemo(() => {
    if (!selectedLotInfo) {
      return { totalKgCapturados: 0, aprovechamiento: 0, itemsSummary: [], balanceKg: 0 };
    }

    const costPerKg = selectedLotInfo.costoPorKg || 0;
    let totalKgCapturados = 0;

    // First pass: sum kg per adicional
    const totalKgPorAdicional: Record<string, number> = {};
    packItems.forEach(item => {
      const pz = typeof item.piezas === 'number' ? item.piezas : 0;
      const kg = pz * (item.peso || 0);
      (item.adicionales || []).forEach(ad => {
        if (!totalKgPorAdicional[ad]) totalKgPorAdicional[ad] = 0;
        totalKgPorAdicional[ad] += kg;
      });
    });

    const itemsSummary = packItems.map(item => {
      const pz = typeof item.piezas === 'number' ? item.piezas : 0;
      const kg = pz * (item.peso || 0);
      totalKgCapturados += kg;

      const costoBase = kg * costPerKg;

      // Empaque
      let costoEmpaque = 0;
      (item.empaques || []).forEach(emp => {
        costoEmpaque += (costMap[emp] || 0) * pz;
      });

      // Etiqueta
      const costoEtiqueta = (costMap[item.etiqueta] || 0) * pz;

      // Adicionales
      let costoAdicional = 0;
      (item.adicionales || []).forEach(ad => {
        const adTotalKg = packAdicionalesKg[ad] || 0;
        const adCostoKg = costMap[ad] || 0;
        const groupKg = totalKgPorAdicional[ad] || 0;
        if (groupKg > 0) {
          const prop = kg / groupKg;
          costoAdicional += (adTotalKg * prop) * adCostoKg;
        }
      });

      const costoTotal = costoBase + costoEmpaque + costoEtiqueta + costoAdicional;
      const costoPieza = pz > 0 ? costoTotal / pz : 0;
      const aprovechamientoLinea = selectedLotInfo.kgTotal > 0 ? (kg / selectedLotInfo.kgTotal) * 100 : 0;

      return {
        ...item,
        kg,
        costoBase,
        costoEmpaque,
        costoEtiqueta,
        costoAdicional,
        costoTotal,
        costoPieza,
        aprovechamientoLinea
      };
    });

    const aprovechamiento = selectedLotInfo.kgTotal > 0 ? (totalKgCapturados / selectedLotInfo.kgTotal) * 100 : 0;
    const balanceKg = selectedLotInfo.kgDisponible - totalKgCapturados;

    return {
      totalKgCapturados,
      aprovechamiento,
      itemsSummary,
      balanceKg
    };
  }, [selectedLotInfo, packItems, packAdicionalesKg, costMap]);

  // Handle Save Packaging Batch
  const handleSavePackaging = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedLotInfo) {
      setErrorMessage('Por favor selecciona un lote disponible.');
      return;
    }

    const validItems = packItems.filter(i => typeof i.piezas === 'number' && i.piezas > 0);
    if (validItems.length === 0) {
      setErrorMessage('Debes registrar al menos una presentación con piezas mayor a 0.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/production/packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaProduccion: selectedLotInfo.fechaProduccion,
          fechaEmpaque: packDate,
          categoria: selectedLotInfo.categoria,
          lote: selectedLotInfo.lote,
          productos: validItems.map(i => ({
            producto: i.product,
            display: i.display,
            peso: i.peso,
            piezas: Number(i.piezas),
            adicionales: i.adicionales,
            empaques: i.empaques,
            etiqueta: i.etiqueta
          })),
          adicionalesKg: packAdicionalesKg
        })
      });

      const result = await res.json();
      if (result.success) {
        setSuccessMessage(`¡Empaque de ${selectedLotInfo.lote} registrado y sincronizado en Google Sheet con éxito! Aprovechamiento: ${result.aprovechamiento.toFixed(1)}%`);
        // Reset items
        setPackItems([]);
        setPackLote('');
        loadLots();
        loadHistory();
      } else {
        setErrorMessage(result.message || 'Error al guardar registro de empaque.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de comunicación con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add SKU presentation line
  const handleAddPackItem = () => {
    const sku = filteredSkus[0] || config.skus[0];
    if (!sku) return;
    const defaultPeso = parseWeightFromTitle(sku.product);
    setPackItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        product: sku.product,
        display: sku.product,
        peso: defaultPeso,
        piezas: '',
        adicionales: sku.adicionales || [],
        empaques: sku.empaques || [],
        etiqueta: sku.etiqueta || ''
      }
    ]);
  };

  // Remove SKU presentation line
  const handleRemovePackItem = (id: string) => {
    setPackItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Planta, Producción y Empaque</h2>
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sheets Conectado
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Vaciado operativo en tiempo real sincronizado con Google Sheets y Odoo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Abrir Google Sheet Oficial</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </a>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center justify-between">
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
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          onClick={() => setSubTab('production')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            subTab === 'production'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>1. Vaciado de Producción</span>
        </button>

        <button
          onClick={() => setSubTab('packaging')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            subTab === 'packaging'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>2. Vaciado de Empaque</span>
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            subTab === 'history'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>3. Historial de Lotes y Saldos</span>
        </button>

        <button
          onClick={() => setSubTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            subTab === 'inventory'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>4. Inventario Odoo en Vivo</span>
        </button>

        {canEditCosts && (
          <button
            onClick={() => setSubTab('costs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
              subTab === 'costs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>5. Catálogo de Costos y Empaques</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VACIADO DE PRODUCCIÓN */}
      {/* ========================================================================= */}
      {subTab === 'production' && (
        <form onSubmit={handleSaveProduction} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Card: General Production Data */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Datos del Lote
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha de Producción</label>
                <input
                  type="date"
                  value={prodDate}
                  onChange={e => setProdDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Categoría de Queso / Crema</label>
                <select
                  value={prodCategory}
                  onChange={e => setProdCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  {(config.categories || []).map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Kg Totales Obtenidos en Tina / Molde</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  placeholder="Ej. 120.5"
                  value={prodKgTotal}
                  onChange={e => setProdKgTotal(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 focus:bg-white text-lg"
                />
              </div>

              {/* Crema adjustment */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                <label className="text-xs font-bold text-amber-900 block">
                  Crema Natural Recuperada (Kg) (Opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.0"
                  value={cremaNaturalKg}
                  onChange={e => setCremaNaturalKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm font-semibold text-slate-800"
                />
                <span className="text-[10px] text-amber-700 block">
                  Se descuenta del costo total del lote según la fórmula de recuperación de sólidos lácteos.
                </span>
              </div>

              {/* Dynamic Lot Badge */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Código de Lote Auto-Generado:
                </span>
                <span className="inline-block px-3 py-1.5 bg-slate-900 text-white font-mono text-sm font-bold rounded-lg shadow-sm">
                  {previewLotCode}
                </span>
              </div>
            </div>

            {/* Middle & Right Card: Ingredients Table */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Insumos y Materias Primas</h3>
                  <p className="text-xs text-slate-400">Ingresa la cantidad consumida en litros o kilogramos</p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filtrar o buscar insumo..."
                    value={searchIngredientQuery}
                    onChange={e => setSearchIngredientQuery(e.target.value)}
                    className="px-3 py-1.5 pl-8 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              {/* Ingredients List */}
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {prodIngredients
                  .filter(ing =>
                    searchIngredientQuery ? ing.name.toLowerCase().includes(searchIngredientQuery.toLowerCase()) : true
                  )
                  .map(ing => {
                    const cant = typeof ing.quantity === 'number' ? ing.quantity : 0;
                    const subtotal = cant * ing.unitCost;
                    return (
                      <div
                        key={ing.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1 mr-4">
                          <span className="text-xs font-bold text-slate-800 block truncate">{ing.name}</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Costo unitario: ${ing.unitCost.toFixed(2)} / unidad
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-28">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.0"
                              value={ing.quantity}
                              onChange={e => {
                                const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                setProdIngredients(prev =>
                                  prev.map(item => (item.id === ing.id ? { ...item, quantity: val } : item))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div className="w-24 text-right">
                            <span className="text-xs font-bold text-slate-900 block">
                              ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setProdIngredients(prev => prev.filter(item => item.id !== ing.id))}
                            className="p-1 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                            title="Quitar de este lote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Add Custom Ingredient Selector */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <select
                  onChange={e => {
                    const ingName = e.target.value;
                    if (!ingName) return;
                    const found = (config.ingredients || []).find(i => i.name === ingName);
                    if (found && !prodIngredients.some(i => i.name === found.name)) {
                      setProdIngredients(prev => [
                        ...prev,
                        {
                          id: `${found.name}-${Date.now()}`,
                          name: found.name,
                          quantity: '',
                          unitCost: found.unitCost
                        }
                      ]);
                    }
                    e.target.value = '';
                  }}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="">+ Agregar otro insumo del catálogo...</option>
                  {(config.ingredients || []).map(ing => (
                    <option key={ing.name} value={ing.name}>
                      {ing.name} (${ing.unitCost.toFixed(2)})
                    </option>
                  ))}
                </select>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Insumos Bruto: </span>
                  <span className="text-sm font-bold text-slate-800">
                    ${calculatedProdSummary.rawTotalCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Summary Bar & Save Button */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Kg Producidos</span>
                <span className="text-2xl font-black text-white">{calculatedProdSummary.kgFinal.toFixed(2)} kg</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Costo Neto Lote</span>
                <span className="text-2xl font-black text-emerald-400">
                  ${calculatedProdSummary.netCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {calculatedProdSummary.ajusteCrema > 0 && (
                  <span className="text-[10px] text-amber-300 block">
                    (Ajuste Crema: -${calculatedProdSummary.ajusteCrema.toFixed(2)})
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Costo Unitario</span>
                <span className="text-2xl font-black text-blue-400">
                  ${calculatedProdSummary.costPerKg.toFixed(2)} <span className="text-sm font-normal text-slate-300">/ kg</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Destino</span>
                <span className="text-xs font-bold text-slate-200 block truncate">Google Sheets</span>
                <span className="text-[10px] text-emerald-400 font-mono">Pestaña 'Producción'</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 text-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando y Sincronizando...</span>
                </>
              ) : (
                <>
                  <Factory className="w-4 h-4" />
                  <span>Guardar y Enviar a Google Sheet</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VACIADO DE EMPAQUE */}
      {/* ========================================================================= */}
      {subTab === 'packaging' && (
        <form onSubmit={handleSavePackaging} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Card: Select Lot */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Lote a Empacar
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Selecciona el Lote con Saldo</label>
                <select
                  value={packLote}
                  onChange={e => setPackLote(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="">-- Elige un lote producido --</option>
                  {availableLots.map(l => (
                    <option key={l.lote} value={l.lote}>
                      {l.display}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha de Empaque</label>
                <input
                  type="date"
                  value={packDate}
                  onChange={e => setPackDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {selectedLotInfo && (
                <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Categoría:</span>
                    <span className="font-bold text-slate-800">{selectedLotInfo.categoria}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Fecha Producción:</span>
                    <span className="font-bold text-slate-800">{selectedLotInfo.fechaProduccion}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Kilos Originales:</span>
                    <span className="font-bold text-slate-800">{selectedLotInfo.kgTotal.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Saldo Disponible:</span>
                    <span className="font-black text-blue-700">{selectedLotInfo.kgDisponible.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-blue-200/50">
                    <span className="text-slate-500">Costo Base / Kg:</span>
                    <span className="font-bold text-emerald-700">${selectedLotInfo.costoPorKg.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Rendimiento Gauge Card */}
              {selectedLotInfo && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Aprovechamiento de Lote</span>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        calculatedPackagingSummary.aprovechamiento >= 98 && calculatedPackagingSummary.aprovechamiento <= 101
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : calculatedPackagingSummary.aprovechamiento >= 90
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {calculatedPackagingSummary.aprovechamiento.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 transition-all duration-300 ${
                        calculatedPackagingSummary.aprovechamiento >= 98 && calculatedPackagingSummary.aprovechamiento <= 101
                          ? 'bg-emerald-500'
                          : calculatedPackagingSummary.aprovechamiento >= 90
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, calculatedPackagingSummary.aprovechamiento)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Capturados: {calculatedPackagingSummary.totalKgCapturados.toFixed(2)} kg</span>
                    <span>Remanente: {calculatedPackagingSummary.balanceKg.toFixed(2)} kg</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Products & Presentations */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Presentaciones Empacadas</h3>
                  <p className="text-xs text-slate-400">
                    Registra piezas empacadas por presentación (puedes agregar múltiples tamaños)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddPackItem}
                  disabled={!selectedLotInfo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors border border-blue-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Presentación</span>
                </button>
              </div>

              {packItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Selecciona un lote para cargar las presentaciones</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {packItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Presentación / Producto {idx + 1}
                          </label>
                          <select
                            value={item.product}
                            onChange={e => {
                              const selProduct = e.target.value;
                              const foundSku = config.skus.find(s => s.product === selProduct);
                              if (foundSku) {
                                const newWeight = parseWeightFromTitle(foundSku.product);
                                setPackItems(prev =>
                                  prev.map(p =>
                                    p.id === item.id
                                      ? {
                                          ...p,
                                          product: foundSku.product,
                                          display: foundSku.product,
                                          peso: newWeight,
                                          adicionales: foundSku.adicionales || [],
                                          empaques: foundSku.empaques || [],
                                          etiqueta: foundSku.etiqueta || ''
                                        }
                                      : p
                                  )
                                );
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          >
                            {filteredSkus.map(s => (
                              <option key={s.product} value={s.product}>
                                {s.product}
                              </option>
                            ))}
                          </select>
                        </div>

                        {packItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePackItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Peso Unitario (Kg)</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.01"
                            value={item.peso}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setPackItems(prev =>
                                prev.map(p => (p.id === item.id ? { ...p, peso: val } : p))
                              );
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Piezas Empacadas</label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            placeholder="0"
                            value={item.piezas}
                            onChange={e => {
                              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                              setPackItems(prev =>
                                prev.map(p => (p.id === item.id ? { ...p, piezas: val } : p))
                              );
                            }}
                            required
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-blue-700"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Kilos de esta línea</label>
                          <div className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
                            {((typeof item.piezas === 'number' ? item.piezas : 0) * (item.peso || 0)).toFixed(2)} kg
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Costo Estimado / Pz</label>
                          <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black text-emerald-800">
                            {(() => {
                              const summaryItem = calculatedPackagingSummary.itemsSummary.find(s => s.id === item.id);
                              return summaryItem ? `$${summaryItem.costoPieza.toFixed(2)}` : '$0.00';
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Display packaging and labels */}
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                        {item.empaques && item.empaques.length > 0 && (
                          <span className="bg-slate-200/70 px-2 py-0.5 rounded text-slate-700">
                            Empaque: {item.empaques.join(', ')}
                          </span>
                        )}
                        {item.etiqueta && (
                          <span className="bg-slate-200/70 px-2 py-0.5 rounded text-slate-700">
                            Etiqueta: {item.etiqueta}
                          </span>
                        )}
                        {item.adicionales && item.adicionales.length > 0 && (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                            Adicionales: {item.adicionales.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Additional Ingredients Kg Inputs (if any sku requires it) */}
              {(() => {
                const requiredAdicionales = new Set<string>();
                packItems.forEach(i => {
                  (i.adicionales || []).forEach(ad => requiredAdicionales.add(ad));
                });
                const adList = Array.from(requiredAdicionales);
                if (adList.length === 0) return null;

                return (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-amber-900 block">
                      Insumos Adicionales a Prorratear en el Empaque:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {adList.map(ad => (
                        <div key={ad} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-amber-200">
                          <span className="text-xs font-semibold text-slate-800 truncate">{ad}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.0 kg"
                              value={packAdicionalesKg[ad] || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setPackAdicionalesKg(prev => ({ ...prev, [ad]: val }));
                              }}
                              className="w-20 px-2 py-1 text-xs font-bold border border-slate-200 rounded text-right"
                            />
                            <span className="text-[11px] text-slate-400">kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bottom Summary Bar for Packaging */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Lote en Proceso</span>
                <span className="text-lg font-black text-white font-mono">{packLote || 'Sin selección'}</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Kilos Empacados</span>
                <span className="text-2xl font-black text-blue-400">
                  {calculatedPackagingSummary.totalKgCapturados.toFixed(2)} kg
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Aprovechamiento</span>
                <span
                  className={`text-2xl font-black ${
                    calculatedPackagingSummary.aprovechamiento >= 98 && calculatedPackagingSummary.aprovechamiento <= 101
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {calculatedPackagingSummary.aprovechamiento.toFixed(1)}%
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Destino</span>
                <span className="text-xs font-bold text-slate-200 block truncate">Google Sheets</span>
                <span className="text-[10px] text-emerald-400 font-mono">Pestaña 'Empaque'</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedLotInfo}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 text-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando y Sincronizando...</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  <span>Guardar Empaque y Enviar a Google Sheet</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HISTORIAL DE LOTES Y SALDOS */}
      {/* ========================================================================= */}
      {subTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historial y Saldos de Producción</h3>
              <p className="text-xs text-slate-500">
                Consulta los lotes registrados, kilogramos producidos, empaque acumulado y saldo restante.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar lote o categoría..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="px-3 py-1.5 pl-8 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                onClick={() => {
                  loadLots();
                  loadHistory();
                }}
                className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors"
                title="Actualizar datos"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Lote</th>
                    <th className="p-3.5">Fecha Prod</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5 text-right">Kg Producido</th>
                    <th className="p-3.5 text-right">Kg Empacados</th>
                    <th className="p-3.5 text-right">Saldo Disp</th>
                    <th className="p-3.5 text-right">Costo / Kg</th>
                    <th className="p-3.5 text-center">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(historyData.production || [])
                    .filter(b => {
                      if (!historySearch) return true;
                      const q = historySearch.toLowerCase();
                      return (
                        (b.lote || '').toLowerCase().includes(q) ||
                        (b.categoria || '').toLowerCase().includes(q)
                      );
                    })
                    .map(b => {
                      const lotInfo = availableLots.find(l => l.lote === b.lote);
                      const disp = lotInfo ? lotInfo.kgDisponible : 0;
                      const emp = lotInfo ? lotInfo.kgEmpacados : (b.kgTotal - disp);
                      const isComplete = disp <= 0.5;

                      return (
                        <tr key={b.id || b.lote} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-bold font-mono text-slate-900">{b.lote}</td>
                          <td className="p-3.5">{b.fechaProduccion}</td>
                          <td className="p-3.5 font-semibold text-slate-800">{b.categoria}</td>
                          <td className="p-3.5 text-right font-bold text-slate-900">{b.kgTotal.toFixed(2)} kg</td>
                          <td className="p-3.5 text-right text-slate-600">{emp.toFixed(2)} kg</td>
                          <td className="p-3.5 text-right font-black text-blue-700">{disp.toFixed(2)} kg</td>
                          <td className="p-3.5 text-right font-bold text-emerald-700">${b.costoPorKg.toFixed(2)}</td>
                          <td className="p-3.5 text-center">
                            {isComplete ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Agotado
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Disponible
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {(!historyData.production || historyData.production.length === 0) && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No hay lotes de producción registrados aún en la aplicación.
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
      {/* TAB 4: INVENTARIO ODOO EN VIVO */}
      {/* ========================================================================= */}
      {subTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inventario Odoo en Tiempo Real</h3>
              <p className="text-xs text-slate-500">
                Stock físico, reservado y disponible directamente del servidor Odoo
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar producto o ubicación..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  className="px-3 py-1.5 pl-8 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                onClick={loadInventory}
                disabled={loadingInventory}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:bg-blue-400"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInventory ? 'animate-spin' : ''}`} />
                <span>Actualizar Stock Odoo</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5">Ubicación Almacén</th>
                    <th className="p-3.5 text-right">Físico</th>
                    <th className="p-3.5 text-right">Reservado</th>
                    <th className="p-3.5 text-right">Disponible</th>
                    <th className="p-3.5 text-right">Peso Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {odooInventory
                    .filter(item => {
                      if (!inventorySearch) return true;
                      const q = inventorySearch.toLowerCase();
                      return (
                        (item.producto || '').toLowerCase().includes(q) ||
                        (item.categoria || '').toLowerCase().includes(q) ||
                        (item.ubicacion || '').toLowerCase().includes(q)
                      );
                    })
                    .map(item => (
                      <tr key={`${item.productId}-${item.locationId}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">{item.producto}</td>
                        <td className="p-3.5 text-slate-500">{item.categoria}</td>
                        <td className="p-3.5 text-slate-600">{item.ubicacion}</td>
                        <td className="p-3.5 text-right font-semibold text-slate-800">{item.cantidadFisica}</td>
                        <td className="p-3.5 text-right text-rose-600">{item.reservado}</td>
                        <td className="p-3.5 text-right font-black text-emerald-700">{item.disponible}</td>
                        <td className="p-3.5 text-right font-bold text-slate-700">
                          {item.pesoTotal > 0 ? `${item.pesoTotal.toFixed(2)} kg` : '---'}
                        </td>
                      </tr>
                    ))}
                  {odooInventory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        {loadingInventory ? 'Cargando inventario de Odoo...' : 'No se encontraron registros de stock en Odoo.'}
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
      {/* TAB 5: CATÁLOGO DE COSTOS DE INSUMOS Y EMPAQUES */}
      {/* ========================================================================= */}
      {subTab === 'costs' && canEditCosts && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Catálogo de Costos de Insumos y Empaques</h3>
                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                  {editableIngredients.length} Items Registrados
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Modifica los costos unitarios de insumos, materiales de empaque y etiquetas. Al dar clic en <strong>Guardar y Actualizar Hoja Costos</strong>, se actualizará el sistema y se sobrescribirá la pestaña <code>Costos</code> en Google Sheets borrando el listado anterior.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCostModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors border border-blue-200"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nuevo Insumo / Empaque</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCosts}
                disabled={savingCosts}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:bg-emerald-400"
              >
                <Save className={`w-4 h-4 ${savingCosts ? 'animate-spin' : ''}`} />
                <span>{savingCosts ? 'Actualizando Sheets...' : 'Guardar y Actualizar en Google Sheets'}</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="text"
                  placeholder="Buscar insumo, empaque o proveedor..."
                  value={costSearch}
                  onChange={e => setCostSearch(e.target.value)}
                  className="w-full px-3 py-1.5 pl-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setCostFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  costFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({editableIngredients.length})
              </button>
              <button
                type="button"
                onClick={() => setCostFilter('ingredients')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  costFilter === 'ingredients'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Insumos Recetas ({editableIngredients.filter(i => i.isIngredient).length})
              </button>
              <button
                type="button"
                onClick={() => setCostFilter('packaging')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  costFilter === 'packaging'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Empaques y Etiquetas ({editableIngredients.filter(i => !i.isIngredient).length})
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
                    <th className="p-3.5">Presentación Compra</th>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5 text-right w-44">Costo Unitario Base ($)</th>
                    <th className="p-3.5 text-center w-20">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {editableIngredients
                    .filter(item => {
                      if (costFilter === 'ingredients' && !item.isIngredient) return false;
                      if (costFilter === 'packaging' && item.isIngredient) return false;
                      if (!costSearch) return true;
                      const q = costSearch.toLowerCase();
                      return (
                        (item.name || '').toLowerCase().includes(q) ||
                        (item.provider || '').toLowerCase().includes(q)
                      );
                    })
                    .map((item, idx) => (
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
                        <td className="p-3.5 text-slate-600">{item.empaquePresentation || item.empaque || '1 unidad'}</td>
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
                                setEditableIngredients(prev =>
                                  prev.map(i => (i.name === item.name ? { ...i, unitCost: val } : i))
                                );
                              }}
                              className="w-28 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 text-right focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCostItem(item.name)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                            title="Eliminar de catálogo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal for adding new item */}
          {showAddCostModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900">Agregar Nuevo Insumo o Empaque</h4>
                  <button
                    onClick={() => setShowAddCostModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddNewCostItem} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Nombre o Descripción</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Bolsa Pounch 8 X 10 o Sal Yodada"
                      value={newCostItem.name}
                      onChange={e => setNewCostItem({ ...newCostItem, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Tipo</label>
                      <select
                        value={newCostItem.isIngredient ? 'ingredient' : 'packaging'}
                        onChange={e => setNewCostItem({ ...newCostItem, isIngredient: e.target.value === 'ingredient' })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        <option value="ingredient">Materia Prima / Insumo</option>
                        <option value="packaging">Empaque / Etiqueta</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Costo Unitario Base ($)</label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        required
                        placeholder="0.00"
                        value={newCostItem.unitCost || ''}
                        onChange={e => setNewCostItem({ ...newCostItem, unitCost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Proveedor</label>
                      <input
                        type="text"
                        placeholder="Ej. TASSA o General"
                        value={newCostItem.provider}
                        onChange={e => setNewCostItem({ ...newCostItem, provider: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Presentación Compra</label>
                      <input
                        type="text"
                        placeholder="Ej. 25 kg o 1000 pz"
                        value={newCostItem.empaquePresentation}
                        onChange={e => setNewCostItem({ ...newCostItem, empaquePresentation: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddCostModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                    >
                      Agregar al Catálogo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
