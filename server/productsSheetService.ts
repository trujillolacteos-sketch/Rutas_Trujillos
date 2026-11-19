import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';
import { executeKw } from './odoo.ts';
import { getProductionConfig, saveProductionConfig } from './productionService.ts';

const SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const SHEET_NAME = 'Catalogo_Productos';
const CACHE_FILE = path.join(process.cwd(), 'odoo_products_cache.json');

const HEADERS = [
  'ID Odoo',
  'Código / Ref',
  'Producto',
  'Categoría Odoo (categ_id)',
  'Categoría Limpia',
  'Peso Unitario (Kg)',
  'Precio Venta ($)',
  'Costo Estándar ($)',
  'Empaques',
  'Etiqueta',
  'Estatus',
  'Última Actualización'
];

export interface SyncedProductItem {
  id: number;
  name: string;
  defaultCode: string;
  odooCategory: string;
  cleanCategory: string;
  weight: number;
  price: number;
  cost: number;
  empaques: string[];
  etiqueta: string;
  active: boolean;
  updatedAt: string;
}

/**
 * Limpia y normaliza el nombre de la categoría para agrupar
 */
export function cleanCategoryName(name: string): string {
  if (!name) return 'Otros Lácteos';
  let clean = name
    .replace(/^All\s*\/\s*Quesos\s*\/\s*/i, '')
    .replace(/^All\s*\/\s*Jocoque\s*\/\s*/i, 'Jocoque')
    .replace(/^All\s*\/\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.toLowerCase() === 'all' || !clean) return 'Otros Lácteos';
  return clean;
}

/**
 * Infiere categoría del nombre si en Odoo viene vacía o genérica 'All'
 */
export function inferCategoryFromName(productName: string): string | null {
  const norm = (productName || '').toLowerCase();
  if (norm.includes('mozzarella')) return 'Mozzarella';
  if (norm.includes('panela')) return 'Panela';
  if (norm.includes('adobera')) return 'Adobera';
  if (norm.includes('oaxaca')) return 'Oaxaca';
  if (norm.includes('asadero')) return 'Asadero';
  if (norm.includes('crema')) return 'Crema';
  if (norm.includes('jocoque')) return 'Jocoque';
  if (norm.includes('chihuahua')) return 'Chihuahua';
  if (norm.includes('cheddar')) return 'Cheddar';
  if (norm.includes('manchego')) return 'Manchego';
  if (norm.includes('fresco') || norm.includes('ranchero')) return 'Fresco';
  if (norm.includes('cotija')) return 'Cotija';
  if (norm.includes('requeson') || norm.includes('requesón')) return 'Requesón';
  if (norm.includes('pizzero')) return 'Pizzero';
  if (norm.includes('mantequilla')) return 'Mantequilla';
  return null;
}

/**
 * Obtiene el peso en Kg desde el título si weight viene en 0
 */
export function parseWeightFromTitle(title: string): number {
  const lower = (title || '').toLowerCase();
  const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/);
  if (kgMatch) return parseFloat(kgMatch[1]);

  const gMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos?)/);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;

  const lMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litro?s?)/);
  if (lMatch) return parseFloat(lMatch[1]);

  const mlMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ml|mililitros?)/);
  if (mlMatch) return parseFloat(mlMatch[1]) / 1000;

  if (lower.includes('1/4') || lower.includes('cuarto')) return 0.25;
  if (lower.includes('1/2') || lower.includes('medio')) return 0.5;

  return 1.0;
}

/**
 * Asegura que la pestaña Catalogo_Productos exista en Google Sheets
 */
async function ensureProductsSheetExists(token: string): Promise<boolean> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta: any = await metaRes.json();
    const titles = (meta.sheets || []).map((s: any) => s.properties?.title);

    if (!titles.includes(SHEET_NAME)) {
      console.log(`[productsSheetService] Creando pestaña "${SHEET_NAME}" en Google Sheets...`);
      const addRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SHEET_NAME,
                    gridProperties: { rowCount: 500, columnCount: 15 }
                  }
                }
              }
            ]
          })
        }
      );
      if (!addRes.ok) {
        console.error('[productsSheetService] Error creando pestaña:', await addRes.text());
        return false;
      }

      // Escribir fila de encabezados
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:L1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [HEADERS] })
        }
      );
    }
    return true;
  } catch (err) {
    console.error('[productsSheetService] ensureProductsSheetExists error:', err);
    return false;
  }
}

/**
 * Guarda en caché local JSON
 */
export function saveLocalProductsCache(products: SyncedProductItem[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      updatedAt: new Date().toISOString(),
      count: products.length,
      products
    }, null, 2), 'utf8');
  } catch (e) {
    console.warn('[productsSheetService] Error saving local cache:', e);
  }
}

/**
 * Carga desde caché local JSON
 */
export function loadLocalProductsCache(): SyncedProductItem[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return data.products || [];
    }
  } catch (e) {
    console.warn('[productsSheetService] Error reading local cache:', e);
  }
  return [];
}

/**
 * Consulta Odoo ERP en vivo para extraer todos los productos lácteos con su categoría real (categ_id),
 * peso y datos técnicos.
 */
export async function fetchLiveOdooDairyProducts(): Promise<SyncedProductItem[]> {
  const categories = await executeKw('product.category', 'search_read', [[]], {
    fields: ['id', 'name', 'complete_name'],
    limit: 150
  });

  const dairyKeywords = ['queso', 'crema', 'jocoque', 'yogurt', 'pizzero', 'adobera', 'mantequilla'];
  const excludedKeywords = [
    'abarrote', 'dulce', 'cecina', 'cesina', 'bebida', 'galleta', 
    'embutido', 'bimbo', 'desechable', 'embazado', 'mayonesa', 
    'pan', 'tortilla', 'tostada', 'salsa', 'material', 'expense', 'saleable'
  ];

  const prodCategories = (categories || []).filter((c: any) => {
    const name = (c.complete_name || '').toLowerCase();
    const isExcluded = excludedKeywords.some(ex => name.includes(ex));
    if (isExcluded) return false;
    return dairyKeywords.some(kw => name.includes(kw));
  });

  const catIds = prodCategories.map((c: any) => c.id);

  // Consultar todos los productos vendibles en esas categorías
  const odooProducts = await executeKw('product.product', 'search_read', [
    [
      ['sale_ok', '=', true],
      ['categ_id', 'in', catIds]
    ]
  ], {
    fields: ['id', 'name', 'default_code', 'categ_id', 'list_price', 'standard_price', 'weight'],
    limit: 500
  });

  // Cargar configuración existente para cruzar empaques y etiquetas
  const cfg = getProductionConfig();
  const configuredMap = new Map<string, any>();
  (cfg.skus || []).forEach((s: any) => {
    configuredMap.set(s.product.trim().toLowerCase(), s);
  });

  const nowIso = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const validProducts = (odooProducts || []).filter((p: any) => {
    const n = (p.name || '').toLowerCase();
    return !n.includes('% de descuento') && !n.includes('por punto');
  });

  const items: SyncedProductItem[] = validProducts.map((p: any) => {
    const normName = p.name.trim().toLowerCase();
    const configMatch = configuredMap.get(normName);

    // 1. Categoría Odoo real
    let odooCat = p.categ_id ? p.categ_id[1] : '';
    let cleanCat = cleanCategoryName(odooCat);

    // 2. Si en Odoo venía sin categoría o 'All', inferir por nombre
    if (!odooCat || cleanCat === 'Otros Lácteos') {
      const inferred = inferCategoryFromName(p.name);
      if (inferred) {
        cleanCat = inferred;
        odooCat = `All / Quesos / ${inferred}`;
      } else if (configMatch?.category) {
        odooCat = configMatch.category;
        cleanCat = cleanCategoryName(odooCat);
      }
    }

    // 3. Resolver peso
    let weight = (configMatch && Number(configMatch.peso) > 0)
      ? Number(configMatch.peso)
      : (Number(p.weight) || 0);

    if (weight <= 0) {
      weight = parseWeightFromTitle(p.name);
    }

    return {
      id: p.id,
      name: p.name.trim(),
      defaultCode: p.default_code || '',
      odooCategory: odooCat || 'Sin Categoría',
      cleanCategory: cleanCat,
      weight,
      price: Number(p.list_price) || 0,
      cost: Number(p.standard_price) || 0,
      empaques: configMatch?.empaques || [],
      etiqueta: configMatch?.etiqueta || '',
      active: true,
      updatedAt: nowIso
    };
  });

  // Guardar en caché local inmediatamente
  saveLocalProductsCache(items);

  // Asegurar que todos los SKUs estén en productionConfig.json para que ninguna consulta falle
  let configChanged = false;
  items.forEach(item => {
    const norm = item.name.toLowerCase();
    const existingSku = (cfg.skus || []).find((s: any) => s.product.trim().toLowerCase() === norm);
    if (!existingSku) {
      cfg.skus = cfg.skus || [];
      cfg.skus.push({
        product: item.name,
        category: item.odooCategory,
        peso: item.weight,
        empaques: item.empaques,
        etiqueta: item.etiqueta,
        adicionales: []
      });
      configChanged = true;
    } else {
      // Si el existente decía 'Otros Lácteos' o 'Sin Categoría', actualizarlo con la categoría real de Odoo
      if (
        item.odooCategory &&
        (!existingSku.category || existingSku.category.includes('Otros') || existingSku.category.includes('Sin'))
      ) {
        existingSku.category = item.odooCategory;
        if (!existingSku.peso || existingSku.peso <= 0) existingSku.peso = item.weight;
        configChanged = true;
      }
    }
  });

  if (configChanged) {
    saveProductionConfig(cfg);
    console.log('[productsSheetService] productionConfig.json actualizado con nuevos SKUs y categorías reales de Odoo.');
  }

  return items;
}

/**
 * Sincroniza la lista de productos hacia la hoja Catalogo_Productos en Google Sheets
 */
export async function syncProductsToGoogleSheet(products?: SyncedProductItem[]): Promise<{
  success: boolean;
  count: number;
  sheetUrl: string;
}> {
  try {
    const token = await getGoogleAccessToken();
    const exists = await ensureProductsSheetExists(token);
    if (!exists) throw new Error('No se pudo acceder o crear la pestaña Catalogo_Productos');

    const items = products && products.length > 0 ? products : await fetchLiveOdooDairyProducts();

    // Preparar filas para Sheets
    const rows = items.map(p => [
      p.id,
      p.defaultCode,
      p.name,
      p.odooCategory,
      p.cleanCategory,
      p.weight,
      p.price,
      p.cost,
      (p.empaques || []).join(', '),
      p.etiqueta || '',
      p.active ? 'ACTIVO' : 'INACTIVO',
      p.updatedAt
    ]);

    // Limpiar rango existente (desde A2 hacia abajo)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:L600:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    // Escribir filas actualizadas
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      }
    );

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`Error escribiendo en Catalogo_Productos: ${errText}`);
    }

    console.log(`[productsSheetService] ${items.length} productos sincronizados exitosamente a Catalogo_Productos en Google Sheets.`);
    return {
      success: true,
      count: items.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`
    };
  } catch (err: any) {
    console.error('[productsSheetService] syncProductsToGoogleSheet error:', err.message);
    throw err;
  }
}

/**
 * Carga productos desde Google Sheets si Odoo no está disponible
 */
export async function loadProductsFromGoogleSheet(): Promise<SyncedProductItem[]> {
  try {
    const token = await getGoogleAccessToken();
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:L500`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return loadLocalProductsCache();

    const data: any = await res.json();
    const rows = data.values || [];
    if (rows.length === 0) return loadLocalProductsCache();

    return rows.map((r: any[]) => ({
      id: Number(r[0]) || 0,
      defaultCode: r[1] || '',
      name: r[2] || '',
      odooCategory: r[3] || 'Sin Categoría',
      cleanCategory: r[4] || cleanCategoryName(r[3]),
      weight: Number(r[5]) || 1.0,
      price: Number(r[6]) || 0,
      cost: Number(r[7]) || 0,
      empaques: r[8] ? String(r[8]).split(',').map(s => s.trim()) : [],
      etiqueta: r[9] || '',
      active: r[10] === 'ACTIVO',
      updatedAt: r[11] || ''
    }));
  } catch (e) {
    console.warn('[productsSheetService] Fallback to local cache due to sheets error:', e);
    return loadLocalProductsCache();
  }
}

/**
 * Obtiene el mapa maestro de productos (Odoo en vivo -> Google Sheets -> Caché local)
 */
export async function getMasterProductsCatalog(forceRefresh = false): Promise<Map<string, SyncedProductItem>> {
  let list: SyncedProductItem[] = [];

  if (!forceRefresh) {
    list = loadLocalProductsCache();
  }

  if (list.length === 0 || forceRefresh) {
    try {
      list = await fetchLiveOdooDairyProducts();
      // Enviar asíncronamente a Google Sheets
      syncProductsToGoogleSheet(list).catch(e => console.warn('Non-fatal error syncing to sheets:', e.message));
    } catch (odooErr: any) {
      console.warn('[productsSheetService] Odoo no respondió, cargando respaldo de Google Sheets...', odooErr.message);
      list = await loadProductsFromGoogleSheet();
    }
  }

  const map = new Map<string, SyncedProductItem>();
  list.forEach(p => {
    map.set(p.name.trim().toLowerCase(), p);
    map.set(`id_${p.id}`, p);
  });

  return map;
}

/**
 * Actualiza un producto específico desde Odoo
 */
export async function syncSingleProductFromOdoo(query: string | number): Promise<SyncedProductItem | null> {
  let domain: any[] = [];
  if (typeof query === 'number' || !isNaN(Number(query))) {
    domain = [['id', '=', Number(query)]];
  } else {
    domain = [['name', 'ilike', String(query).trim()]];
  }

  const results = await executeKw('product.product', 'search_read', [domain], {
    fields: ['id', 'name', 'default_code', 'categ_id', 'list_price', 'standard_price', 'weight'],
    limit: 1
  });

  if (!results || results.length === 0) return null;
  const p = results[0];

  let odooCat = p.categ_id ? p.categ_id[1] : '';
  let cleanCat = cleanCategoryName(odooCat);
  if (!odooCat || cleanCat === 'Otros Lácteos') {
    const inf = inferCategoryFromName(p.name);
    if (inf) {
      cleanCat = inf;
      odooCat = `All / Quesos / ${inf}`;
    }
  }

  let weight = Number(p.weight) || parseWeightFromTitle(p.name);

  const updatedItem: SyncedProductItem = {
    id: p.id,
    name: p.name.trim(),
    defaultCode: p.default_code || '',
    odooCategory: odooCat || 'Sin Categoría',
    cleanCategory: cleanCat,
    weight,
    price: Number(p.list_price) || 0,
    cost: Number(p.standard_price) || 0,
    empaques: [],
    etiqueta: '',
    active: true,
    updatedAt: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  };

  // Actualizar en caché local
  const current = loadLocalProductsCache();
  const idx = current.findIndex(x => x.id === p.id || x.name.toLowerCase() === p.name.toLowerCase());
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...updatedItem };
  } else {
    current.push(updatedItem);
  }
  saveLocalProductsCache(current);

  // Actualizar en productionConfig.json
  const cfg = getProductionConfig();
  const sku = (cfg.skus || []).find((s: any) => s.product.trim().toLowerCase() === p.name.trim().toLowerCase());
  if (sku) {
    sku.category = odooCat;
    sku.peso = weight;
  } else {
    cfg.skus = cfg.skus || [];
    cfg.skus.push({
      product: p.name.trim(),
      category: odooCat,
      peso: weight,
      empaques: [],
      etiqueta: '',
      adicionales: []
    });
  }
  saveProductionConfig(cfg);

  // Sincronizar catálogo a Google Sheets
  syncProductsToGoogleSheet(current).catch(e => console.warn('Error syncing single product to sheets:', e));

  return updatedItem;
}
