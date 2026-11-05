import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';
import { loadLocalRH, getEmpleadosActivosRH, normalizeEmployeeName, EmpleadoRH } from './rhService.ts';

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

export interface SemanaChecadas {
  id: string; // e.g. "2026-W45"
  semana: number;
  anio: number;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  periodo: string; // "02-nov al 07-nov"
  cerrada: boolean;
  fechaCierre?: string;
  empleados: EmpleadoChecada[];
}

export interface ChecadasStore {
  semanaActiva: SemanaChecadas;
  historico: SemanaChecadas[];
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

// Calcular detalles de la semana según fecha
export function getWeekDetails(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  const curr = new Date(date);
  const day = curr.getDay(); // 0: Dom, 1: Lun
  const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(curr.getFullYear(), curr.getMonth(), diffToMonday);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const fmtDate = (dt: Date) => dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  const periodo = `${fmtDate(monday)} al ${fmtDate(saturday)}`;

  return {
    id: `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    semana: weekNo,
    anio: d.getUTCFullYear(),
    fechaInicio: monday.toISOString().slice(0, 10),
    fechaFin: saturday.toISOString().slice(0, 10),
    periodo
  };
}

export function loadStore(): ChecadasStore {
  try {
    const p = getStorePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.semanaActiva) return parsed;
      if (Array.isArray(parsed)) {
        // Migración de formato antiguo plano
        const initialWeek = getWeekDetails();
        return {
          semanaActiva: {
            ...initialWeek,
            cerrada: false,
            empleados: parsed
          },
          historico: []
        };
      }
    }
  } catch (err) {
    console.warn('[checadasService] Error reading store, initializing default:', err);
  }

  const initialWeek = getWeekDetails();
  return {
    semanaActiva: {
      ...initialWeek,
      cerrada: false,
      empleados: []
    },
    historico: []
  };
}

export function saveStore(store: ChecadasStore): void {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[checadasService] Error saving store:', err);
  }
}

export function loadLocalChecadas(): EmpleadoChecada[] {
  const store = loadStore();
  return store.semanaActiva?.empleados || [];
}

const DAY_COLS: Record<string, { startCol: string; endCol: string }> = {
  lunes: { startCol: 'J', endCol: 'M' },
  martes: { startCol: 'P', endCol: 'S' },
  miercoles: { startCol: 'V', endCol: 'Y' },
  jueves: { startCol: 'AB', endCol: 'AE' },
  viernes: { startCol: 'AH', endCol: 'AK' },
  sabado: { startCol: 'AN', endCol: 'AQ' }
};

// Sincronizar Semana Activa desde hoja Checadas y cargar histórico desde Historico_Checadas
export async function syncChecadasFromSheets(): Promise<{
  semanaActiva: SemanaChecadas;
  historico: SemanaChecadas[];
}> {
  const token = await getGoogleAccessToken();
  const store = loadStore();

  if (!token) {
    console.warn('[checadasService] No Google token available');
    return { semanaActiva: store.semanaActiva, historico: store.historico };
  }

  // 1. Fetch Checadas (Semana Activa) y sincronizar exclusivamente con Colaboradores ACTIVOS de RH
  try {
    const [activosRH, res] = await Promise.all([
      getEmpleadosActivosRH(),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/Checadas!A1:AS50?valueRenderOption=FORMATTED_VALUE`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    if (res.ok) {
      const data = await res.json();
      const rows: string[][] = data.values || [];

      // Mapear filas existentes en la hoja de Checadas por nombre normalizado
      const existingChecadasMap = new Map<string, { r: string[]; originalRow: number }>();
      for (let idx = 2; idx < rows.length; idx++) {
        const r = rows[idx];
        const rawName = (r[0] || '').trim();
        if (!rawName) continue;
        existingChecadasMap.set(normalizeEmployeeName(rawName), { r, originalRow: idx + 1 });
      }

      // Checadas debe ser alimentado SOLO por los activos de RH
      const parseDay = (r: string[], start: number): ChecadaDia => ({
        entrada1: (r[start] || '').trim(),
        salida1: (r[start + 1] || '').trim(),
        entrada2: (r[start + 2] || '').trim(),
        salida2: (r[start + 3] || '').trim(),
        total: (r[start + 4] || '0:00').trim(),
        extras: (r[start + 5] || '0:00').trim()
      });

      // Checadas debe ser alimentado SOLO por los activos de Planta (los choferes/ruteros no llevan checada)
      const activosPlanta = activosRH.filter(rhEmp => {
        const ts = (rhEmp.tipoSalario || '').trim().toLowerCase();
        const p = (rhEmp.puesto || '').trim().toLowerCase();
        const d = (rhEmp.departamento || '').trim().toLowerCase();
        const isRuteroOrRuta = ts === 'rutero' || p.includes('ruta') || p.includes('rutero') || p.includes('chofer') || d.includes('ruta') || d.includes('rutero');
        return !isRuteroOrRuta;
      });

      const empleados: EmpleadoChecada[] = activosPlanta.map((rhEmp, index) => {
        const rowNumber = index + 3; // En hoja Checadas los datos inician en fila 3
        const key = normalizeEmployeeName(rhEmp.nombreCompleto);
        const match = existingChecadasMap.get(key);
        const r = match ? match.r : [];

        const jornada = rhEmp.jornada || (r[1] || '58:00').trim();
        const tipoJornada = rhEmp.tipoSalario || (r[6] || 'jornada').trim();
        const esGerencia = tipoJornada.toLowerCase() === 'gerencia';

        const faltas = esGerencia ? 0 : (r[2] !== undefined && r[2] !== '' ? parseInt(r[2], 10) || 0 : 0);
        const jornadaIncompleta = esGerencia ? '' : (r[3] || '').trim();
        const incapacidades = parseInt(r[4], 10) || 0;
        const vacaciones = parseInt(r[5], 10) || 0;
        const extrasSemana = esGerencia ? '0:00' : (r[7] || '0:00').trim();
        const totalHorasSemana = (r[8] || (esGerencia ? '00:00' : '54:00')).trim();

        const emptyDay: ChecadaDia = { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' };

        return {
          rowNumber,
          nombre: rhEmp.nombreCompleto,
          jornada,
          faltas,
          jornadaIncompleta,
          incapacidades,
          vacaciones,
          tipoJornada,
          extrasSemana,
          totalHorasSemana,
          dias: {
            lunes: r.length > 9 ? parseDay(r, 9) : emptyDay,
            martes: r.length > 15 ? parseDay(r, 15) : emptyDay,
            miercoles: r.length > 21 ? parseDay(r, 21) : emptyDay,
            jueves: r.length > 27 ? parseDay(r, 27) : emptyDay,
            viernes: r.length > 33 ? parseDay(r, 33) : emptyDay,
            sabado: r.length > 39 ? parseDay(r, 39) : emptyDay
          }
        };
      });

      const weekInfo = getWeekDetails();
      store.semanaActiva = {
        ...weekInfo,
        cerrada: false,
        empleados
      };
    }
  } catch (err) {
    console.error('[checadasService] Error syncing Checadas active:', err);
  }

  // 2. Fetch Historico_Checadas from Sheets
  try {
    const histRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/'Historico_Checadas'!A2:AW2000?valueRenderOption=FORMATTED_VALUE`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (histRes.ok) {
      const histData = await histRes.json();
      const rows: string[][] = histData.values || [];
      const semanasMap = new Map<string, SemanaChecadas>();

      rows.forEach((r, idx) => {
        const semana = parseInt(r[0], 10);
        const anio = parseInt(r[1], 10);
        const periodo = (r[2] || '').trim();
        const nombre = (r[3] || '').trim();
        if (!semana || !anio || !nombre) return;

        const id = `${anio}-W${String(semana).padStart(2, '0')}`;
        if (!semanasMap.has(id)) {
          semanasMap.set(id, {
            id,
            semana,
            anio,
            fechaInicio: '',
            fechaFin: '',
            periodo,
            cerrada: true,
            fechaCierre: (r[48] || '').trim(),
            empleados: []
          });
        }

        const sem = semanasMap.get(id)!;
        sem.empleados.push({
          rowNumber: idx + 2,
          nombre,
          tipoJornada: (r[4] || 'jornada').trim(),
          jornada: (r[5] || '58:00').trim(),
          faltas: parseInt(r[6], 10) || 0,
          jornadaIncompleta: (r[7] || '').trim(),
          incapacidades: parseInt(r[8], 10) || 0,
          vacaciones: parseInt(r[9], 10) || 0,
          extrasSemana: (r[10] || '0:00').trim(),
          totalHorasSemana: (r[11] || '0:00').trim(),
          dias: {
            lunes: { entrada1: r[12] || '', salida1: r[13] || '', entrada2: r[14] || '', salida2: r[15] || '', total: r[16] || '0:00', extras: r[17] || '0:00' },
            martes: { entrada1: r[18] || '', salida1: r[19] || '', entrada2: r[20] || '', salida2: r[21] || '', total: r[22] || '0:00', extras: r[23] || '0:00' },
            miercoles: { entrada1: r[24] || '', salida1: r[25] || '', entrada2: r[26] || '', salida2: r[27] || '', total: r[28] || '0:00', extras: r[29] || '0:00' },
            jueves: { entrada1: r[30] || '', salida1: r[31] || '', entrada2: r[32] || '', salida2: r[33] || '', total: r[34] || '0:00', extras: r[35] || '0:00' },
            viernes: { entrada1: r[36] || '', salida1: r[37] || '', entrada2: r[38] || '', salida2: r[39] || '', total: r[40] || '0:00', extras: r[41] || '0:00' },
            sabado: { entrada1: r[42] || '', salida1: r[43] || '', entrada2: r[44] || '', salida2: r[45] || '', total: r[46] || '0:00', extras: r[47] || '0:00' }
          }
        });
      });

      // Merge into historico
      const sheetsHistorico = Array.from(semanasMap.values());
      // Ordenar más reciente primero
      sheetsHistorico.sort((a, b) => (b.anio * 100 + b.semana) - (a.anio * 100 + a.semana));
      store.historico = sheetsHistorico;
    }
  } catch (err) {
    console.error('[checadasService] Error syncing Historico_Checadas:', err);
  }

  saveStore(store);
  return { semanaActiva: store.semanaActiva, historico: store.historico };
}

// Actualizar Checada de un Día en la semana activa
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

  // Refrescar y guardar
  const synced = await syncChecadasFromSheets();
  return synced.semanaActiva.empleados.find(e => e.rowNumber === rowNumber) || null;
}

// Actualizar Incapacidades / Vacaciones en la semana activa
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
  return synced.semanaActiva.empleados.find(e => e.rowNumber === rowNumber) || null;
}

// Archivar la semana actual a Historico_Checadas y preparar nueva semana
export async function archivarSemanaActual(): Promise<{
  semanaArchivada: SemanaChecadas;
  nuevaSemanaActiva: SemanaChecadas;
}> {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('No se pudo autenticar con Google Sheets');

  // 1. Asegurar que los datos de la semana activa estén frescos desde Google Sheets
  const fresh = await syncChecadasFromSheets();
  const currentWeek = fresh.semanaActiva;
  const fechaCierre = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  // 2. Preparar filas para Historico_Checadas en Google Sheets
  const rowsToAppend = currentWeek.empleados.map(emp => [
    currentWeek.semana,
    currentWeek.anio,
    currentWeek.periodo,
    emp.nombre,
    emp.tipoJornada,
    emp.jornada,
    emp.faltas,
    emp.jornadaIncompleta,
    emp.incapacidades,
    emp.vacaciones,
    emp.extrasSemana,
    emp.totalHorasSemana,
    emp.dias.lunes.entrada1, emp.dias.lunes.salida1, emp.dias.lunes.entrada2, emp.dias.lunes.salida2, emp.dias.lunes.total, emp.dias.lunes.extras,
    emp.dias.martes.entrada1, emp.dias.martes.salida1, emp.dias.martes.entrada2, emp.dias.martes.salida2, emp.dias.martes.total, emp.dias.martes.extras,
    emp.dias.miercoles.entrada1, emp.dias.miercoles.salida1, emp.dias.miercoles.entrada2, emp.dias.miercoles.salida2, emp.dias.miercoles.total, emp.dias.miercoles.extras,
    emp.dias.jueves.entrada1, emp.dias.jueves.salida1, emp.dias.jueves.entrada2, emp.dias.jueves.salida2, emp.dias.jueves.total, emp.dias.jueves.extras,
    emp.dias.viernes.entrada1, emp.dias.viernes.salida1, emp.dias.viernes.entrada2, emp.dias.viernes.salida2, emp.dias.viernes.total, emp.dias.viernes.extras,
    emp.dias.sabado.entrada1, emp.dias.sabado.salida1, emp.dias.sabado.entrada2, emp.dias.sabado.salida2, emp.dias.sabado.total, emp.dias.sabado.extras,
    fechaCierre
  ]);

  console.log(`[checadasService] Archivando ${rowsToAppend.length} registros en Historico_Checadas...`);
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/'Historico_Checadas'!A:AW:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rowsToAppend })
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    console.error('[checadasService] Error appending to Historico_Checadas:', errText);
    throw new Error(`Error al respaldar histórico en Google Sheets: ${errText}`);
  }

  // 3. Limpiar celdas de captura en la hoja Checadas para la nueva semana:
  // Limpiar columnas E:F (Incapacidades / Vacaciones) y J:M, P:S, V:Y, AB:AE, AH:AK, AN:AQ
  const clearRanges = [
    `Checadas!E3:F50`,
    `Checadas!J3:M50`,
    `Checadas!P3:S50`,
    `Checadas!V3:Y50`,
    `Checadas!AB3:AE50`,
    `Checadas!AH3:AK50`,
    `Checadas!AN3:AQ50`
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values:batchClear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ranges: clearRanges })
  });

  // 4. Calcular detalles de la siguiente semana
  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextWeekDetails = getWeekDetails(nextMonday);

  // Actualizar A1 de Checadas con el título de la nueva semana
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/Checadas!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [[`Semana ${nextWeekDetails.semana} - ${nextWeekDetails.anio} (${nextWeekDetails.periodo})`]] })
  });

  // 5. Actualizar store local
  const store = loadStore();
  const archivedWeek: SemanaChecadas = {
    ...currentWeek,
    cerrada: true,
    fechaCierre
  };

  store.historico.unshift(archivedWeek);

  // Reset semana activa
  store.semanaActiva = {
    ...nextWeekDetails,
    cerrada: false,
    empleados: currentWeek.empleados.map(e => ({
      ...e,
      faltas: e.tipoJornada === 'Gerencia' ? 0 : 7,
      jornadaIncompleta: e.tipoJornada === 'jornada' ? '0:00' : '',
      incapacidades: 0,
      vacaciones: 0,
      extrasSemana: '0:00',
      totalHorasSemana: '0:00',
      dias: {
        lunes: { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' },
        martes: { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' },
        miercoles: { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' },
        jueves: { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' },
        viernes: { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' },
        sabado: { entrada1: '', salida1: '', entrada2: '', salida2: '', total: '0:00', extras: '0:00' }
      }
    }))
  };

  saveStore(store);
  return {
    semanaArchivada: archivedWeek,
    nuevaSemanaActiva: store.semanaActiva
  };
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
  console.log('[checadasService] Inicializando servicio de Checadas e Histórico...');
  try {
    const res = await syncChecadasFromSheets();
    console.log(`[checadasService] Checadas activa: ${res.semanaActiva.id} (${res.semanaActiva.empleados.length} colaboradores). Histórico: ${res.historico.length} semanas previas.`);
  } catch (err) {
    console.warn('[checadasService] Advertencia al sincronizar checadas en arranque:', err);
  }
}
