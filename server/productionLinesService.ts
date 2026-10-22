import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const NEW_SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const KEY_FILE = 'google-drive-key.json';
const LINES_STORE_FILE = 'production_lines_store.json';

export type ProductionLineId = 
  | 'descremado_pasteurizado'
  | 'queso_pizzero'
  | 'quesos_calientes'
  | 'quesos_frescos'
  | 'quesos_frios';

export interface ProductionLineReport {
  id: string;
  lineId: ProductionLineId;
  lineNombre: string;
  fecha: string;
  fechaCaptura: string;
  operador: string;
  horaRecepcion?: string;
  horaFinalizacion?: string;
  recibio?: string;
  procesoEstado?: string;
  
  // Recepción de Leche
  lecheEnteraLitros?: number;
  ranchoEntera?: string;
  pipaEntera?: string;
  lecheDescremadaLitros?: number;
  ranchoDescremada?: string;
  pipaDescremada?: string;

  // Rendimientos generales
  kgObtenidos?: number;
  sueroObtenido?: number;
  cremaNatural?: number;
  sobrante?: number;
  merma?: number;
  formulado?: number;

  // Existencias en termo (Línea Descremado)
  termoInicial?: number;
  termoUtilizados?: number;
  termoEnviados?: number;
  termoCierre?: number;

  // Insumos utilizados (Formulación)
  insumos?: Record<string, number | string>;

  // Empaque / Presentaciones terminadas
  empaque?: Record<string, { piezas?: number; kgTotal?: number }>;

  // Notas
  notas?: string;
}

// ----------------------------------------------------
// Google Sheets Auth & Append
// ----------------------------------------------------
async function getGoogleAuthToken(): Promise<string | null> {
  try {
    const keyPath = path.resolve(process.cwd(), KEY_FILE);
    if (!fs.existsSync(keyPath)) {
      console.warn('[productionLinesService] Key file not found:', keyPath);
      return null;
    }
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claim}`);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!res.ok) {
      console.error('[productionLinesService] Error getting auth token:', await res.text());
      return null;
    }

    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('[productionLinesService] JWT generation failed:', err);
    return null;
  }
}

async function appendReportToSheet(report: ProductionLineReport): Promise<boolean> {
  try {
    const token = await getGoogleAuthToken();
    if (!token) return false;

    // Resumen de Insumos formateado
    let resumenInsumos = '';
    if (report.insumos) {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(report.insumos)) {
        if (v !== '' && v !== null && v !== undefined && Number(v) !== 0) {
          parts.push(`${k}: ${v}`);
        }
      }
      resumenInsumos = parts.join(' | ');
    }

    // Resumen de Empaque / Presentaciones formateado
    let resumenEmpaque = '';
    if (report.empaque) {
      const parts: string[] = [];
      for (const [prod, det] of Object.entries(report.empaque)) {
        const pz = det.piezas ? `${det.piezas} pz` : '';
        const kg = det.kgTotal ? `${det.kgTotal} kg` : '';
        const combo = [pz, kg].filter(Boolean).join(' - ');
        if (combo) parts.push(`${prod}: ${combo}`);
      }
      resumenEmpaque = parts.join(' | ');
    }

    const row = [
      report.id,
      report.fecha,
      report.lineNombre,
      report.recibio || report.operador || '',
      report.horaRecepcion || '',
      report.horaFinalizacion || '',
      report.procesoEstado || '',
      report.lecheEnteraLitros != null ? report.lecheEnteraLitros : '',
      [report.ranchoEntera, report.pipaEntera].filter(Boolean).join(' / '),
      report.lecheDescremadaLitros != null ? report.lecheDescremadaLitros : '',
      [report.ranchoDescremada, report.pipaDescremada].filter(Boolean).join(' / '),
      report.kgObtenidos != null ? report.kgObtenidos : '',
      report.sueroObtenido != null ? report.sueroObtenido : '',
      report.cremaNatural != null ? report.cremaNatural : '',
      report.termoInicial != null ? report.termoInicial : '',
      report.termoUtilizados != null ? report.termoUtilizados : '',
      report.termoEnviados != null ? report.termoEnviados : '',
      report.termoCierre != null ? report.termoCierre : '',
      resumenInsumos,
      resumenEmpaque,
      report.sobrante != null ? report.sobrante : '',
      report.merma != null ? report.merma : '',
      report.notas || '',
      report.fechaCaptura
    ];

    const range = encodeURIComponent("'Líneas de Producción'!A:X");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    });

    if (!res.ok) {
      console.error('[productionLinesService] Failed to append to sheet:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[productionLinesService] appendReportToSheet error:', err);
    return false;
  }
}

// ----------------------------------------------------
// Local Store Management
// ----------------------------------------------------
export function loadLocalLineReports(): ProductionLineReport[] {
  try {
    const filePath = path.resolve(process.cwd(), LINES_STORE_FILE);
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[productionLinesService] Error reading lines store:', err);
    return [];
  }
}

export function saveLocalLineReports(reports: ProductionLineReport[]): void {
  try {
    const filePath = path.resolve(process.cwd(), LINES_STORE_FILE);
    fs.writeFileSync(filePath, JSON.stringify(reports, null, 2), 'utf8');
  } catch (err) {
    console.error('[productionLinesService] Error writing lines store:', err);
  }
}

// ----------------------------------------------------
// Create / Delete Reports
// ----------------------------------------------------
export async function createLineReport(data: Partial<ProductionLineReport>): Promise<{
  success: boolean;
  message: string;
  report?: ProductionLineReport;
  sheetSynced?: boolean;
}> {
  try {
    if (!data.lineId || !data.fecha) {
      return { success: false, message: 'La línea de producción y la fecha son obligatorias.' };
    }

    const lineNames: Record<ProductionLineId, string> = {
      descremado_pasteurizado: 'Descremado y Pasteurizado',
      queso_pizzero: 'Queso Pizzero',
      quesos_calientes: 'Quesos Calientes (Asadero / Mozzarella)',
      quesos_frescos: 'Quesos Frescos (Panela / Adobera / Ranchero)',
      quesos_frios: 'Quesos Fríos (Oaxaca / Manchego / Cheddar / Chihuahua)'
    };

    const newReport: ProductionLineReport = {
      id: `LINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      lineId: data.lineId as ProductionLineId,
      lineNombre: lineNames[data.lineId as ProductionLineId] || data.lineId,
      fecha: data.fecha,
      fechaCaptura: new Date().toISOString(),
      operador: data.operador || 'Operador Planta',
      horaRecepcion: data.horaRecepcion,
      horaFinalizacion: data.horaFinalizacion,
      recibio: data.recibio,
      procesoEstado: data.procesoEstado,
      lecheEnteraLitros: data.lecheEnteraLitros,
      ranchoEntera: data.ranchoEntera,
      pipaEntera: data.pipaEntera,
      lecheDescremadaLitros: data.lecheDescremadaLitros,
      ranchoDescremada: data.ranchoDescremada,
      pipaDescremada: data.pipaDescremada,
      kgObtenidos: data.kgObtenidos,
      sueroObtenido: data.sueroObtenido,
      cremaNatural: data.cremaNatural,
      sobrante: data.sobrante,
      merma: data.merma,
      formulado: data.formulado,
      termoInicial: data.termoInicial,
      termoUtilizados: data.termoUtilizados,
      termoEnviados: data.termoEnviados,
      termoCierre: data.termoCierre,
      insumos: data.insumos || {},
      empaque: data.empaque || {},
      notas: data.notas || ''
    };

    // Save locally
    const reports = loadLocalLineReports();
    reports.unshift(newReport);
    saveLocalLineReports(reports);

    // Sync to Google Sheet asynchronously
    const sheetSynced = await appendReportToSheet(newReport);

    return {
      success: true,
      message: sheetSynced 
        ? `¡Reporte diario guardado y sincronizado exitosamente con Google Sheets!` 
        : `¡Reporte diario guardado localmente! (Se sincronizará con Google Sheets al reconectar)`,
      report: newReport,
      sheetSynced
    };
  } catch (err: any) {
    console.error('[productionLinesService] Error in createLineReport:', err);
    return { success: false, message: err.message || 'Error al guardar el reporte' };
  }
}

export function deleteLineReport(id: string): { success: boolean; message: string } {
  try {
    let reports = loadLocalLineReports();
    const prevLen = reports.length;
    reports = reports.filter(r => r.id !== id);
    if (reports.length === prevLen) {
      return { success: false, message: 'Reporte no encontrado' };
    }
    saveLocalLineReports(reports);
    return { success: true, message: 'Reporte eliminado correctamente' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
