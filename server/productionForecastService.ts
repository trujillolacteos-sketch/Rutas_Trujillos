import fs from 'fs';
import path from 'path';
import { executeKw } from './odoo';
import { getProductionConfig, getSuppliesInventory } from './productionService';

const FORECAST_CACHE_FILE = 'forecast_cache.json';

export interface ProductDemandItem {
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

export interface CategoryProductionForecast {
  categoria: string;
  cleanCategoria: string;
  kgProyectados: number;
  piezasProyectadas: number;
  porcentajeDelTotal: number;
  litrosLecheRequeridos: number;
  rendimientoLitrosPorKg: number;
  productos: ProductDemandItem[];
}

export interface SupplyRequirementItem {
  nombre: string;
  tipo: 'ingrediente' | 'empaque' | 'etiqueta';
  tipoLabel: string;
  unidadBase: string;
  proveedor: string;
  costoUnitario: number;
  stockActual: number;
  consumoSemanal: number;
  consumoDiario: number;
  stockSeguridad: number; // Abasto para 2 a 3 días mientras llega el camión
  abastoMinimoCiclo: number; // Consumo semanal + Stock de seguridad
  diasCobertura: number;
  estatusAbasto: 'critico' | 'riesgo' | 'optimo';
  estatusLabel: string;
  compraSugerida: number;
  presentacionCompra?: string;
  unidadesEmpaqueCompra?: number;
  costoEstimadoCompra: number;
  usadoEnCategorias: string[];
}

export interface ProviderPurchaseSummary {
  proveedor: string;
  totalItems: number;
  itemsRequeridos: number;
  itemsCriticos: number;
  itemsRiesgo: number;
  costoTotalOrden: number;
  items: SupplyRequirementItem[];
}

export interface ForecastResponse {
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
  manualOverrides?: Record<string, number>;
}

// Rendimientos promedio de leche por kg de producto según categoría (Litros leche / Kg queso)
const LECHE_YIELDS_BY_CAT: Record<string, number> = {
  panela: 8.5,
  fresco: 8.5,
  ranchero: 8.5,
  oaxaca: 9.5,
  asadero: 9.5,
  adobera: 9.5,
  mozzarella: 9.0,
  pizzero: 9.0,
  manchego: 10.0,
  chihuahua: 10.0,
  cheddar: 10.0,
  crema: 3.5,
  jocoque: 3.5,
  mantequilla: 14.0
};

// Dosis estándar de ingredientes por kg de queso
const INGREDIENTS_DOSAGE_PER_KG: Record<string, number> = {
  'sal refinada': 0.022, // 22g de sal por kg
  'sal de grano': 0.022,
  'ácido cítrico': 0.0018, // 1.8g por kg de pasta hilada
  'citrato': 0.002,
  'benzoato': 0.0005, // 0.5g conservador por kg
  'cloruro de calcio': 0.0025, // 2.5g por cada 10L de leche (~0.0025 kg/kg)
  'cuajo': 0.0003, // 0.3ml por kg
  'azucar': 0.05 // para jocoque
};

function cleanCategoryName(name: string): string {
  if (!name) return 'Otros';
  return name
    .replace(/^All\s*\/\s*Quesos\s*\/\s*/i, '')
    .replace(/^All\s*\/\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  if (lower.includes('1/4')) return 0.25;
  if (lower.includes('1/2')) return 0.5;

  return 1.0;
}

export async function calculateProductionForecast(options: {
  period?: 'last_week' | 'last_2_weeks' | 'last_4_weeks';
  leadTimeDays?: number;
  safetyDays?: number;
  growthFactor?: number;
  manualOverrides?: Record<string, number>;
  forceRefresh?: boolean;
}): Promise<ForecastResponse> {
  const period = options.period || 'last_4_weeks';
  const leadTimeDays = Math.max(1.0, options.leadTimeDays ?? 2.5);
  const safetyDays = Math.max(1.0, options.safetyDays ?? 2.5);
  const growthFactor = Math.max(0.2, options.growthFactor ?? 1.0);
  const manualOverrides = options.manualOverrides || {};

  // Check file cache if not forceRefresh and no manual overrides
  if (!options.forceRefresh && Object.keys(manualOverrides).length === 0 && fs.existsSync(FORECAST_CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(FORECAST_CACHE_FILE, 'utf8'));
      const cacheAgeMs = Date.now() - new Date(cached.fechaCalculo).getTime();
      if (
        cacheAgeMs < 10 * 60 * 1000 &&
        cached.periodType === period &&
        cached.leadTimeDays === leadTimeDays &&
        cached.growthFactor === growthFactor
      ) {
        return cached;
      }
    } catch (e) {
      // ignore cache error
    }
  }

  // 1. Determine date range in Odoo
  const now = new Date();
  let daysBack = 28;
  let dividerWeeks = 4.0;
  let periodLabel = 'Últimas 4 Semanas (Promedio Semanal)';

  if (period === 'last_week') {
    daysBack = 7;
    dividerWeeks = 1.0;
    periodLabel = 'Última Semana (7 Días)';
  } else if (period === 'last_2_weeks') {
    daysBack = 14;
    dividerWeeks = 2.0;
    periodLabel = 'Últimas 2 Semanas (Promedio Semanal)';
  }

  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString().slice(0, 10);

  // 2. Fetch sales from Odoo pos.order.line
  let linesGrouped: any[] = [];
  try {
    linesGrouped = await executeKw('pos.order.line', 'read_group', [
      [['create_date', '>=', startDateStr]],
      ['qty:sum', 'price_subtotal_incl:sum'],
      ['product_id'],
      0,
      250,
      'qty desc'
    ]);
  } catch (err: any) {
    console.warn('[productionForecastService] Could not fetch Odoo sales:', err.message);
  }

  // 3. Load Production Config & SKUs
  const config = getProductionConfig();
  const configuredSkusMap = new Map<string, any>();
  (config.skus || []).forEach((s: any) => {
    configuredSkusMap.set(s.product.trim().toLowerCase(), s);
  });

  // Filter out non-dairy items (Abarrotes, cecina, refrescos, dulces)
  const nonDairyKeywords = [
    'cecina', 'cesina', 'galleta', 'dulce', 'besos', 'chimirica', 'salsa', 
    'aderezo', 'refresco', 'agua', 'schweppes', 'bimbo', 'tortilla', 'tostada'
  ];

  // 4. Map & calculate demand per product
  const productDemands: ProductDemandItem[] = [];

  (linesGrouped || []).forEach((lg: any) => {
    if (!lg.product_id) return;
    const prodId = lg.product_id[0];
    const prodName = lg.product_id[1] || '';
    const norm = prodName.trim().toLowerCase();

    // Skip non-dairy
    if (nonDairyKeywords.some(kw => norm.includes(kw))) return;

    const skuMatch = configuredSkusMap.get(norm);
    const category = skuMatch?.category || 'Otros Lácteos';
    const cleanCat = cleanCategoryName(category);

    // Resolve weight
    let pesoUnitarioKg = (skuMatch && Number(skuMatch.peso) > 0) ? Number(skuMatch.peso) : parseWeightFromTitle(prodName);
    if (!pesoUnitarioKg || pesoUnitarioKg <= 0) pesoUnitarioKg = 1.0;

    // Pieces sold per week (normalized by dividerWeeks)
    const totalPiecesPeriod = Number(lg.qty) || 0;
    const piezasSemanalesBase = Math.round(totalPiecesPeriod / dividerWeeks);
    const montoVentaBase = Math.round((Number(lg.price_subtotal_incl) || 0) / dividerWeeks);

    if (piezasSemanalesBase <= 0) return;

    // Projected pieces with growthFactor or manualOverride
    const override = manualOverrides[prodId] ?? manualOverrides[prodName];
    const piezasSemanalesProyectadas = override !== undefined 
      ? Math.round(Number(override))
      : Math.round(piezasSemanalesBase * growthFactor);

    const kgSemanalesProyectados = Number((piezasSemanalesProyectadas * pesoUnitarioKg).toFixed(2));

    productDemands.push({
      productId: prodId,
      productName: prodName,
      category,
      cleanCategory: cleanCat,
      pesoUnitarioKg,
      piezasSemanalesBase,
      piezasSemanalesProyectadas,
      kgSemanalesProyectados,
      montoVentaBase,
      empaques: skuMatch?.empaques || [],
      etiqueta: skuMatch?.etiqueta || '',
      adicionales: skuMatch?.adicionales || [],
      porcentajeCategoria: 0
    });
  });

  // Total kg of all products
  const totalKgAll = productDemands.reduce((sum, p) => sum + p.kgSemanalesProyectados, 0);

  // 5. Group by Category
  const categoryMap = new Map<string, {
    categoria: string;
    cleanCategoria: string;
    kgProyectados: number;
    piezasProyectadas: number;
    productos: ProductDemandItem[];
  }>();

  productDemands.forEach(p => {
    const key = p.cleanCategory;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        categoria: p.category,
        cleanCategoria: key,
        kgProyectados: 0,
        piezasProyectadas: 0,
        productos: []
      });
    }
    const cat = categoryMap.get(key)!;
    cat.kgProyectados += p.kgSemanalesProyectados;
    cat.piezasProyectadas += p.piezasSemanalesProyectadas;
    cat.productos.push(p);
  });

  // Calculate percentages and milk yield per category
  let totalLitrosLeche = 0;
  const productionByCategory: CategoryProductionForecast[] = Array.from(categoryMap.values()).map(cat => {
    cat.kgProyectados = Number(cat.kgProyectados.toFixed(2));
    const porcentajeDelTotal = totalKgAll > 0 ? Number(((cat.kgProyectados / totalKgAll) * 100).toFixed(1)) : 0;

    // Detect milk yield
    const normKey = cat.cleanCategoria.toLowerCase();
    let rendimiento = 9.0;
    for (const [k, y] of Object.entries(LECHE_YIELDS_BY_CAT)) {
      if (normKey.includes(k)) {
        rendimiento = y;
        break;
      }
    }

    const litrosLeche = Math.round(cat.kgProyectados * rendimiento);
    totalLitrosLeche += litrosLeche;

    // Update product category percentages
    cat.productos.forEach(prod => {
      prod.porcentajeCategoria = cat.kgProyectados > 0 
        ? Number(((prod.kgSemanalesProyectados / cat.kgProyectados) * 100).toFixed(1))
        : 0;
    });

    // Sort products by kg desc
    cat.productos.sort((a, b) => b.kgSemanalesProyectados - a.kgSemanalesProyectados);

    return {
      categoria: cat.categoria,
      cleanCategoria: cat.cleanCategoria,
      kgProyectados: cat.kgProyectados,
      piezasProyectadas: cat.piezasProyectadas,
      porcentajeDelTotal,
      litrosLecheRequeridos: litrosLeche,
      rendimientoLitrosPorKg: rendimiento,
      productos: cat.productos
    };
  });

  // Sort categories by kg desc
  productionByCategory.sort((a, b) => b.kgProyectados - a.kgProyectados);

  // 6. Insumos Explosion (BOM) & Inventory Comparison
  const suppliesInventory = getSuppliesInventory();
  const currentStockMap = new Map<string, any>();
  (suppliesInventory.supplies || []).forEach(s => {
    currentStockMap.set(s.nombre.trim().toLowerCase(), s);
  });

  // Requirements map
  const requirementsMap = new Map<string, {
    nombre: string;
    tipo: 'ingrediente' | 'empaque' | 'etiqueta';
    unidadBase: string;
    consumoSemanal: number;
    usadoEnCategorias: Set<string>;
  }>();

  const addRequirement = (
    nombre: string,
    tipo: 'ingrediente' | 'empaque' | 'etiqueta',
    unidadBase: string,
    cantidad: number,
    categoria: string
  ) => {
    if (!nombre || cantidad <= 0) return;
    const norm = nombre.trim().toLowerCase();
    if (!requirementsMap.has(norm)) {
      requirementsMap.set(norm, {
        nombre: nombre.trim(),
        tipo,
        unidadBase,
        consumoSemanal: 0,
        usadoEnCategorias: new Set()
      });
    }
    const item = requirementsMap.get(norm)!;
    item.consumoSemanal += cantidad;
    item.usadoEnCategorias.add(categoria);
  };

  // 6.1 Milk requirement
  addRequirement('Leche Entera de Vaca', 'ingrediente', 'lt', totalLitrosLeche, 'Todas las tinas');

  // 6.2 Raw Ingredients from category volume
  productionByCategory.forEach(cat => {
    const kgCat = cat.kgProyectados;
    const catNorm = cat.cleanCategoria.toLowerCase();

    // Check applicable ingredients from config
    (config.ingredients || []).forEach((ing: any) => {
      if (!ing.isIngredient) return;
      const ingNorm = ing.name.trim().toLowerCase();

      // Check applicable categories
      const applies = (ing.applicableCategories || []).some((ac: string) => {
        const cleanAc = cleanCategoryName(ac).toLowerCase();
        return catNorm.includes(cleanAc) || cleanAc.includes(catNorm);
      });

      if (applies) {
        // Dosage calculation
        let dosage = INGREDIENTS_DOSAGE_PER_KG[ingNorm] || 0.002; // default 2g/kg
        if (ingNorm.includes('sal')) dosage = 0.022;
        if (ingNorm.includes('cloruro')) dosage = 0.0025;
        if (ingNorm.includes('cuajo')) dosage = 0.0003;
        if (ingNorm.includes('ácido') || ingNorm.includes('acido')) dosage = 0.0018;
        if (ingNorm.includes('benzoato')) dosage = 0.0005;

        const needed = kgCat * dosage;
        addRequirement(ing.name, 'ingrediente', ing.baseUnit || 'kg', needed, cat.cleanCategoria);
      }
    });
  });

  // 6.3 Packaging & Labels from SKUs
  productDemands.forEach(p => {
    const pieces = p.piezasSemanalesProyectadas;
    if (pieces <= 0) return;

    // Empaques
    (p.empaques || []).forEach(emp => {
      if (emp) {
        addRequirement(emp, 'empaque', 'pz', pieces, p.cleanCategory);
      }
    });

    // Etiqueta
    if (p.etiqueta) {
      addRequirement(p.etiqueta, 'etiqueta', 'pz', pieces, p.cleanCategory);
    }
  });

  // 7. Calculate Supplies & Purchases Planning (Lead time 2.5 days, weekly cycle)
  const suppliesForecast: SupplyRequirementItem[] = [];

  requirementsMap.forEach((req) => {
    const norm = req.nombre.trim().toLowerCase();
    const stockInfo = currentStockMap.get(norm);

    // Cost & Provider
    const configIng = (config.ingredients || []).find((i: any) => i.name.trim().toLowerCase() === norm);
    const unitCost = Number(stockInfo?.costoUnitario) || Number(configIng?.unitCost) || 0;
    const proveedor = stockInfo?.proveedor || configIng?.provider || 'TASSA';
    const presentacionCompra = configIng?.empaquePresentation || stockInfo?.unidadBase || req.unidadBase;

    // Consumption & Safety calculations
    const consumoSemanal = Number(req.consumoSemanal.toFixed(2));
    const consumoDiario = Number((consumoSemanal / 7).toFixed(2));

    // Stock de seguridad = Consumo diario * Días de entrega del proveedor (2 a 3 días)
    const stockSeguridad = Number((consumoDiario * safetyDays).toFixed(2));

    // Abasto mínimo requerido para el ciclo semanal completo = Consumo semanal + Stock de seguridad
    const abastoMinimoCiclo = Number((consumoSemanal + stockSeguridad).toFixed(2));

    const stockActual = Number((stockInfo?.stockActual || 0).toFixed(2));

    // Días de cobertura (mínimo 0)
    const diasCobertura = consumoDiario > 0 
      ? Number(Math.max(0, stockActual / consumoDiario).toFixed(1)) 
      : 999;

    // Estatus de abasto
    let estatusAbasto: 'critico' | 'riesgo' | 'optimo' = 'optimo';
    let estatusLabel = 'Abasto Garantizado';

    if (diasCobertura < leadTimeDays) {
      estatusAbasto = 'critico';
      estatusLabel = 'Desabasto Inminente (< 3 días)';
    } else if (diasCobertura < (7.0 + leadTimeDays)) {
      estatusAbasto = 'riesgo';
      estatusLabel = 'Reorden Semanal Necesario';
    }

    // Compra sugerida
    let compraSugerida = 0;
    if (stockActual < abastoMinimoCiclo) {
      const faltanteNeto = abastoMinimoCiclo - stockActual;

      // Si tiene empaque definido (ej. saco de 50kg, caja de 1000)
      const packSize = configIng?.empaqueCost && configIng?.empaquePresentation
        ? parseFloat(configIng.empaquePresentation.match(/(\d+(?:\.\d+)?)/)?.[1] || '1')
        : 1;

      if (packSize > 1) {
        const bultos = Math.ceil(faltanteNeto / packSize);
        compraSugerida = bultos * packSize;
      } else {
        compraSugerida = req.tipo === 'ingrediente' ? Math.ceil(faltanteNeto) : Math.ceil(faltanteNeto);
      }
    }

    const costoEstimadoCompra = Number((compraSugerida * unitCost).toFixed(2));

    let tipoLabel = 'Materia Prima / Insumo';
    if (req.tipo === 'empaque') tipoLabel = 'Empaque / Contenedor';
    if (req.tipo === 'etiqueta') tipoLabel = 'Etiqueta';

    suppliesForecast.push({
      nombre: req.nombre,
      tipo: req.tipo,
      tipoLabel,
      unidadBase: req.unidadBase,
      proveedor,
      costoUnitario: unitCost,
      stockActual,
      consumoSemanal,
      consumoDiario,
      stockSeguridad,
      abastoMinimoCiclo,
      diasCobertura,
      estatusAbasto,
      estatusLabel,
      compraSugerida,
      presentacionCompra,
      costoEstimadoCompra,
      usadoEnCategorias: Array.from(req.usadoEnCategorias)
    });
  });

  // Sort supplies: Criticos first, then Riesgo, then by consumption
  suppliesForecast.sort((a, b) => {
    const prio = { critico: 0, riesgo: 1, optimo: 2 };
    if (prio[a.estatusAbasto] !== prio[b.estatusAbasto]) {
      return prio[a.estatusAbasto] - prio[b.estatusAbasto];
    }
    return b.consumoSemanal - a.consumoSemanal;
  });

  // 8. Group Purchases by Provider
  const providerMap = new Map<string, ProviderPurchaseSummary>();

  suppliesForecast.forEach(item => {
    const prov = item.proveedor || 'TASSA';
    if (!providerMap.has(prov)) {
      providerMap.set(prov, {
        proveedor: prov,
        totalItems: 0,
        itemsRequeridos: 0,
        itemsCriticos: 0,
        itemsRiesgo: 0,
        costoTotalOrden: 0,
        items: []
      });
    }
    const summary = providerMap.get(prov)!;
    summary.totalItems++;
    if (item.compraSugerida > 0) {
      summary.itemsRequeridos++;
      summary.costoTotalOrden += item.costoEstimadoCompra;
    }
    if (item.estatusAbasto === 'critico') summary.itemsCriticos++;
    if (item.estatusAbasto === 'riesgo') summary.itemsRiesgo++;
    summary.items.push(item);
  });

  const purchasesByProvider: ProviderPurchaseSummary[] = Array.from(providerMap.values());
  purchasesByProvider.sort((a, b) => b.costoTotalOrden - a.costoTotalOrden);

  // 9. KPIs
  const totalPiezas = productDemands.reduce((sum, p) => sum + p.piezasSemanalesProyectadas, 0);
  const totalInsumosAlerta = suppliesForecast.filter(s => s.estatusAbasto !== 'optimo').length;
  const costoTotalCompras = suppliesForecast.reduce((sum, s) => sum + s.costoEstimadoCompra, 0);

  const activeDaysList = suppliesForecast.filter(s => s.diasCobertura >= 0 && s.diasCobertura < 900).map(s => s.diasCobertura);
  const coberturaPromedioDias = activeDaysList.length > 0 
    ? Number(Math.max(0, activeDaysList.reduce((a, b) => a + b, 0) / activeDaysList.length).toFixed(1))
    : 7.0;

  const result: ForecastResponse = {
    periodType: period,
    periodLabel,
    leadTimeDays,
    safetyDays,
    growthFactor,
    fechaCalculo: new Date().toISOString(),
    kpis: {
      totalKgProduccion: Number(totalKgAll.toFixed(2)),
      totalPiezasProduccion: totalPiezas,
      totalLitrosLeche,
      totalCategorias: productionByCategory.length,
      totalProductosActivos: productDemands.length,
      totalInsumosAlerta,
      costoTotalComprasSugeridas: Number(costoTotalCompras.toFixed(2)),
      coberturaPromedioDias
    },
    productionByCategory,
    suppliesForecast,
    purchasesByProvider,
    manualOverrides
  };

  // Save to cache file
  try {
    fs.writeFileSync(FORECAST_CACHE_FILE, JSON.stringify(result, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }

  return result;
}
