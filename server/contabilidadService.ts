import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';

const NEW_SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const CONTABILIDAD_STORE_FILE = 'contabilidad_store.json';

export interface MovimientoContable {
  id: string;
  fecha: string; // YYYY-MM-DD
  fechaSheet?: string; // DD/MM/YYYY
  empresa: string; // 'Quesería' | 'Rancho'
  tipoMovimiento: 'Entrada' | 'Salida' | 'Control';
  cuentaMenor: string;
  monto: number;
  motivo: string;
  autoriza: string;
  cuentaFiscal: string; // 'Efectivo' | 'Banorte' | 'Crédito' | 'Efectivo manzanillo'
  folio?: string;
  litros?: number;
  precioPorLitro?: number;
  semana: string; // 'Semana 44'
  semanaNum: number;
  mes: string; // 'noviembre'
  año: number; // 2026
  totalNeto: number;
  dia: string; // 'lunes'
  fechaCaptura?: string;
  rowNumber?: number;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
];

// Excel =NUM.DE.SEMANA(fecha, 1) helper
export function getExcelWeekNumber(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((target.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const startDayOfWeek = yearStart.getDay(); // 0 = Sunday
  return Math.ceil((dayOfYear + startDayOfWeek) / 7);
}

// Net amount calculation based on Col O formula
export function calculateTotalNeto(
  empresa: string,
  cuentaMenor: string,
  tipo: string,
  monto: number,
  litros?: number,
  precioPorLitro?: number
): number {
  const empLower = (empresa || '').trim().toLowerCase();
  const ctaLower = (cuentaMenor || '').trim().toLowerCase();
  const tipoLower = (tipo || '').trim().toLowerCase();

  if (empLower === 'rancho') return 0;
  if (ctaLower === 'leche') {
    const lts = Number(litros) || 0;
    const precio = Number(precioPorLitro) || 0;
    return Number((lts * precio).toFixed(2));
  }
  if (tipoLower === 'salida') {
    return -Math.abs(Number(monto) || 0);
  }
  if (tipoLower === 'control') {
    return 0;
  }
  return Math.abs(Number(monto) || 0);
}

export function parseDateString(dateStr: string): { date: Date; year: number; month: number; day: number; formattedISO: string; formattedSheet: string } {
  let y = 2026, m = 1, d = 1;
  const clean = (dateStr || '').trim();

  if (clean.includes('-')) {
    // YYYY-MM-DD
    const parts = clean.split('-');
    y = parseInt(parts[0], 10) || 2026;
    m = parseInt(parts[1], 10) || 1;
    d = parseInt(parts[2], 10) || 1;
  } else if (clean.includes('/')) {
    // D/M/YYYY or DD/MM/YYYY
    const parts = clean.split('/');
    d = parseInt(parts[0], 10) || 1;
    m = parseInt(parts[1], 10) || 1;
    y = parseInt(parts[2], 10) || 2026;
  }

  const dateObj = new Date(y, m - 1, d);
  const iso = `${y}-${('0' + m).slice(-2)}-${('0' + d).slice(-2)}`;
  const sheet = `${d}/${m}/${y}`;

  return {
    date: dateObj,
    year: y,
    month: m,
    day: d,
    formattedISO: iso,
    formattedSheet: sheet
  };
}

export function parseNumeric(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[$€,\s]/g, '').trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// ----------------------------------------------------
// Local Store Management
// ----------------------------------------------------
export function loadLocalContabilidad(): MovimientoContable[] {
  try {
    const filePath = path.resolve(process.cwd(), CONTABILIDAD_STORE_FILE);
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[contabilidadService] Error reading store:', err);
    return [];
  }
}

export function saveLocalContabilidad(movimientos: MovimientoContable[]): void {
  try {
    const filePath = path.resolve(process.cwd(), CONTABILIDAD_STORE_FILE);
    fs.writeFileSync(filePath, JSON.stringify(movimientos, null, 2), 'utf8');
  } catch (err) {
    console.error('[contabilidadService] Error writing store:', err);
  }
}

// ----------------------------------------------------
// Google Sheets Synchronization
// ----------------------------------------------------
export async function fetchGoogleSheetContabilidad(): Promise<MovimientoContable[]> {
  try {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (!token) throw new Error('No se pudo obtener token de Google');

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/Contabilidad!A2:P`, {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) {
      console.error('[contabilidadService] Failed to fetch sheet:', await res.text());
      return loadLocalContabilidad();
    }

    const data = await res.json();
    const rows = data.values || [];
    const parsed: MovimientoContable[] = [];

    rows.forEach((r: any[], idx: number) => {
      if (!r || r.length === 0 || !r[0]) return;

      const dateMeta = parseDateString(r[0]);
      const empresa = r[1] ? String(r[1]).trim() : 'Quesería';
      const tipo = (r[2] ? String(r[2]).trim() : 'Salida') as any;
      const cuentaMenor = r[3] ? String(r[3]).trim() : 'Gastos';
      const monto = parseNumeric(r[4]);
      const motivo = r[5] ? String(r[5]).trim() : '';
      const autoriza = r[6] ? String(r[6]).trim() : '';
      const cuentaFiscal = r[7] ? String(r[7]).trim() : 'Efectivo';
      const folio = r[8] ? String(r[8]).trim() : '';
      const litros = r[9] ? parseNumeric(r[9]) : undefined;
      const precioPorLitro = r[10] ? parseNumeric(r[10]) : undefined;

      const extractedSem = r[11] ? parseInt(String(r[11]).replace(/\D/g, ''), 10) : NaN;
      const semNum = (!isNaN(extractedSem) && extractedSem >= 1 && extractedSem <= 54) ? extractedSem : getExcelWeekNumber(dateMeta.date);
      const semana = r[11] ? String(r[11]).trim() : `Semana ${semNum}`;
      const mes = r[12] ? String(r[12]).trim() : MESES[dateMeta.month - 1];
      const año = r[13] ? parseInt(r[13], 10) || dateMeta.year : dateMeta.year;
      const totalNeto = r[14] ? parseNumeric(r[14]) : calculateTotalNeto(empresa, cuentaMenor, tipo, monto, litros, precioPorLitro);
      const dia = r[15] ? String(r[15]).trim() : DIAS[dateMeta.date.getDay()];

      parsed.push({
        id: `mov_row_${idx + 2}`,
        fecha: dateMeta.formattedISO,
        fechaSheet: dateMeta.formattedSheet,
        empresa,
        tipoMovimiento: tipo,
        cuentaMenor,
        monto,
        motivo,
        autoriza,
        cuentaFiscal,
        folio,
        litros,
        precioPorLitro,
        semana,
        semanaNum: semNum,
        mes,
        año,
        totalNeto,
        dia,
        rowNumber: idx + 2
      });
    });

    // Guardar en caché local
    saveLocalContabilidad(parsed);
    console.log(`[contabilidadService] ¡Cargados ${parsed.length} movimientos desde Google Sheets!`);
    return parsed;
  } catch (err) {
    console.error('[contabilidadService] Error fetching from sheet:', err);
    return loadLocalContabilidad();
  }
}

export async function appendMovimientoToSheet(mov: MovimientoContable): Promise<boolean> {
  try {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (!token) return false;

    const row = [
      mov.fechaSheet || mov.fecha,
      mov.empresa,
      mov.tipoMovimiento,
      mov.cuentaMenor,
      mov.monto,
      mov.motivo,
      mov.autoriza,
      mov.cuentaFiscal,
      mov.folio || '',
      mov.litros != null ? mov.litros : '',
      mov.precioPorLitro != null ? mov.precioPorLitro : '',
      mov.semana,
      mov.mes,
      mov.año,
      mov.totalNeto,
      mov.dia
    ];

    const range = encodeURIComponent('Contabilidad!A:P');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    });

    if (!res.ok) {
      console.error('[contabilidadService] Error appending row:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[contabilidadService] Error in appendMovimientoToSheet:', err);
    return false;
  }
}

// ----------------------------------------------------
// Public API Methods
// ----------------------------------------------------
export async function createMovimiento(data: {
  fecha: string;
  empresa?: string;
  tipoMovimiento: 'Entrada' | 'Salida' | 'Control';
  cuentaMenor: string;
  monto: number;
  motivo?: string;
  autoriza?: string;
  cuentaFiscal?: string;
  folio?: string;
  litros?: number;
  precioPorLitro?: number;
}): Promise<{ success: boolean; message: string; movimiento?: MovimientoContable; sheetSynced?: boolean }> {
  try {
    if (!data.fecha) {
      return { success: false, message: 'La fecha es obligatoria' };
    }
    if (!data.cuentaMenor) {
      return { success: false, message: 'La cuenta menor es obligatoria' };
    }

    const dateMeta = parseDateString(data.fecha);
    const empresa = data.empresa || 'Quesería';
    const semNum = getExcelWeekNumber(dateMeta.date);
    const semana = `Semana ${semNum}`;
    const mes = MESES[dateMeta.month - 1];
    const año = dateMeta.year;
    const dia = DIAS[dateMeta.date.getDay()];

    let monto = Number(data.monto) || 0;
    const litros = data.litros != null ? Number(data.litros) : undefined;
    const precioPorLitro = data.precioPorLitro != null ? Number(data.precioPorLitro) : undefined;

    if (data.cuentaMenor.toLowerCase() === 'leche' && litros && precioPorLitro) {
      monto = Number((litros * precioPorLitro).toFixed(2));
    }

    const totalNeto = calculateTotalNeto(empresa, data.cuentaMenor, data.tipoMovimiento, monto, litros, precioPorLitro);

    const newMov: MovimientoContable = {
      id: `mov_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      fecha: dateMeta.formattedISO,
      fechaSheet: dateMeta.formattedSheet,
      empresa,
      tipoMovimiento: data.tipoMovimiento,
      cuentaMenor: data.cuentaMenor,
      monto,
      motivo: data.motivo || '',
      autoriza: data.autoriza || 'Sistema',
      cuentaFiscal: data.cuentaFiscal || 'Efectivo',
      folio: data.folio || '',
      litros,
      precioPorLitro,
      semana,
      semanaNum: semNum,
      mes,
      año,
      totalNeto,
      dia,
      fechaCaptura: new Date().toISOString()
    };

    // 1. Guardar localmente
    const local = loadLocalContabilidad();
    local.push(newMov);
    saveLocalContabilidad(local);

    // 2. Sincronizar asíncronamente con Google Sheets
    const sheetSynced = await appendMovimientoToSheet(newMov);

    return {
      success: true,
      message: sheetSynced
        ? `¡Movimiento guardado y sincronizado con Google Sheets exitosamente!`
        : `¡Movimiento guardado localmente! (Se sincronizará con Google Sheets al reconectar)`,
      movimiento: newMov,
      sheetSynced
    };
  } catch (err: any) {
    console.error('[contabilidadService] Error creating movimiento:', err);
    return { success: false, message: err.message || 'Error al guardar movimiento' };
  }
}

export function deleteLocalMovimiento(id: string): { success: boolean; message: string } {
  try {
    let local = loadLocalContabilidad();
    const prev = local.length;
    local = local.filter(m => m.id !== id);
    if (local.length === prev) {
      return { success: false, message: 'Movimiento no encontrado' };
    }
    saveLocalContabilidad(local);
    return { success: true, message: 'Movimiento eliminado del registro local' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ----------------------------------------------------
// P&L and Balances Matrix Calculator
// ----------------------------------------------------
export interface WeeklyBalanceColumn {
  semanaNum: number;
  semanaLabel: string;
  // Ingresos
  ruta: number;
  manzanilloRuta6: number;
  ventasManzanillo: number;
  ventaDirecta: number;
  totalIngresos: number;
  // Egresos
  gastos: number;
  gastosManzanillo: number;
  gastosRutas: number;
  insumos: number;
  rancho: number;
  totalEgresos: number;
  porcentajeEgresos: number;
  // Nómina
  nomina: number;
  nominaManzanillo: number;
  nominaTotal: number;
  porcentajeNomina: number;
  // Leche & Materia Prima
  leche: number;
  litrosLeche: number;
  creditoAbono: number;
  acumulado: number;
  credito: number;
  diferenciaCalculo: number;
  totalesAdministrativos: number;
  // Resultados
  utilidadNeta: number;
  porcentajeUtilidadNeta: number;
  utilidadBruta: number;
  porcentajeUtilidadBruta: number;
}

export interface ContabilidadBalancesResponse {
  año: number;
  disponibleAños: number[];
  semanas: WeeklyBalanceColumn[];
  resumenAnual: {
    totalIngresos: number;
    totalEgresos: number;
    totalNomina: number;
    totalLeche: number;
    totalLitrosLeche: number;
    utilidadNeta: number;
    porcentajeUtilidadNeta: number;
    utilidadBruta: number;
    porcentajeUtilidadBruta: number;
    totalMovimientos: number;
  };
}

export function calculateContabilidadBalances(targetYear?: number): ContabilidadBalancesResponse {
  const allMovs = loadLocalContabilidad();
  const yearSet = new Set<number>();
  allMovs.forEach(m => {
    if (m.año && !isNaN(m.año)) yearSet.add(m.año);
  });

  const disponibleAños = Array.from(yearSet).sort((a, b) => b - a);
  const año = targetYear || (disponibleAños.length > 0 ? disponibleAños[0] : new Date().getFullYear());

  const yearMovs = allMovs.filter(m => m.año === año);

  // Initialise 53 weeks
  const semanasMap = new Map<number, WeeklyBalanceColumn>();
  for (let w = 1; w <= 53; w++) {
    semanasMap.set(w, {
      semanaNum: w,
      semanaLabel: `Semana ${w}`,
      ruta: 0,
      manzanilloRuta6: 0,
      ventasManzanillo: 0,
      ventaDirecta: 0,
      totalIngresos: 0,
      gastos: 0,
      gastosManzanillo: 0,
      gastosRutas: 0,
      insumos: 0,
      rancho: 0,
      totalEgresos: 0,
      porcentajeEgresos: 0,
      nomina: 0,
      nominaManzanillo: 0,
      nominaTotal: 0,
      porcentajeNomina: 0,
      leche: 0,
      litrosLeche: 0,
      creditoAbono: 0,
      acumulado: 0,
      credito: 0,
      diferenciaCalculo: 0,
      totalesAdministrativos: 0,
      utilidadNeta: 0,
      porcentajeUtilidadNeta: 0,
      utilidadBruta: 0,
      porcentajeUtilidadBruta: 0
    });
  }

  // Populate from movements
  yearMovs.forEach(m => {
    const w = m.semanaNum || 1;
    if (w < 1 || w > 53) return;
    const col = semanasMap.get(w)!;
    const cta = (m.cuentaMenor || '').trim().toLowerCase();
    const monto = Math.abs(Number(m.monto) || 0);

    // Ingresos
    if (cta === 'ruta') col.ruta += monto;
    else if (cta === 'manzanillo ruta 6') col.manzanilloRuta6 += monto;
    else if (cta === 'ventas manzanillo') col.ventasManzanillo += monto;
    else if (cta === 'venta directa') col.ventaDirecta += monto;

    // Egresos
    else if (cta === 'gastos') col.gastos += monto;
    else if (cta === 'gastos manzanillo') col.gastosManzanillo += monto;
    else if (cta === 'gastos rutas') col.gastosRutas += monto;
    else if (cta === 'insumos') col.insumos += monto;
    else if (cta === 'rancho') col.rancho += monto;

    // Nóminas
    else if (cta === 'nómina' || cta === 'nomina') col.nomina += monto;
    else if (cta === 'nómina manzanillo' || cta === 'nomina manzanillo') col.nominaManzanillo += monto;

    // Leche
    else if (cta === 'leche') {
      const imp = (m.litros && m.precioPorLitro) ? (m.litros * m.precioPorLitro) : monto;
      col.leche += imp;
      if (m.litros) col.litrosLeche += Number(m.litros) || 0;
    }

    // Administrativos / Créditos
    else if (cta === 'crédito' || cta === 'credito') col.credito += monto;
    else if (cta === 'diferencia en calculo' || cta === 'diferencia en cálculo') col.diferenciaCalculo += (Number(m.totalNeto) || monto);
  });

  // Calculate totals and percentages per week
  let runningAcumulado = 0;
  const semanas: WeeklyBalanceColumn[] = [];

  for (let w = 1; w <= 53; w++) {
    const col = semanasMap.get(w)!;

    // Ingresos
    col.totalIngresos = Number((col.ruta + col.manzanilloRuta6 + col.ventasManzanillo + col.ventaDirecta).toFixed(2));

    // Egresos
    col.totalEgresos = Number((col.gastos + col.gastosManzanillo + col.gastosRutas + col.insumos + col.rancho).toFixed(2));
    col.porcentajeEgresos = col.totalIngresos > 0 ? Number(((col.totalEgresos / col.totalIngresos) * 100).toFixed(2)) : 0;

    // Nómina
    col.nominaTotal = Number((col.nomina + col.nominaManzanillo).toFixed(2));
    col.porcentajeNomina = col.totalIngresos > 0 ? Number(((col.nominaTotal / col.totalIngresos) * 100).toFixed(2)) : 0;

    // Crédito / Abono & Acumulado
    col.creditoAbono = Number((col.leche - col.rancho).toFixed(2));
    runningAcumulado += col.creditoAbono;
    col.acumulado = Number(runningAcumulado.toFixed(2));

    // Totales administrativos
    col.totalesAdministrativos = Number((col.diferenciaCalculo + col.credito).toFixed(2));

    // Resultados
    // Utilidad Neta = Total Ingresos - Total Egresos
    col.utilidadNeta = Number((col.totalIngresos - col.totalEgresos).toFixed(2));
    col.porcentajeUtilidadNeta = col.totalIngresos > 0 ? Number(((col.utilidadNeta / col.totalIngresos) * 100).toFixed(2)) : 0;

    // Utilidad Bruta = Total Ingresos - Costos Directos (Insumos + Leche)
    col.utilidadBruta = Number((col.totalIngresos - (col.insumos + col.leche)).toFixed(2));
    col.porcentajeUtilidadBruta = col.totalIngresos > 0 ? Number(((col.utilidadBruta / col.totalIngresos) * 100).toFixed(2)) : 0;

    semanas.push(col);
  }

  // Resumen Anual
  let sumIngresos = 0;
  let sumEgresos = 0;
  let sumNomina = 0;
  let sumLeche = 0;
  let sumLitros = 0;

  semanas.forEach(s => {
    sumIngresos += s.totalIngresos;
    sumEgresos += s.totalEgresos;
    sumNomina += s.nominaTotal;
    sumLeche += s.leche;
    sumLitros += s.litrosLeche;
  });

  const utilidadNetaAnual = Number((sumIngresos - sumEgresos).toFixed(2));
  const porcentajeUtilidadNetaAnual = sumIngresos > 0 ? Number(((utilidadNetaAnual / sumIngresos) * 100).toFixed(2)) : 0;
  const utilidadBrutaAnual = Number((sumIngresos - (semanas.reduce((acc, s) => acc + s.insumos, 0) + sumLeche)).toFixed(2));
  const porcentajeUtilidadBrutaAnual = sumIngresos > 0 ? Number(((utilidadBrutaAnual / sumIngresos) * 100).toFixed(2)) : 0;

  return {
    año,
    disponibleAños,
    semanas,
    resumenAnual: {
      totalIngresos: Number(sumIngresos.toFixed(2)),
      totalEgresos: Number(sumEgresos.toFixed(2)),
      totalNomina: Number(sumNomina.toFixed(2)),
      totalLeche: Number(sumLeche.toFixed(2)),
      totalLitrosLeche: Number(sumLitros.toFixed(2)),
      utilidadNeta: utilidadNetaAnual,
      porcentajeUtilidadNeta: porcentajeUtilidadNetaAnual,
      utilidadBruta: utilidadBrutaAnual,
      porcentajeUtilidadBruta: porcentajeUtilidadBrutaAnual,
      totalMovimientos: yearMovs.length
    }
  };
}

// Startup Initialization: Loads from sheet if local store is empty
export async function initContabilidadOnStartup(): Promise<void> {
  try {
    const local = loadLocalContabilidad();
    if (local.length === 0) {
      console.log('[contabilidadService] Almacén local vacío. Sincronizando desde Google Sheets...');
      await fetchGoogleSheetContabilidad();
    } else {
      console.log(`[contabilidadService] Almacén local inicializado con ${local.length} movimientos.`);
    }
  } catch (err) {
    console.error('[contabilidadService] Error on startup sync:', err);
  }
}
