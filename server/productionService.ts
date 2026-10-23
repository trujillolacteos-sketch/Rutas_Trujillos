import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { executeKw } from './odoo.ts';
import { getGoogleAccessToken } from './googleCredentials.ts';

const NEW_SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const KEY_FILE = 'google-drive-key.json';
const CONFIG_FILE = 'server/productionConfig.json';
const PRODUCTION_STORE_FILE = 'production_store.json';
const PACKAGING_STORE_FILE = 'packaging_store.json';
const PURCHASES_STORE_FILE = 'purchases_store.json';

// Interfaces
export interface PurchaseRecord {
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
  unidadBase: 'kg' | 'lt' | 'pz' | 'un' | string;
  totalUnidadesBase: number;
  costoTotal: number;
  subtotal?: number;
  impuestoTipo?: 'sin_iva' | 'mas_iva' | 'iva_incluido' | string;
  montoIva?: number;
  costoPorEmpaque: number;
  costoUnitarioBase: number;
  costoAnteriorBase?: number;
  notas?: string;
}
export interface ProductionBatch {
  id: string;
  fechaProduccion: string;
  fechaCaptura: string;
  categoria: string;
  lote: string;
  kgTotal: number;
  costoTotal: number;
  costoPorKg: number;
  ajusteCrema: number;
  loteCremaAsociado?: string;
  registrosInsumos: {
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
  }[];
}

export interface PackagingItem {
  producto: string;
  display: string;
  peso: number;
  piezas: number;
  kg: number;
  costoBase: number;
  costoAdicional: number;
  costoEmpaque: number;
  costoEtiqueta: number;
  costoTotal: number;
  costoPieza: number;
  aprovechamientoLinea: number;
}

export interface PackagingBatch {
  id: string;
  fechaProduccion: string;
  fechaEmpaque: string;
  fechaCaptura: string;
  categoria: string;
  lote: string;
  loteKgTotal: number;
  kgCapturados: number;
  aprovechamientoTotal: number;
  items: PackagingItem[];
  adicionalesKg: Record<string, number>;
}

// Append Rows to Google Sheet
async function appendRowsToSheet(sheetName: string, rows: any[][]): Promise<{ success: boolean; updatedRows?: number; error?: string }> {
  try {
    const token = await getGoogleAccessToken();
    const encodedSheet = encodeURIComponent(sheetName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${encodedSheet}!A1:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: rows
      })
    });
    const data: any = await res.json();
    if (data.updates) {
      console.log(`[Google Sheets] ${rows.length} renglón(es) insertado(s) con éxito en ${sheetName}.`);
      return { success: true, updatedRows: data.updates.updatedRows || rows.length };
    } else {
      console.warn(`[Google Sheets] Advertencia al insertar en ${sheetName}:`, data);
      return { success: false, error: data.error?.message || 'No se registraron actualizaciones en la hoja' };
    }
  } catch (err: any) {
    console.error(`[Google Sheets] Error conectando con Google Sheets (${sheetName}):`, err.message);
    return { success: false, error: err.message };
  }
}

// 1. Production Config (Categories, Ingredients, SKUs)
export function getProductionConfig(): any {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  return { categories: [], ingredients: [], skus: [] };
}

// Update Master Costs & Sync to Google Sheet 'Costos' tab
export async function updateProductionCosts(updatedIngredients: any[]): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const config = getProductionConfig();
    config.ingredients = updatedIngredients;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');

    // Sincronizar con Google Sheets pestaña Costos (Borrar anterior y escribir nuevo)
    const token = await getGoogleAccessToken();
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/Costos!A2:E:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });

    const rows = updatedIngredients.map(ing => {
      const empaqueCostNum = Number(ing.empaqueCost) || 0;
      const unitCostNum = Number(ing.unitCost) || 0;
      const empaqueCostStr = empaqueCostNum > 0 
        ? `$${empaqueCostNum.toFixed(2)}` 
        : (unitCostNum > 0 ? `$${unitCostNum.toFixed(2)}` : '$0.00');
      const unitCostStr = unitCostNum > 0
        ? (unitCostNum < 1 ? `$${unitCostNum.toFixed(4)}` : `$${unitCostNum.toFixed(2)}`)
        : '$0.00';
      return [
        ing.name,
        ing.empaquePresentation || ing.empaque || '1',
        empaqueCostStr,
        unitCostStr,
        ing.provider || ''
      ];
    });

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/Costos!A2:E?valueInputOption=USER_ENTERED`;
    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    const writeData = await writeRes.json();
    console.log('[Google Sheets] Pestaña Costos actualizada exitosamente:', writeData.updatedRows, 'renglones.');

    return {
      success: true,
      message: `¡Catálogo de ${rows.length} costos actualizado con éxito y sincronizado en Google Sheets!`,
      count: rows.length
    };
  } catch (err: any) {
    console.error('Error updating production costs:', err);
    return { success: false, message: err.message };
  }
}

// 2. Local Storage for Production & Packaging
export function loadLocalProduction(): ProductionBatch[] {
  if (fs.existsSync(PRODUCTION_STORE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PRODUCTION_STORE_FILE, 'utf8'));
    } catch (e) {}
  }
  return [];
}

export function saveLocalProduction(records: ProductionBatch[]) {
  try {
    fs.writeFileSync(PRODUCTION_STORE_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving production_store.json', e);
  }
}

export function loadLocalPackaging(): PackagingBatch[] {
  if (fs.existsSync(PACKAGING_STORE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PACKAGING_STORE_FILE, 'utf8'));
    } catch (e) {}
  }
  return [];
}

export function saveLocalPackaging(records: PackagingBatch[]) {
  try {
    fs.writeFileSync(PACKAGING_STORE_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving packaging_store.json', e);
  }
}

export function loadLocalPurchases(): PurchaseRecord[] {
  if (fs.existsSync(PURCHASES_STORE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PURCHASES_STORE_FILE, 'utf8'));
    } catch (e) {}
  }
  return [];
}

export function saveLocalPurchases(records: PurchaseRecord[]) {
  try {
    fs.writeFileSync(PURCHASES_STORE_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving purchases_store.json', e);
  }
}

export interface PurchaseLineInput {
  itemNombre: string;
  isIngredient?: boolean;
  empaqueTipo: string;
  empaquesCantidad: number;
  contenidoPorEmpaque: number;
  unidadBase: string;
  costoTotal: number;
  subtotal?: number;
  impuestoTipo?: 'sin_iva' | 'mas_iva' | 'iva_incluido' | string;
  montoIva?: number;
  notas?: string;
}

// Record Purchase (Single or Multi-Line Invoice), convert to Base Unit ($/kg, $/lt, $/pz, $/un), update config & Google Sheets
export async function recordPurchase(data: {
  fechaCompra: string;
  folio?: string;
  proveedor?: string;
  notas?: string;
  itemNombre?: string;
  isIngredient?: boolean;
  empaqueTipo?: string;
  empaquesCantidad?: number;
  contenidoPorEmpaque?: number;
  unidadBase?: string;
  costoTotal?: number;
  lines?: PurchaseLineInput[];
}): Promise<{ success: boolean; message: string; purchase?: PurchaseRecord; purchases?: PurchaseRecord[] }> {
  try {
    const linesToProcess: PurchaseLineInput[] = [];
    if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
      linesToProcess.push(...data.lines);
    } else if (data.itemNombre) {
      linesToProcess.push({
        itemNombre: data.itemNombre,
        isIngredient: data.isIngredient ?? true,
        empaqueTipo: data.empaqueTipo || 'Saco',
        empaquesCantidad: Number(data.empaquesCantidad) || 1,
        contenidoPorEmpaque: Number(data.contenidoPorEmpaque) || 1,
        unidadBase: data.unidadBase || 'kg',
        costoTotal: Number(data.costoTotal) || 0,
        notas: data.notas || ''
      });
    } else {
      return { success: false, message: 'No se enviaron líneas de compra para registrar.' };
    }

    const config = getProductionConfig();
    if (!config.ingredients) config.ingredients = [];

    const newPurchases: PurchaseRecord[] = [];
    const timestamp = Date.now();

    for (let index = 0; index < linesToProcess.length; index++) {
      const line = linesToProcess[index];
      const empaquesCantidad = Number(line.empaquesCantidad) || 1;
      const contenidoPorEmpaque = Number(line.contenidoPorEmpaque) || 1;
      const totalUnidadesBase = empaquesCantidad * contenidoPorEmpaque;
      const costoTotal = Number(line.costoTotal) || 0;
      const costoPorEmpaque = empaquesCantidad > 0 ? costoTotal / empaquesCantidad : 0;
      const costoUnitarioBase = totalUnidadesBase > 0 ? costoTotal / totalUnidadesBase : 0;

      let existingItem = config.ingredients.find((i: any) =>
        i.name.trim().toLowerCase() === line.itemNombre.trim().toLowerCase()
      );

      const presentationStr = `${contenidoPorEmpaque} ${line.unidadBase} (${line.empaqueTipo})`;

      if (existingItem) {
        existingItem.unitCost = Number(costoUnitarioBase.toFixed(4));
        existingItem.empaquePresentation = presentationStr;
        existingItem.empaqueCost = Number(costoPorEmpaque.toFixed(2));
        existingItem.baseUnit = line.unidadBase;
        if (data.proveedor) existingItem.provider = data.proveedor;
      } else {
        const newItem = {
          name: line.itemNombre.trim(),
          unitCost: Number(costoUnitarioBase.toFixed(4)),
          isIngredient: line.isIngredient ?? true,
          applicableCategories: [],
          provider: data.proveedor || 'General',
          empaquePresentation: presentationStr,
          empaqueCost: Number(costoPorEmpaque.toFixed(2)),
          baseUnit: line.unidadBase
        };
        config.ingredients.unshift(newItem);
      }

      const purchaseRecord: PurchaseRecord = {
        id: `PUR-${timestamp}-${index}`,
        fechaCompra: data.fechaCompra,
        fechaCaptura: new Date().toISOString(),
        folio: data.folio || '',
        itemNombre: line.itemNombre.trim(),
        isIngredient: line.isIngredient ?? true,
        proveedor: data.proveedor || 'General',
        empaqueTipo: line.empaqueTipo,
        empaquesCantidad,
        contenidoPorEmpaque,
        unidadBase: line.unidadBase,
        totalUnidadesBase,
        costoTotal,
        subtotal: line.subtotal,
        impuestoTipo: line.impuestoTipo,
        montoIva: line.montoIva,
        costoPorEmpaque: Number(costoPorEmpaque.toFixed(2)),
        costoUnitarioBase: Number(costoUnitarioBase.toFixed(4)),
        costoAnteriorBase: existingItem ? existingItem.unitCost : undefined,
        notas: line.notas || data.notas || ''
      };

      newPurchases.push(purchaseRecord);
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');

    const purchases = loadLocalPurchases();
    purchases.unshift(...newPurchases);
    saveLocalPurchases(purchases);

    // Sync all updated costs to Google Sheets 'Costos' tab (clear and write)
    await updateProductionCosts(config.ingredients);

    const totalFactura = linesToProcess.reduce((sum, l) => sum + (Number(l.costoTotal) || 0), 0);

    return {
      success: true,
      message: `¡Factura registrada con éxito (${linesToProcess.length} líneas, Total: $${totalFactura.toFixed(2)} MXN)! Hoja Costos de Google Sheets actualizada.`,
      purchases: newPurchases,
      purchase: newPurchases[0]
    };
  } catch (err: any) {
    console.error('Error in recordPurchase:', err);
    return { success: false, message: err.message };
  }
}

// 3. Helper: Generate Batch Lot Code
export function generateLotCode(categoria: string, fechaStr: string): string {
  const base = categoria
    .replace(/All\s*\/\s*Quesos\s*\/\s*/i, '')
    .replace(/All\s*\/\s*/i, '')
    .replace(/All\//i, '')
    .substring(0, 4)
    .toLowerCase();

  const parts = fechaStr.split('-');
  const f = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const dayStr = ('0' + f.getDate()).slice(-2);
  const monthStr = ('0' + (f.getMonth() + 1)).slice(-2);
  const yearStr = f.getFullYear().toString().slice(-2);

  const loteBase = `${base}${dayStr}${monthStr}${yearStr}`;

  const existingBatches = loadLocalProduction();
  let maxSeq = 0;
  existingBatches.forEach(b => {
    if (b.lote && b.lote.startsWith(loteBase)) {
      const m = b.lote.match(/-(\d+)$/);
      if (m) {
        const seq = parseInt(m[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
  });

  return `${loteBase}-${('0' + (maxSeq + 1)).slice(-2)}`;
}

// 4. Save Production Batch (Dairy math + local store + Google Sheet append)
export async function createProductionBatch(data: {
  fechaProduccion: string;
  categoria: string;
  kgTotal: number;
  loteCrema?: string;
  insumos: { nombre: string; cantidad: number }[];
}): Promise<{ success: boolean; lote: string; message: string; batch?: ProductionBatch }> {
  try {
    const config = getProductionConfig();
    const mapaCostos: Record<string, number> = {};
    (config.ingredients || []).forEach((ing: any) => {
      mapaCostos[ing.name] = ing.unitCost || 0;
    });

    const lote = generateLotCode(data.categoria, data.fechaProduccion);
    const fechaCaptura = new Date().toISOString().slice(0, 10);

    let totalCosto = 0;
    let sumaKg = 0;
    let cremaNaturalKg = 0;
    let costoLecheUsada = 0;
    let kgLecheUsada = 0;

    const registrosInsumos = data.insumos.map(item => {
      const nombre = item.nombre.trim();
      const nombreLower = nombre.toLowerCase();
      const cant = Number(item.cantidad) || 0;
      const costoUnit = mapaCostos[nombre] || 0;
      const costo = cant * costoUnit;

      const esLeche = [
        'leche entera',
        'leche pipa',
        'leche descremada',
        'leche en polvo'
      ].includes(nombreLower);
      const esCremaNatural = nombreLower === 'crema natural';

      if (esLeche) {
        costoLecheUsada += costo;
        kgLecheUsada += cant;
      }
      if (esCremaNatural) {
        cremaNaturalKg += cant;
      }

      if (data.categoria === 'All / Crema') {
        if (!esLeche) sumaKg += cant;
        if (!esLeche && !esCremaNatural) totalCosto += costo;
      } else {
        sumaKg += cant;
        totalCosto += costo;
      }

      return {
        nombre,
        cantidad: cant,
        costoUnitario: costoUnit,
        costoTotal: costo
      };
    });

    let ajusteCrema = 0;
    let kgFinal = Number(data.kgTotal) || 0;

    if (data.categoria === 'All / Crema') {
      kgFinal = sumaKg;
      const costoCremaNatural = mapaCostos['Crema natural'] || 0;
      ajusteCrema = cremaNaturalKg * costoCremaNatural;
      if (cremaNaturalKg > 0 && kgLecheUsada > 0) {
        const costoPromedioLeche = costoLecheUsada / kgLecheUsada;
        const costoRecuperado = cremaNaturalKg * costoPromedioLeche;
        totalCosto += ajusteCrema + costoRecuperado;
      }
    } else if (data.categoria === 'All / Quesos / Mozzarella' && data.loteCrema) {
      // Descuenta ajuste del lote crema asociado
      const lotes = loadLocalProduction();
      const targetLote = lotes.find(l => l.lote === data.loteCrema);
      if (targetLote && targetLote.ajusteCrema > 0) {
        totalCosto -= targetLote.ajusteCrema;
      }
    }

    const costoPorKg = kgFinal > 0 ? totalCosto / kgFinal : 0;

    const newBatch: ProductionBatch = {
      id: `prod_${Date.now()}`,
      fechaProduccion: data.fechaProduccion,
      fechaCaptura,
      categoria: data.categoria,
      lote,
      kgTotal: kgFinal,
      costoTotal: totalCosto,
      costoPorKg,
      ajusteCrema,
      loteCremaAsociado: data.loteCrema || undefined,
      registrosInsumos
    };

    // 1. Guardar localmente
    const local = loadLocalProduction();
    local.unshift(newBatch);
    saveLocalProduction(local);

    // 2. Enviar a Google Sheet nuevo (asíncrono sin bloquear)
    const rowForSheet = [
      data.fechaProduccion,
      fechaCaptura,
      data.categoria,
      lote,
      kgFinal,
      totalCosto,
      costoPorKg,
      ajusteCrema > 0 ? ajusteCrema : ''
    ];
    const sheetRes = await appendRowsToSheet('Producción', [rowForSheet]);
    const message = sheetRes.success
      ? `¡Lote ${lote} registrado con éxito y guardado en Google Sheet!`
      : `¡Lote ${lote} registrado localmente! (Aviso Google Sheets: ${sheetRes.error || 'pendiente'})`;

    return {
      success: true,
      lote,
      message,
      batch: newBatch
    };
  } catch (err: any) {
    console.error('Error in createProductionBatch:', err);
    return { success: false, lote: '', message: err.message };
  }
}

// 5. Available lots for packaging (calculates saldo de kg)
export function getAvailableProductionLots(categoria?: string): any[] {
  const lotes = loadLocalProduction();
  const empaques = loadLocalPackaging();

  // Calcular kg empacados por lote
  const kgEmpacadosPorLote: Record<string, number> = {};
  empaques.forEach(emp => {
    if (!kgEmpacadosPorLote[emp.lote]) kgEmpacadosPorLote[emp.lote] = 0;
    kgEmpacadosPorLote[emp.lote] += Number(emp.kgCapturados) || 0;
  });

  return lotes
    .filter(l => {
      if (categoria && l.categoria !== categoria) return false;
      const empacado = kgEmpacadosPorLote[l.lote] || 0;
      const disponible = l.kgTotal - empacado;
      return disponible > 0.5; // Solo lotes con más de medio kilo disponible
    })
    .map(l => {
      const empacado = kgEmpacadosPorLote[l.lote] || 0;
      const disponible = l.kgTotal - empacado;
      // Calcular días de reposo natural desde la fecha de elaboración
      let diasReposo = 0;
      if (l.fechaProduccion) {
        const parts = l.fechaProduccion.split('-');
        if (parts.length === 3) {
          const prodDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const diffMs = Date.now() - prodDate.getTime();
          diasReposo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      const reposoText = diasReposo === 0 
        ? 'Elaborado hoy' 
        : `${diasReposo} d reposo`;

      return {
        lote: l.lote,
        categoria: l.categoria,
        fechaProduccion: l.fechaProduccion,
        diasReposo,
        kgTotal: l.kgTotal,
        kgEmpacados: empacado,
        kgDisponible: disponible,
        costoPorKg: l.costoPorKg,
        costoTotal: l.costoTotal,
        display: `${l.lote} | ${reposoText} | Disp: ${disponible.toFixed(2)} kg ($${l.costoPorKg.toFixed(2)}/kg)`
      };
    });
}

// 6. Save Packaging Batch
export async function createPackagingBatch(data: {
  fechaProduccion: string;
  fechaEmpaque: string;
  categoria: string;
  lote: string;
  productos: {
    producto: string;
    display: string;
    peso: number;
    piezas: number;
    adicionales?: string[];
    empaques?: string[];
    etiqueta?: string;
  }[];
  adicionalesKg?: Record<string, number>;
}): Promise<{ success: boolean; message: string; aprovechamiento: number; batch?: PackagingBatch }> {
  try {
    const config = getProductionConfig();
    const mapaCostos: Record<string, number> = {};
    (config.ingredients || []).forEach((ing: any) => {
      mapaCostos[ing.name] = ing.unitCost || 0;
    });

    const lotes = loadLocalProduction();
    const infoLote = lotes.find(l => l.lote === data.lote);
    if (!infoLote) {
      return { success: false, message: `No se encontró el lote ${data.lote}`, aprovechamiento: 0 };
    }

    const adicionalesKg = data.adicionalesKg || {};

    // 1. Calcular total de kg por adicional para distribución proporcional
    const totalKgPorAdicional: Record<string, number> = {};
    data.productos.forEach(p => {
      const pKg = (Number(p.peso) || 0) * (Number(p.piezas) || 0);
      (p.adicionales || []).forEach(adName => {
        if (!adName) return;
        if (!totalKgPorAdicional[adName]) totalKgPorAdicional[adName] = 0;
        totalKgPorAdicional[adName] += pKg;
      });
    });

    // 2. Calcular costos por producto
    let kgCapturados = 0;
    const items: PackagingItem[] = data.productos.map(p => {
      const piezas = Number(p.piezas) || 0;
      const peso = Number(p.peso) || 0;
      const kg = piezas * peso;
      kgCapturados += kg;

      const costoBase = kg * infoLote.costoPorKg;

      // Costo empaque
      let costoEmpaque = 0;
      (p.empaques || []).forEach(empName => {
        costoEmpaque += (mapaCostos[empName] || 0) * piezas;
      });

      // Costo etiqueta
      const costoEtiqueta = (mapaCostos[p.etiqueta || ''] || 0) * piezas;

      // Costo adicional distribuido
      let costoAdicional = 0;
      (p.adicionales || []).forEach(adName => {
        const kgTotalAd = Number(adicionalesKg[adName]) || 0;
        const costoKgAd = mapaCostos[adName] || 0;
        const kgGrupo = totalKgPorAdicional[adName] || 0;
        if (kgGrupo > 0) {
          const proporcion = kg / kgGrupo;
          costoAdicional += (kgTotalAd * proporcion) * costoKgAd;
        }
      });

      const costoTotal = costoBase + costoEmpaque + costoEtiqueta + costoAdicional;
      const costoPieza = piezas > 0 ? costoTotal / piezas : 0;
      const aprovechamientoLinea = infoLote.kgTotal > 0 ? (kg / infoLote.kgTotal) * 100 : 0;

      return {
        producto: p.producto,
        display: p.display,
        peso,
        piezas,
        kg,
        costoBase,
        costoAdicional,
        costoEmpaque,
        costoEtiqueta,
        costoTotal,
        costoPieza,
        aprovechamientoLinea
      };
    });

    const aprovechamientoTotal = infoLote.kgTotal > 0 ? (kgCapturados / infoLote.kgTotal) * 100 : 0;
    const fechaCaptura = new Date().toISOString().slice(0, 10);

    const newPackaging: PackagingBatch = {
      id: `pack_${Date.now()}`,
      fechaProduccion: data.fechaProduccion,
      fechaEmpaque: data.fechaEmpaque,
      fechaCaptura,
      categoria: data.categoria,
      lote: data.lote,
      loteKgTotal: infoLote.kgTotal,
      kgCapturados,
      aprovechamientoTotal,
      items,
      adicionalesKg
    };

    // 1. Guardar localmente
    const local = loadLocalPackaging();
    local.unshift(newPackaging);
    saveLocalPackaging(local);

    // 2. Enviar a Google Sheet cada renglón empacado
    const rowsForSheet = items.map(item => [
      data.fechaProduccion,
      data.fechaEmpaque,
      fechaCaptura,
      data.categoria,
      data.lote,
      item.producto,
      item.peso,
      item.piezas,
      item.kg,
      infoLote.costoPorKg,
      item.costoBase,
      item.costoAdicional,
      item.costoEmpaque,
      item.costoEtiqueta,
      item.costoTotal,
      item.costoPieza,
      infoLote.kgTotal,
      item.kg,
      `${item.aprovechamientoLinea.toFixed(2)}%`,
      `${aprovechamientoTotal.toFixed(2)}%`
    ]);
    const sheetRes = await appendRowsToSheet('Empaque', rowsForSheet);
    const message = sheetRes.success
      ? `¡Empaque del lote ${data.lote} guardado con éxito y enviado a Google Sheet!`
      : `¡Empaque del lote ${data.lote} guardado localmente! (Aviso Google Sheets: ${sheetRes.error || 'pendiente'})`;

    return {
      success: true,
      message,
      aprovechamiento: aprovechamientoTotal,
      batch: newPackaging
    };
  } catch (err: any) {
    console.error('Error in createPackagingBatch:', err);
    return { success: false, message: err.message, aprovechamiento: 0 };
  }
}

// 7. Live Odoo Inventory
export async function getOdooLiveInventory(): Promise<any[]> {
  try {
    const quants: any[] = await executeKw(
      'stock.quant',
      'search_read',
      [[['location_id.usage', '=', 'internal']]],
      { fields: ['product_id', 'location_id', 'quantity', 'reserved_quantity'] }
    );

    if (!quants || !quants.length) return [];

    const productIds = [...new Set(quants.map(q => q.product_id[0]))];

    const products: any[] = await executeKw(
      'product.product',
      'search_read',
      [[['id', 'in', productIds]]],
      { fields: ['id', 'product_tmpl_id', 'display_name'] }
    );

    const tmplMap: Record<number, number> = {};
    const prodNameMap: Record<number, string> = {};
    products.forEach(p => {
      tmplMap[p.id] = p.product_tmpl_id[0];
      prodNameMap[p.id] = p.display_name;
    });

    const tmplIds = [...new Set(products.map(p => p.product_tmpl_id[0]))];

    const templates: any[] = await executeKw(
      'product.template',
      'search_read',
      [[['id', 'in', tmplIds]]],
      { fields: ['id', 'categ_id', 'weight'] }
    );

    const categMap: Record<number, string> = {};
    const weightMap: Record<number, number> = {};
    templates.forEach(t => {
      categMap[t.id] = t.categ_id ? t.categ_id[1] : '';
      weightMap[t.id] = Number(t.weight) || 0;
    });

    const summaryMap: Record<string, any> = {};
    quants.forEach(q => {
      const pId = q.product_id[0];
      const pName = q.product_id[1];
      const locId = q.location_id[0];
      const locName = q.location_id[1];
      const key = `${pId}_${locId}`;

      const tId = tmplMap[pId];
      const categoria = categMap[tId] || '';
      const pesoUnit = weightMap[tId] || 0;

      if (!summaryMap[key]) {
        summaryMap[key] = {
          productId: pId,
          producto: pName,
          categoria,
          pesoUnit,
          locationId: locId,
          ubicacion: locName,
          cantidadFisica: 0,
          reservado: 0,
          disponible: 0,
          pesoTotal: 0
        };
      }
      summaryMap[key].cantidadFisica += Number(q.quantity) || 0;
      summaryMap[key].reservado += Number(q.reserved_quantity) || 0;
    });

    return Object.values(summaryMap).map((item: any) => {
      item.disponible = item.cantidadFisica - item.reservado;
      item.pesoTotal = item.pesoUnit * item.cantidadFisica;
      return item;
    });
  } catch (err: any) {
    console.error('Error fetching Odoo inventory:', err);
    return [];
  }
}

// ==========================================
// 8. Odoo Dairy Plant Catalog & Unconfigured SKUs
// ==========================================
let _odooCatalogCache: any = null;
let _odooCatalogCacheTime = 0;

export async function fetchOdooDairyCatalog(forceRefresh = false): Promise<{
  categories: string[];
  products: any[];
  unconfiguredProducts: any[];
  lastSync: number;
}> {
  const now = Date.now();
  if (!forceRefresh && _odooCatalogCache && (now - _odooCatalogCacheTime < 5 * 60 * 1000)) {
    return _odooCatalogCache;
  }

  try {
    const cfg = getProductionConfig();
    const configuredMap = new Map<string, any>();
    (cfg.skus || []).forEach((s: any) => {
      configuredMap.set(s.product.trim().toLowerCase(), s);
    });

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
    const odooProducts = await executeKw('product.product', 'search_read', [
      [
        ['sale_ok', '=', true],
        ['categ_id', 'in', catIds]
      ]
    ], {
      fields: ['id', 'name', 'default_code', 'categ_id', 'list_price', 'standard_price', 'weight', 'uom_id'],
      limit: 500
    });

    const validProducts = (odooProducts || []).filter((p: any) => {
      const n = (p.name || '').toLowerCase();
      return !n.includes('% de descuento') && !n.includes('$') && !n.includes('por punto');
    });

    const unconfigured: any[] = [];
    const products: any[] = [];
    const cleanCategoriesSet = new Set<string>();

    validProducts.forEach((p: any) => {
      const catName = p.categ_id ? p.categ_id[1] : 'Otros';
      cleanCategoriesSet.add(catName);

      const normName = p.name.trim().toLowerCase();
      const configMatch = configuredMap.get(normName);

      // Weight resolution: configMatch.peso > Odoo p.weight > parse from title
      let weight = (configMatch && Number(configMatch.peso) > 0) ? Number(configMatch.peso) : (Number(p.weight) || 0);
      if (weight === 0) {
        const lower = p.name.toLowerCase();
        const kgM = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/);
        if (kgM) weight = parseFloat(kgM[1]);
        else {
          const gM = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos?)/);
          if (gM) weight = parseFloat(gM[1]) / 1000;
        }
      }

      const empaquesList = configMatch?.empaques || [];
      const etiquetaStr = configMatch?.etiqueta || '';
      const adicionalesList = configMatch?.adicionales || [];
      const targetCategory = configMatch?.category || catName;

      // Recipe Elements Verification (Insumos, Empaque, Etiqueta, Peso, Adicionales)
      const hasInsumosCategory = (cfg.categories || []).some((c: string) =>
        c.toLowerCase() === targetCategory.toLowerCase() ||
        targetCategory.toLowerCase().includes(c.toLowerCase()) ||
        c.toLowerCase().includes(targetCategory.toLowerCase())
      );
      const hasEmpaque = Array.isArray(empaquesList) && empaquesList.length > 0;
      const hasEtiqueta = Boolean(etiquetaStr && etiquetaStr.trim().length > 0);
      const hasPeso = Boolean(weight && weight > 0);

      // Check if product is flavored/special requiring adicionales
      const specialKeywords = ['chipotle', 'jalape', 'jamon', 'jamón', 'habanero', 'morral', 'hierba', 'sabor', 'aderezado'];
      const requiresAdicionales = specialKeywords.some(kw => normName.includes(kw));
      const hasAdicionales = requiresAdicionales ? (Array.isArray(adicionalesList) && adicionalesList.length > 0) : true;

      const missingRecipeElements: string[] = [];
      if (!hasInsumosCategory) missingRecipeElements.push('Insumos de Categoría Base');
      if (!hasPeso) missingRecipeElements.push('Peso Unitario');
      if (!hasEmpaque) missingRecipeElements.push('Material de Empaque');
      if (!hasEtiqueta) missingRecipeElements.push('Etiqueta');
      if (!hasAdicionales) missingRecipeElements.push('Insumos Adicionales (Receta)');

      const hasCompleteRecipe = missingRecipeElements.length === 0 && !!configMatch;

      const prodObj = {
        odooId: p.id,
        name: p.name,
        category: targetCategory,
        weight: weight || 1.0,
        price: Number(p.list_price) || 0,
        code: p.default_code || '',
        isConfigured: hasCompleteRecipe,
        hasCompleteRecipe,
        missingRecipeElements,
        adicionales: adicionalesList,
        empaques: empaquesList,
        etiqueta: etiquetaStr
      };

      products.push(prodObj);

      if (!hasCompleteRecipe) {
        unconfigured.push(prodObj);
      }
    });

    const result = {
      categories: Array.from(cleanCategoriesSet).sort(),
      products,
      unconfiguredProducts: unconfigured,
      lastSync: now
    };

    _odooCatalogCache = result;
    _odooCatalogCacheTime = now;
    return result;
  } catch (err: any) {
    console.error('Error fetching Odoo dairy catalog:', err);
    return {
      categories: [],
      products: [],
      unconfiguredProducts: [],
      lastSync: now
    };
  }
}

export async function configureProductSku(data: {
  product: string;
  category: string;
  peso: number;
  adicionales?: string[];
  empaques?: string[];
  etiqueta?: string;
}): Promise<{ success: boolean; message: string; sku?: any }> {
  try {
    if (!data.product || !data.category) {
      return { success: false, message: 'Producto y categoría son obligatorios.' };
    }

    const cfg = getProductionConfig();
    if (!cfg.skus) cfg.skus = [];

    const normName = data.product.trim().toLowerCase();
    const existingIdx = cfg.skus.findIndex((s: any) => s.product.trim().toLowerCase() === normName);

    const newSku = {
      product: data.product.trim(),
      category: data.category.trim(),
      peso: Number(data.peso) || 1.0,
      adicionales: data.adicionales || [],
      empaques: data.empaques || [],
      etiqueta: data.etiqueta || ''
    };

    if (existingIdx !== -1) {
      cfg.skus[existingIdx] = { ...cfg.skus[existingIdx], ...newSku };
    } else {
      cfg.skus.push(newSku);
    }

    // Ensure category is in categories list
    if (!cfg.categories) cfg.categories = [];
    if (!cfg.categories.includes(data.category)) {
      cfg.categories.push(data.category);
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');

    // Invalidate Odoo catalog cache so updated config is reflected
    _odooCatalogCache = null;
    _odooCatalogCacheTime = 0;

    return {
      success: true,
      message: `¡Producto "${newSku.product}" configurado exitosamente para planta y empaque!`,
      sku: newSku
    };
  } catch (err: any) {
    console.error('Error configuring product SKU:', err);
    return { success: false, message: err.message };
  }
}
