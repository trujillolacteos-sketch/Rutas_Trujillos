import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';
import { loadLocalRH } from './rhService.ts';

const NEW_SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const CHECADAS_STORE_FILE = 'checadas_store.json';
const CHECADAS_SHEET_ID = 230064923;

export interface ChecadaDia {
  entrada1: string;
  salida1: string;
  entrada2: string;
  salida2: string;
  total: string;
  extras: string;
}

export interface EmpleadoChecada {
  rowNumber: number;
  nombre: string;
  jornada: string;
  faltas: number;
  jornadaIncompleta: string;
  incapacidades: number;
  vacaciones: number;
  tipoJornada: string;
  extrasSemana: string;
  totalHorasSemana: string;
  dias: {
    lunes: ChecadaDia;
    martes: ChecadaDia;
    miercoles: ChecadaDia;
    jueves: ChecadaDia;
    viernes: ChecadaDia;
    sabado: ChecadaDia;
  };
}

export interface ChecadasStats {
  totalEmpleados: number;
  totalFaltas: number;
  empleadosConFaltas: number;
  totalHorasExtras: string;
  totalHorasTrabajadas: string;
}

function getStorePath(): string {
  return path.resolve(process.cwd(), CHECADAS_STORE_FILE);
}

export function loadLocalChecadas(): EmpleadoChecada[] {
  try {
    const p = getStorePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[checadasService] Error reading local store:', err);
  }
  return [];
}

export function saveLocalChecadas(data: EmpleadoChecada[]): void {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[checadasService] Error saving local store:', err);
  }
}

const DAY_COLS: Record<string, { startCol: string; endCol: string; colIndices: number[] }> = {
  lunes: { startCol: 'J', endCol: 'M', colIndices: [9, 10, 11, 12] },
  martes: { startCol: 'P', endCol: 'S', colIndices: [15, 16, 17, 18] },
  miercoles: { startCol: 'V', endCol: 'Y', colIndices: [21, 22, 23, 24] },
  jueves: { startCol: 'AB', endCol: 'AE', colIndices: [27, 28, 29, 30] },
  viernes: { startCol: 'AH', endCol: 'AK', colIndices: [33, 34, 35, 36] },
  sabado: { startCol: 'AN', endCol: 'AQ', colIndices: [39, 40, 41, 42] }
};

export async function syncChecadasFromSheets(): Promise<{ count: number; empleados: EmpleadoChecada[] }> {
  const token = await getGoogleAccessToken();
  if (!token) {
    console.warn('[checadasService] No Google token available, returning local store');
    return { count: 0, empleados: loadLocalChecadas() };
  }

  // Fetch formatted values
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/Checadas!A1:AS50?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[checadasService] Error fetching Checadas:', errText);
    return { count: 0, empleados: loadLocalChecadas() };
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  const empleados: EmpleadoChecada[] = [];

  // Rows 3+ are employees (index 2+)
  for (let idx = 2; idx < rows.length; idx++) {
    const r = rows[idx];
    const nombre = (r[0] || '').trim();
    if (!nombre) continue;

    const rowNumber = idx + 1; // 1-based

    const parseDay = (start: number): ChecadaDia => ({
      entrada1: (r[start] || '').trim(),
      salida1: (r[start + 1] || '').trim(),
      entrada2: (r[start + 2] || '').trim(),
      salida2: (r[start + 3] || '').trim(),
      total: (r[start + 4] || '0:00').trim(),
      extras: (r[start + 5] || '0:00').trim()
    });

    empleados.push({
      rowNumber,
      nombre,
      jornada: (r[1] || '58:00').trim(),
      faltas: parseInt(r[2], 10) || 0,
      jornadaIncompleta: (r[3] || '').trim(),
      incapacidades: parseInt(r[4], 10) || 0,
      vacaciones: parseInt(r[5], 10) || 0,
      tipoJornada: (r[6] || 'jornada').trim(),
      extrasSemana: (r[7] || '0:00').trim(),
      totalHorasSemana: (r[8] || '0:00').trim(),
      dias: {
        lunes: parseDay(9),
        martes: parseDay(15),
        miercoles: parseDay(21),
        jueves: parseDay(27),
        viernes: parseDay(33),
        sabado: parseDay(39)
      }
    });
  }

  saveLocalChecadas(empleados);
  return { count: empleados.length, empleados };
}

export async function updateChecadaDay(
  rowNumber: number,
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado',
  horas: { entrada1?: string; salida1?: string; entrada2?: string; salida2?: string }
): Promise<EmpleadoChecada | null> {
  const meta = DAY_COLS[dia];
  if (!meta) throw new Error(`Día no válido: ${dia}`);

  const token = await getGoogleAccessToken();
  if (!token) throw new Error('No se pudo autenticar con Google Sheets');

  const range = `Checadas!${meta.startCol}${rowNumber}:${meta.endCol}${rowNumber}`;
  const values = [[
    horas.entrada1 || '',
    horas.salida1 || '',
    horas.entrada2 || '',
    horas.salida2 || ''
  ]];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al actualizar Google Sheets: ${errText}`);
  }

  // Re-fetch sheet to get updated calculated values
  const synced = await syncChecadasFromSheets();
  return synced.empleados.find(e => e.rowNumber === rowNumber) || null;
}

export async function updateIncapacidadesVacaciones(
  rowNumber: number,
  incapacidades: number,
  vacaciones: number
): Promise<EmpleadoChecada | null> {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('No se pudo autenticar con Google Sheets');

  const range = `Checadas!E${rowNumber}:F${rowNumber}`;
  const values = [[incapacidades, vacaciones]];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al actualizar Google Sheets: ${errText}`);
  }

  const synced = await syncChecadasFromSheets();
  return synced.empleados.find(e => e.rowNumber === rowNumber) || null;
}

export function getChecadasStats(empleados: EmpleadoChecada[]): ChecadasStats {
  let totalFaltas = 0;
  let empleadosConFaltas = 0;

  empleados.forEach(emp => {
    if (emp.faltas > 0) {
      totalFaltas += emp.faltas;
      empleadosConFaltas++;
    }
  });

  return {
    totalEmpleados: empleados.length,
    totalFaltas,
    empleadosConFaltas,
    totalHorasExtras: 'Calculado por semana',
    totalHorasTrabajadas: 'Calculado por semana'
  };
}

export async function initChecadasOnStartup(): Promise<void> {
  console.log('[checadasService] Inicializando servicio de Checadas...');
  try {
    const res = await syncChecadasFromSheets();
    console.log(`[checadasService] Inicializados ${res.count} registros de checadas.`);
  } catch (err) {
    console.warn('[checadasService] Advertencia al sincronizar checadas en arranque:', err);
  }
}
