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
  Clock,
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

// Pure Utility Helpers (declared outside component to prevent TDZ)
function cleanCatName(cat: string): string {
  return (cat || '')
    .replace(/^All\s*\/\s*Quesos\s*\/\s*/i, '')
    .replace(/^All\s*\/\s*/i, '')
    .replace(/^All\//i, '')
    .trim();
}

function isCategoryMatch(cat1: string, cat2: string): boolean {
  if (!cat1 || !cat2) return false;
  if (cat1.trim().toLowerCase() === cat2.trim().toLowerCase()) return true;
  const c1 = cleanCatName(cat1).toLowerCase();
  const c2 = cleanCatName(cat2).toLowerCase();
  return c1 === c2 || c1.includes(c2) || c2.includes(c1);
}

function parseWeightFromTitle(title: string): number {
  const lower = (title || '').toLowerCase();
  const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/);
  if (kgMatch) return parseFloat(kgMatch[1]);

  const gMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos?)/);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;

  const lMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litro?s?)/);
  if (lMatch) return parseFloat(lMatch[1]);

  const mlMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ml|mililitros?)/);
  if (mlMatch) return parseFloat(mlMatch[1]) / 1000;

  return 1.0;
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
  const [subTab, setSubTab] = useState<'production' | 'packaging' | 'history' | 'inventory'>('production');

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
  // ODOO DAIRY CATALOG & UNCONFIGURED SKUs
  // ==========================================
  const [odooCatalog, setOdooCatalog] = useState<{
    categories: string[];
    products: any[];
    unconfiguredProducts: any[];
    lastSync: number;
  }>({ categories: [], products: [], unconfiguredProducts: [], lastSync: 0 });
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedOdooCategory, setSelectedOdooCategory] = useState<string>('all');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Category & Lot Cascading Selection in Packaging
  const [selectedPackCategory, setSelectedPackCategory] = useState<string>('');

  // SKU Technical Configuration Modal (Gerencia & Supervisión)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedPendingSku, setSelectedPendingSku] = useState<any | null>(null);
  const [skuModalForm, setSkuModalForm] = useState({
    product: '',
    category: '',
    peso: 1.0,
    empaques: [] as string[],
    etiqueta: '',
    adicionales: [] as string[]
  });
  const [savingSku, setSavingSku] = useState(false);

  // Selected lot info derived from availableLots and packLote
  const selectedLotInfo = useMemo(() => {
    return availableLots.find(l => l.lote === packLote);
  }, [availableLots, packLote]);

  // Active lot categories from availableLots
  const activeLotCategories = useMemo(() => {
    const map = new Map<string, number>();
    availableLots.forEach(l => {
      const clean = l.categoria || 'Sin categoría';
      map.set(clean, (map.get(clean) || 0) + 1);
    });
    return Array.from(map.entries()).map(([categoria, count]) => ({
      categoria,
      cleanName: cleanCatName(categoria),
      count
    }));
  }, [availableLots]);

  // Categories without active lots
  const otherCategories = useMemo(() => {
    return (config.categories || []).filter(c =>
      !activeLotCategories.some(alc => isCategoryMatch(alc.categoria, c))
    );
  }, [config.categories, activeLotCategories]);

  // Lots filtered ONLY for the selected category
  const lotsForSelectedCategory = useMemo(() => {
    if (!selectedPackCategory) return [];
    return availableLots.filter(l => isCategoryMatch(l.categoria, selectedPackCategory));
  }, [availableLots, selectedPackCategory]);

  // Automatically select the first category that has active lots if none selected
  useEffect(() => {
    if (!selectedPackCategory && activeLotCategories.length > 0) {
      setSelectedPackCategory(activeLotCategories[0].categoria);
    }
  }, [activeLotCategories, selectedPackCategory]);

  // Keep category in sync if a lot is loaded
  useEffect(() => {
    if (selectedLotInfo && selectedLotInfo.categoria) {
      if (!isCategoryMatch(selectedPackCategory, selectedLotInfo.categoria)) {
        setSelectedPackCategory(selectedLotInfo.categoria);
      }
    }
  }, [selectedLotInfo, selectedPackCategory]);

  const openSkuConfig = (sku: any) => {
    setSelectedPendingSku(sku);
    setSkuModalForm({
      product: sku.product || sku.name,
      category: sku.category || selectedPackCategory || (selectedLotInfo ? selectedLotInfo.categoria : ''),
      peso: sku.peso || sku.weight || parseWeightFromTitle(sku.product || sku.name),
      empaques: sku.empaques || [],
      etiqueta: sku.etiqueta || '',
      adicionales: sku.adicionales || []
    });
    setShowConfigModal(true);
  };

  // Fetch initial master data
  const loadMasterConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await apiFetch('/api/production/config');
      const data = await res.json();
      setConfig(data);
      if (data.categories && data.categories.length > 0 && !prodCategory) {
        setProdCategory(data.categories[0]);
      }
    } catch (e: any) {
      console.error('Error cargando configuración:', e);
    } finally {
      setLoadingConfig(false);
    }
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

  const loadOdooCatalog = async (force = false) => {
    try {
      setLoadingCatalog(true);
      const res = await apiFetch(`/api/production/odoo-catalog?force=${force ? 'true' : 'false'}`);
      if (res.ok) {
        const data = await res.json();
        setOdooCatalog(data);
      }
    } catch (e: any) {
      console.error('Error cargando catálogo de Odoo:', e);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleSaveSkuConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuModalForm.product || !skuModalForm.category) return;
    try {
      setSavingSku(true);
      const res = await apiFetch('/api/production/configure-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skuModalForm)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message);
        loadMasterConfig();
        loadOdooCatalog(true);
        setSelectedPendingSku(null);
        if (odooCatalog.unconfiguredProducts.length <= 1) {
          setShowConfigModal(false);
        }
      } else {
        setErrorMessage(data.message);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error guardando ficha técnica');
    } finally {
      setSavingSku(false);
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
    loadOdooCatalog();
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

// parseWeightFromTitle hoisted to module scope

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

  // Combine configured SKUs with Odoo dairy catalog & evaluate full recipe elements
  const availablePackagingSkus = useMemo(() => {
    const list: {
      product: string;
      category: string;
      peso: number;
      adicionales: string[];
      empaques: string[];
      etiqueta: string;
      isConfigured: boolean;
      hasCompleteRecipe: boolean;
      missingRecipeElements: string[];
    }[] = [];

    const configuredMap = new Map<string, any>();
    (config.skus || []).forEach(s => {
      configuredMap.set(s.product.trim().toLowerCase(), s);
    });

    const checkRecipe = (name: string, category: string, peso: number, empaques: string[], etiqueta: string, adicionales: string[]) => {
      const norm = name.trim().toLowerCase();
      const hasInsumosCategory = (config.categories || []).some(c =>
        c.toLowerCase() === category.toLowerCase() ||
        category.toLowerCase().includes(c.toLowerCase()) ||
        c.toLowerCase().includes(category.toLowerCase())
      );
      const hasPeso = Boolean(peso && peso > 0);
      const hasEmpaque = Array.isArray(empaques) && empaques.length > 0;
      const hasEtiqueta = Boolean(etiqueta && etiqueta.trim().length > 0);

      const specialKeywords = ['chipotle', 'jalape', 'jamon', 'jamón', 'habanero', 'morral', 'hierba', 'sabor', 'aderezado'];
      const requiresAdicionales = specialKeywords.some(kw => norm.includes(kw));
      const hasAdicionales = requiresAdicionales ? (Array.isArray(adicionales) && adicionales.length > 0) : true;

      const missing: string[] = [];
      if (!hasInsumosCategory) missing.push('Insumos/Categoría');
      if (!hasPeso) missing.push('Peso Unitario');
      if (!hasEmpaque) missing.push('Material de Empaque');
      if (!hasEtiqueta) missing.push('Etiqueta');
      if (!hasAdicionales) missing.push('Insumos Adicionales');

      return {
        hasCompleteRecipe: missing.length === 0,
        missingRecipeElements: missing
      };
    };

    (odooCatalog.products || []).forEach(op => {
      const norm = op.name.trim().toLowerCase();
      const cfg = configuredMap.get(norm);
      const category = cfg?.category || op.category || '';
      const peso = (cfg && Number(cfg.peso) > 0) ? Number(cfg.peso) : (op.weight || parseWeightFromTitle(op.name));
      const empaques = cfg?.empaques || [];
      const etiqueta = cfg?.etiqueta || '';
      const adicionales = cfg?.adicionales || [];

      const { hasCompleteRecipe, missingRecipeElements } = checkRecipe(op.name, category, peso, empaques, etiqueta, adicionales);

      list.push({
        product: op.name,
        category,
        peso,
        adicionales,
        empaques,
        etiqueta,
        isConfigured: hasCompleteRecipe,
        hasCompleteRecipe,
        missingRecipeElements
      });
    });

    (config.skus || []).forEach(cs => {
      const norm = cs.product.trim().toLowerCase();
      if (!list.some(item => item.product.trim().toLowerCase() === norm)) {
        const peso = cs.peso || parseWeightFromTitle(cs.product);
        const { hasCompleteRecipe, missingRecipeElements } = checkRecipe(cs.product, cs.category, peso, cs.empaques || [], cs.etiqueta || '', cs.adicionales || []);
        list.push({
          product: cs.product,
          category: cs.category,
          peso,
          adicionales: cs.adicionales || [],
          empaques: cs.empaques || [],
          etiqueta: cs.etiqueta || '',
          isConfigured: hasCompleteRecipe,
          hasCompleteRecipe,
          missingRecipeElements
        });
      }
    });

    return list;
  }, [odooCatalog.products, config.skus, config.categories]);

  // SKUs filtered for selected category (from dropdown or active lot)
  const filteredSkus = useMemo(() => {
    let prods = availablePackagingSkus;

    const activeCat = selectedLotInfo?.categoria || selectedPackCategory;
    if (activeCat) {
      const clean = cleanCatName(activeCat).toLowerCase();
      const catMatches = prods.filter(s => {
        const pCat = (s.category || '').toLowerCase();
        const pName = (s.product || '').toLowerCase();
        return pCat.includes(clean) || pName.includes(clean);
      });
      if (catMatches.length > 0) {
        prods = catMatches;
      }
    }

    if (productSearchTerm.trim()) {
      const q = productSearchTerm.toLowerCase();
      prods = prods.filter(s => s.product.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }

    return prods;
  }, [availablePackagingSkus, selectedLotInfo, selectedPackCategory, productSearchTerm]);

  const availableEmpaqueOptions = useMemo(() => {
    return (config.ingredients || [])
      .filter(i => !i.isIngredient && !i.name.toLowerCase().includes('etiqueta'))
      .map(i => i.name);
  }, [config.ingredients]);

  const availableEtiquetaOptions = useMemo(() => {
    return (config.ingredients || [])
      .filter(i => !i.isIngredient && i.name.toLowerCase().includes('etiqueta'))
      .map(i => i.name);
  }, [config.ingredients]);

  const availableAdicionalesOptions = useMemo(() => {
    return (config.ingredients || [])
      .filter(i => i.isIngredient && ['sal', 'chile', 'hierbas', 'especias', 'jalapeno', 'jalapeño', 'chipotle', 'crema', 'jamon', 'jamón'].some(k => i.name.toLowerCase().includes(k)))
      .map(i => i.name);
  }, [config.ingredients]);

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

      {/* Gerencia & Supervisión Alert Banner for Incomplete Costing Recipes */}
      {canEditCosts && odooCatalog.unconfiguredProducts && odooCatalog.unconfiguredProducts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                  Aviso a Gerencia y Supervisión: Recetas de Costos Incompletas
                </h4>
                <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  {odooCatalog.unconfiguredProducts.length} producto(s) lácteo(s) con elementos faltantes
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Se detectaron productos lácteos en Odoo a los que les faltan elementos en su receta de costos (insumos de tina, material de empaque primario, etiqueta, peso unitario o adicionales requeridos). Es indispensable completar la receta para autorizar su empaque y costeo exacto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const first = odooCatalog.unconfiguredProducts[0];
              openSkuConfig(first);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Completar Receta de Costos ({odooCatalog.unconfiguredProducts.length})</span>
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
          <span>1. Elaboración en Tina (Día de Producción)</span>
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
          <span>2. Vaciado de Empaque (Tras Reposo y Maduración)</span>
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

      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VACIADO DE PRODUCCIÓN (ELABORACIÓN EN TINA) */}
      {/* ========================================================================= */}
      {subTab === 'production' && (
        <form onSubmit={handleSaveProduction} className="space-y-6">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-blue-900 font-medium">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Separación de Procesos (Elaboración en Tina vs Empaque):</strong> Este formato registra exclusivamente el día de elaboración en tina o molde. Tras la elaboración, los quesos se trasladan a cámaras para reposar varios días y deshidratarse naturalmente antes de pasar a empaque.
            </span>
          </div>

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
      {/* TAB 2: VACIADO DE EMPAQUE (POST-REPOSO Y MADURACIÓN) */}
      {/* ========================================================================= */}
      {subTab === 'packaging' && (
        <form onSubmit={handleSavePackaging} className="space-y-6">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs text-emerald-900 font-medium">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Vaciado de Empaque Tras Reposo y Maduración:</strong> Selecciona un lote elaborado previamente. Cada lote indica los días transcurridos de reposo y deshidratación natural en cámara antes del empaque.
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-500 shrink-0">
              Catálogo Odoo: {odooCatalog.products.length} productos lácteos ({odooCatalog.categories.length} categorías)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Card: Select Lot */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Lote a Empacar
              </h3>

              {/* 1. Lista Desplegable de la Categoría */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  1. Categoría a Empacar
                </label>
                <select
                  value={selectedPackCategory}
                  onChange={e => {
                    const newCat = e.target.value;
                    setSelectedPackCategory(newCat);
                    setPackLote('');
                  }}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value="">-- Elige una categoría de lácteos --</option>
                  {activeLotCategories.map(item => (
                    <option key={item.categoria} value={item.categoria}>
                      {item.cleanName} ({item.count} lote{item.count === 1 ? '' : 's'} con saldo)
                    </option>
                  ))}
                  {otherCategories.length > 0 && (
                    <optgroup label="Otras categorías sin lotes producidos">
                      {otherCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {cleanCatName(cat)} (0 lotes)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* 2. Lista Desplegable de Lotes (Únicamente de la Categoría Seleccionada) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  2. Lote con Saldo {selectedPackCategory ? `(${cleanCatName(selectedPackCategory)})` : ''}
                </label>
                <select
                  value={packLote}
                  onChange={e => setPackLote(e.target.value)}
                  disabled={!selectedPackCategory}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {!selectedPackCategory ? (
                    <option value="">-- Primero selecciona una categoría arriba --</option>
                  ) : lotsForSelectedCategory.length === 0 ? (
                    <option value="">-- No hay lotes con saldo para ${cleanCatName(selectedPackCategory)} --</option>
                  ) : (
                    <>
                      <option value="">-- Elige un lote de ${cleanCatName(selectedPackCategory)} --</option>
                      {lotsForSelectedCategory.map(l => (
                        <option key={l.lote} value={l.lote}>
                          {l.display}
                        </option>
                      ))}
                    </>
                  )}
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
                    <span className="text-slate-500">Fecha Elaboración:</span>
                    <span className="font-bold text-slate-800">{selectedLotInfo.fechaProduccion}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Reposo / Deshidratación:</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {(selectedLotInfo as any).diasReposo !== undefined
                        ? ((selectedLotInfo as any).diasReposo === 0 ? 'Elaborado hoy' : `${(selectedLotInfo as any).diasReposo} días de reposo natural`)
                        : 'En cámara'}
                    </span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800">Presentaciones Empacadas</h3>
                    {selectedPackCategory && (
                      <span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                        {cleanCatName(selectedPackCategory)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Registra piezas empacadas de {selectedPackCategory ? cleanCatName(selectedPackCategory) : 'la categoría seleccionada'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar presentación..."
                      value={productSearchTerm}
                      onChange={e => setProductSearchTerm(e.target.value)}
                      className="w-48 px-3 py-1.5 pl-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    {productSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setProductSearchTerm('')}
                        className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPackItem}
                    disabled={!selectedLotInfo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors border border-blue-200 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Presentación</span>
                  </button>
                </div>
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
                              const foundSku = availablePackagingSkus.find(s => s.product === selProduct);
                              if (foundSku) {
                                const newWeight = parseWeightFromTitle(foundSku.product);
                                setPackItems(prev =>
                                  prev.map(p =>
                                    p.id === item.id
                                      ? {
                                          ...p,
                                          product: foundSku.product,
                                          display: foundSku.product,
                                          peso: foundSku.peso || newWeight,
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
                                {s.product} {!s.hasCompleteRecipe ? ` ⚠️ (Falta: ${s.missingRecipeElements.join(', ')})` : ''}
                              </option>
                            ))}
                          </select>

                          {/* Recipe Incomplete Alert / Configure Button for this SKU */}
                          {(() => {
                            const currentSku = availablePackagingSkus.find(s => s.product === item.product);
                            if (currentSku && !currentSku.hasCompleteRecipe) {
                              return (
                                <div className="mt-2 flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div>
                                      <span className="font-bold block text-xs">Receta de costos incompleta:</span>
                                      <span className="text-[11px] text-amber-800">
                                        Faltan elementos: {currentSku.missingRecipeElements.join(', ')}
                                      </span>
                                    </div>
                                  </div>
                                  {canEditCosts && (
                                    <button
                                      type="button"
                                      onClick={() => openSkuConfig(currentSku)}
                                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 shadow-sm"
                                    >
                                      Completar Receta
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
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
      {/* MODAL: FICHA TÉCNICA DE COSTEO Y EMPAQUE (GERENCIA Y SUPERVISIÓN) */}
      {/* ========================================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Ficha Técnica de Producción y Empaque
                  </h3>
                  <p className="text-xs text-slate-500">
                    Parámetros de costeo para productos dados de alta en Odoo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipe Elements Verification Checklist */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                Verificación de Elementos de la Receta de Costos:
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className={`p-2 rounded-lg border ${skuModalForm.category ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <span className="font-bold block">1. Insumos Base</span>
                  <span className="text-[10px]">{skuModalForm.category ? '✓ Categoría asignada' : '✗ Falta categoría'}</span>
                </div>
                <div className={`p-2 rounded-lg border ${skuModalForm.peso > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <span className="font-bold block">2. Peso Unitario</span>
                  <span className="text-[10px]">{skuModalForm.peso > 0 ? `✓ ${skuModalForm.peso} kg` : '✗ Falta peso'}</span>
                </div>
                <div className={`p-2 rounded-lg border ${skuModalForm.empaques.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <span className="font-bold block">3. Empaque</span>
                  <span className="text-[10px]">{skuModalForm.empaques.length > 0 ? `✓ ${skuModalForm.empaques.length} sel.` : '✗ Falta empaque'}</span>
                </div>
                <div className={`p-2 rounded-lg border ${skuModalForm.etiqueta ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <span className="font-bold block">4. Etiqueta</span>
                  <span className="text-[10px]">{skuModalForm.etiqueta ? '✓ Asignada' : '✗ Falta etiqueta'}</span>
                </div>
              </div>
            </div>

            {/* Pending Products Selector */}
            {odooCatalog.unconfiguredProducts && odooCatalog.unconfiguredProducts.length > 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                <label className="text-[11px] font-bold text-amber-900 block">
                  Seleccionar Producto con Receta Incompleta ({odooCatalog.unconfiguredProducts.length}):
                </label>
                <select
                  value={skuModalForm.product}
                  onChange={e => {
                    const sel = odooCatalog.unconfiguredProducts.find(p => p.name === e.target.value);
                    if (sel) {
                      openSkuConfig(sel);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  {odooCatalog.unconfiguredProducts.map(p => (
                    <option key={p.odooId || p.name} value={p.name}>
                      {p.name} {p.missingRecipeElements ? ` (Falta: ${p.missingRecipeElements.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleSaveSkuConfig} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Producto en Odoo</label>
                <input
                  type="text"
                  value={skuModalForm.product}
                  onChange={e => setSkuModalForm({ ...skuModalForm, product: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Categoría de Producción</label>
                  <select
                    value={skuModalForm.category}
                    onChange={e => setSkuModalForm({ ...skuModalForm, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Elige categoría --</option>
                    {(config.categories || []).map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    {(odooCatalog.categories || [])
                      .filter(c => !(config.categories || []).includes(c))
                      .map(cat => (
                        <option key={cat} value={cat}>
                          {cat} (Odoo)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Peso Unitario (Kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.01"
                    value={skuModalForm.peso}
                    onChange={e => setSkuModalForm({ ...skuModalForm, peso: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-blue-600"
                  />
                  <span className="text-[10px] text-slate-400">Ej: 1.0 para 1kg, 0.500 para 500g, 0.250 para 250g</span>
                </div>
              </div>

              {/* Packaging Materials Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Material de Empaque Primario (Bolsa, Cubeta, Caja, etc.)
                </label>
                <div className="max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  {availableEmpaqueOptions.map(emp => (
                    <label key={emp} className="flex items-center gap-2 p-1 text-xs text-slate-700 hover:bg-slate-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skuModalForm.empaques.includes(emp)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSkuModalForm({ ...skuModalForm, empaques: [...skuModalForm.empaques, emp] });
                          } else {
                            setSkuModalForm({ ...skuModalForm, empaques: skuModalForm.empaques.filter(x => x !== emp) });
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{emp}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Label Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Etiqueta Asignada
                </label>
                <select
                  value={skuModalForm.etiqueta}
                  onChange={e => setSkuModalForm({ ...skuModalForm, etiqueta: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                >
                  <option value="">-- Sin etiqueta / Genérica --</option>
                  {availableEtiquetaOptions.map(etq => (
                    <option key={etq} value={etq}>
                      {etq}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Ingredients to Prorate */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Insumos Adicionales en Empaque (Sal, Chile, etc.)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableAdicionalesOptions.map(ad => {
                    const isSelected = skuModalForm.adicionales.includes(ad);
                    return (
                      <button
                        key={ad}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSkuModalForm({ ...skuModalForm, adicionales: skuModalForm.adicionales.filter(x => x !== ad) });
                          } else {
                            setSkuModalForm({ ...skuModalForm, adicionales: [...skuModalForm.adicionales, ad] });
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{ad}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSku}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:bg-blue-400"
                >
                  {savingSku ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar Ficha Técnica</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
