import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';

const NEW_SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const RH_STORE_FILE = 'rh_store.json';

export interface EmpleadoRH {
  id: string; // e.g. "1005"
  numeroEmpleado: number;
  estatus: 'ACTIVO' | 'INACTIVO';
  primerApellido: string;
  segundoApellido: string;
  nombre: string;
  nombreCompleto: string;
  fechaNacimiento?: string; // DD/MM/YYYY
  curp?: string;
  telefonoWhatsapp?: string;
  correoElectronico?: string;
  contactoEmergenciaTelefono?: string;
  contactoEmergenciaParentesco?: string;
  contactoEmergenciaNombre?: string;
  puesto: string;
  sueldoBase: number;
  sueldoBaseTexto: string;
  fechaIngreso?: string; // DD/MM/YYYY
  fechaBaja?: string; // DD/MM/YYYY
  departamento: string;
  tipoSalario: string; // 'jornada' | 'fijo' | 'hora' | 'gerencia'
  jornada?: string; // e.g. "58:00"
  rowNumber: number; // 1-based row in Google Sheets
  edad?: number;
  antiguedad?: string;
}

// Normaliza nombres para garantizar coincidencia 100% inmune a dobles espacios, mayúsculas y acentos
export function normalizeEmployeeName(name?: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export interface RHStats {
  totalPlantilla: number;
  totalActivos: number;
  totalInactivos: number;
  masaSalarialSemanalActiva: number;
  departamentos: { depto: string; total: number; activos: number }[];
  puestos: { puesto: string; total: number; activos: number }[];
  tiposSalario: { tipo: string; total: number }[];
}

function getStorePath(): string {
  return path.resolve(process.cwd(), RH_STORE_FILE);
}

// Parse currency string like "$2,200.00" to 2200
export function parseCurrency(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

// Calculate age from DD/MM/YYYY or YYYY-MM-DD
export function calculateEdad(fechaStr?: string): number | undefined {
  if (!fechaStr) return undefined;
  const parts = fechaStr.split(/[\/\-]/);
  if (parts.length !== 3) return undefined;
  let d = 1, m = 1, y = 2000;
  if (parts[0].length === 4) {
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    y = parseInt(parts[2], 10);
  }
  const birth = new Date(y, m, d);
  if (isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const mDiff = now.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 && age < 120 ? age : undefined;
}

// Calculate seniority from DD/MM/YYYY to now or fechaBaja
export function calculateAntiguedad(fechaIngreso?: string, fechaBaja?: string): string {
  if (!fechaIngreso) return 'No registrada';
  const parts = fechaIngreso.split(/[\/\-]/);
  if (parts.length !== 3) return 'No registrada';
  let d = 1, m = 1, y = 2000;
  if (parts[0].length === 4) {
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    y = parseInt(parts[2], 10);
  }
  const start = new Date(y, m, d);
  if (isNaN(start.getTime())) return 'No registrada';

  let end = new Date();
  if (fechaBaja) {
    const bParts = fechaBaja.split(/[\/\-]/);
    if (bParts.length === 3) {
      const by = bParts[0].length === 4 ? parseInt(bParts[0], 10) : parseInt(bParts[2], 10);
      const bm = parseInt(bParts[1], 10) - 1;
      const bd = bParts[0].length === 4 ? parseInt(bParts[2], 10) : parseInt(bParts[0], 10);
      const bDate = new Date(by, bm, bd);
      if (!isNaN(bDate.getTime())) end = bDate;
    }
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 'Reciente';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30.4375);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  if (years > 0) {
    return remMonths > 0 ? `${years} a, ${remMonths} m` : `${years} a`;
  }
  if (months > 0) {
    return `${months} meses`;
  }
  return `${days} días`;
}

// Normaliza texto de departamentos y puestos
export function normalizeDepto(depto?: string): string {
  const d = (depto || '').trim().toUpperCase();
  if (!d) return 'SIN ASIGNAR';
  if (d.includes('PRODUC') || d.includes('PRDUC')) return 'PRODUCCIÓN';
  if (d.includes('GERENC')) return 'GERENCIA';
  if (d.includes('RUTA')) return 'RUTA';
  if (d.includes('ADMIN')) return 'ADMINISTRACIÓN';
  return d;
}

export function normalizePuesto(puesto?: string): string {
  const p = (puesto || '').trim().toUpperCase();
  if (!p) return 'SIN ASIGNAR';
  if (p.includes('JEFE') && p.includes('PRODUC')) return 'JEFE DE PRODUCCIÓN';
  if (p.includes('EMPAC')) return 'EMPACADORA';
  if (p.includes('DESCREM')) return 'DESCREMADORA';
  if (p.includes('FRESCO')) return 'FRESCO';
  if (p.includes('PRODUC')) return 'PRODUCCIÓN';
  if (p.includes('AUXILIAR') && p.includes('GERENC')) return 'AUXILIAR DE GERENCIA';
  if (p.includes('GERENC')) return 'GERENCIA';
  if (p.includes('RUTA')) return 'RUTA';
  return p;
}

// Local storage
export function loadLocalRH(): EmpleadoRH[] {
  const p = getStorePath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[rhService] Error leyendo rh_store.json:', err);
    return [];
  }
}

export function saveLocalRH(empleados: EmpleadoRH[]): void {
  const p = getStorePath();
  try {
    fs.writeFileSync(p, JSON.stringify(empleados, null, 2), 'utf8');
  } catch (err) {
    console.error('[rhService] Error guardando rh_store.json:', err);
  }
}

// Sincronización completa desde Google Sheets
export async function syncRHFromSheets(): Promise<{ count: number; empleados: EmpleadoRH[] }> {
  try {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (!token) throw new Error('No se pudo autenticar con Google Sheets API');

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/RH!A2:T1000`, {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) {
      console.error('[rhService] Falló lectura de hoja RH:', await res.text());
      return { count: 0, empleados: loadLocalRH() };
    }

    const data = await res.json();
    const rows = data.values || [];
    const empleados: EmpleadoRH[] = [];

    rows.forEach((r: any[], idx: number) => {
      const rowNumber = idx + 2; // Row 1 is header
      const estatusRaw = (r[0] || '').trim().toUpperCase();
      const numRaw = parseInt(String(r[18] || '').trim(), 10);
      const nombre = (r[3] || '').trim();
      const nombreCompleto = (r[4] || '').trim() || `${r[3] || ''} ${r[1] || ''} ${r[2] || ''}`.trim();

      // Descartar filas plantilla vacías (donde no hay nombre ni nombre completo)
      if (!nombre && !nombreCompleto && isNaN(numRaw)) return;
      if (!nombre && !nombreCompleto && (r[1] || '') === '' && (r[2] || '') === '') {
        // Es fila plantilla con solo número
        return;
      }

      const numEmp = !isNaN(numRaw) && numRaw > 0 ? numRaw : (1000 + empleados.length + 1);
      const estatus = estatusRaw === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO';
      const sueldoNum = parseCurrency(r[13]);
      const fechaNac = (r[5] || '').trim();
      const fechaIng = (r[14] || '').trim();
      const fechaBaj = (r[15] || '').trim();
      const jornada = (r[19] || '').trim() || '58:00';

      empleados.push({
        id: String(numEmp),
        numeroEmpleado: numEmp,
        estatus,
        primerApellido: (r[1] || '').trim(),
        segundoApellido: (r[2] || '').trim(),
        nombre,
        nombreCompleto: nombreCompleto || `${nombre} ${r[1] || ''} ${r[2] || ''}`.trim(),
        fechaNacimiento: fechaNac || undefined,
        curp: (r[6] || '').trim() || undefined,
        telefonoWhatsapp: (r[7] || '').trim() || undefined,
        correoElectronico: (r[8] || '').trim() || undefined,
        contactoEmergenciaTelefono: (r[9] || '').trim() || undefined,
        contactoEmergenciaParentesco: (r[10] || '').trim() || undefined,
        contactoEmergenciaNombre: (r[11] || '').trim() || undefined,
        puesto: (r[12] || '').trim() || 'PRODUCCIÓN',
        sueldoBase: sueldoNum,
        sueldoBaseTexto: (r[13] || '').trim() || `$${sueldoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        fechaIngreso: fechaIng || undefined,
        fechaBaja: fechaBaj || undefined,
        departamento: (r[16] || '').trim() || 'PRODUCCIÓN',
        tipoSalario: (r[17] || '').trim().toLowerCase() || 'jornada',
        jornada,
        rowNumber,
        edad: calculateEdad(fechaNac),
        antiguedad: calculateAntiguedad(fechaIng, fechaBaj)
      });
    });

    // Ordenar por número de empleado
    empleados.sort((a, b) => a.numeroEmpleado - b.numeroEmpleado);

    saveLocalRH(empleados);
    console.log(`[rhService] Sincronizados ${empleados.length} colaboradores desde hoja RH`);
    return { count: empleados.length, empleados };
  } catch (err: any) {
    console.error('[rhService] Error en syncRHFromSheets:', err);
    return { count: 0, empleados: loadLocalRH() };
  }
}

// Obtener únicamente los colaboradores con estatus ACTIVO (alimentador maestro de Checadas y Nómina)
export async function getEmpleadosActivosRH(forceSync = false): Promise<EmpleadoRH[]> {
  let all = loadLocalRH();
  if (all.length === 0 || forceSync) {
    const synced = await syncRHFromSheets();
    all = synced.empleados;
  }
  return all.filter(e => (e.estatus || '').trim().toUpperCase() === 'ACTIVO');
}

// Inicialización al arrancar el servidor
export async function initRHOnStartup(): Promise<void> {
  const local = loadLocalRH();
  if (local.length === 0) {
    console.log('[rhService] Almacén local vacío. Sincronizando desde hoja RH...');
    await syncRHFromSheets();
  } else {
    console.log(`[rhService] Almacén local inicializado con ${local.length} colaboradores.`);
  }
}

// Estadísticas generales para el dashboard de RH
export function getRHStats(empleados: EmpleadoRH[]): RHStats {
  const activos = empleados.filter(e => e.estatus === 'ACTIVO');
  const inactivos = empleados.filter(e => e.estatus === 'INACTIVO');

  let masaSalarial = 0;
  activos.forEach(e => {
    // Si el tipo es hora (ej $51.85), se estima semana de 48 hrs
    if (e.tipoSalario === 'hora' && e.sueldoBase < 200) {
      masaSalarial += e.sueldoBase * 48;
    } else {
      masaSalarial += e.sueldoBase;
    }
  });

  const deptoMap: Record<string, { total: number; activos: number }> = {};
  const puestoMap: Record<string, { total: number; activos: number }> = {};
  const salarioMap: Record<string, number> = {};

  empleados.forEach(e => {
    const d = normalizeDepto(e.departamento);
    if (!deptoMap[d]) deptoMap[d] = { total: 0, activos: 0 };
    deptoMap[d].total++;
    if (e.estatus === 'ACTIVO') deptoMap[d].activos++;

    const p = normalizePuesto(e.puesto);
    if (!puestoMap[p]) puestoMap[p] = { total: 0, activos: 0 };
    puestoMap[p].total++;
    if (e.estatus === 'ACTIVO') puestoMap[p].activos++;

    const s = e.tipoSalario || 'jornada';
    salarioMap[s] = (salarioMap[s] || 0) + 1;
  });

  return {
    totalPlantilla: empleados.length,
    totalActivos: activos.length,
    totalInactivos: inactivos.length,
    masaSalarialSemanalActiva: Number(masaSalarial.toFixed(2)),
    departamentos: Object.entries(deptoMap).map(([depto, stats]) => ({ depto, ...stats })),
    puestos: Object.entries(puestoMap).map(([puesto, stats]) => ({ puesto, ...stats })),
    tiposSalario: Object.entries(salarioMap).map(([tipo, total]) => ({ tipo, total }))
  };
}

// Obtener siguiente número de empleado disponible
export function getNextNumeroEmpleado(): number {
  const empleados = loadLocalRH();
  if (empleados.length === 0) return 1001;
  const maxNum = Math.max(...empleados.map(e => e.numeroEmpleado || 1000));
  return Math.max(maxNum + 1, 1001);
}

// Dar de alta un nuevo empleado en Google Sheets y local
export async function createEmpleado(data: Partial<EmpleadoRH>): Promise<EmpleadoRH> {
  const empleados = loadLocalRH();
  const nextNum = data.numeroEmpleado || getNextNumeroEmpleado();
  const nombreCompleto = data.nombreCompleto || `${data.nombre || ''} ${data.primerApellido || ''} ${data.segundoApellido || ''}`.trim();
  const sueldoNum = parseCurrency(data.sueldoBase);
  const sueldoTexto = data.sueldoBaseTexto || `$${sueldoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  // La fila en Google Sheets corresponde a nextNum - 999 (ej. 1059 -> fila 60)
  const targetRowNumber = nextNum - 999 > 1 ? nextNum - 999 : (empleados.length + 2);

  const newEmp: EmpleadoRH = {
    id: String(nextNum),
    numeroEmpleado: nextNum,
    estatus: data.estatus || 'ACTIVO',
    primerApellido: (data.primerApellido || '').trim().toUpperCase(),
    segundoApellido: (data.segundoApellido || '').trim().toUpperCase(),
    nombre: (data.nombre || '').trim().toUpperCase(),
    nombreCompleto: nombreCompleto.toUpperCase(),
    fechaNacimiento: data.fechaNacimiento || '',
    curp: (data.curp || '').trim().toUpperCase(),
    telefonoWhatsapp: (data.telefonoWhatsapp || '').trim(),
    correoElectronico: (data.correoElectronico || '').trim(),
    contactoEmergenciaTelefono: (data.contactoEmergenciaTelefono || '').trim(),
    contactoEmergenciaParentesco: (data.contactoEmergenciaParentesco || '').trim().toUpperCase(),
    contactoEmergenciaNombre: (data.contactoEmergenciaNombre || '').trim().toUpperCase(),
    puesto: (data.puesto || 'PRODUCCIÓN').trim().toUpperCase(),
    sueldoBase: sueldoNum,
    sueldoBaseTexto: sueldoTexto,
    fechaIngreso: data.fechaIngreso || new Date().toLocaleDateString('es-MX'),
    fechaBaja: data.fechaBaja || '',
    departamento: (data.departamento || 'PRODUCCIÓN').trim().toUpperCase(),
    tipoSalario: (data.tipoSalario || 'jornada').trim().toLowerCase(),
    rowNumber: targetRowNumber,
    edad: calculateEdad(data.fechaNacimiento),
    antiguedad: calculateAntiguedad(data.fechaIngreso || new Date().toLocaleDateString('es-MX'), data.fechaBaja)
  };

  // Escribir en Google Sheets
  await writeEmpleadoRowToSheets(newEmp);

  // Guardar en almacén local
  const existingIdx = empleados.findIndex(e => e.numeroEmpleado === nextNum);
  if (existingIdx >= 0) {
    empleados[existingIdx] = newEmp;
  } else {
    empleados.push(newEmp);
  }
  empleados.sort((a, b) => a.numeroEmpleado - b.numeroEmpleado);
  saveLocalRH(empleados);

  return newEmp;
}

// Actualizar empleado
export async function updateEmpleado(id: string, updates: Partial<EmpleadoRH>): Promise<EmpleadoRH> {
  const empleados = loadLocalRH();
  const empIdx = empleados.findIndex(e => e.id === id || String(e.numeroEmpleado) === id);
  if (empIdx < 0) throw new Error(`Empleado con ID ${id} no encontrado`);

  const current = empleados[empIdx];
  const sueldoNum = updates.sueldoBase !== undefined ? parseCurrency(updates.sueldoBase) : current.sueldoBase;
  const sueldoTexto = updates.sueldoBaseTexto || (updates.sueldoBase !== undefined ? `$${sueldoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : current.sueldoBaseTexto);

  const updated: EmpleadoRH = {
    ...current,
    ...updates,
    sueldoBase: sueldoNum,
    sueldoBaseTexto: sueldoTexto,
    edad: updates.fechaNacimiento ? calculateEdad(updates.fechaNacimiento) : current.edad,
    antiguedad: calculateAntiguedad(updates.fechaIngreso || current.fechaIngreso, updates.fechaBaja || current.fechaBaja)
  };

  // Reconstruir nombre completo si se editaron partes
  if (updates.nombre || updates.primerApellido || updates.segundoApellido) {
    updated.nombreCompleto = `${updated.nombre} ${updated.primerApellido} ${updated.segundoApellido}`.trim();
  }

  // Escribir en Google Sheets
  await writeEmpleadoRowToSheets(updated);

  // Actualizar almacén local
  empleados[empIdx] = updated;
  saveLocalRH(empleados);

  return updated;
}

// Dar de baja a un empleado
export async function darDeBajaEmpleado(id: string, fechaBaja?: string, motivo?: string): Promise<EmpleadoRH> {
  const fBaja = fechaBaja || new Date().toLocaleDateString('es-MX');
  return updateEmpleado(id, {
    estatus: 'INACTIVO',
    fechaBaja: fBaja
  });
}

// Reactivar empleado
export async function reactivarEmpleado(id: string, nuevaFechaIngreso?: string): Promise<EmpleadoRH> {
  return updateEmpleado(id, {
    estatus: 'ACTIVO',
    fechaBaja: '',
    fechaIngreso: nuevaFechaIngreso || new Date().toLocaleDateString('es-MX')
  });
}

// Escribe fila A:T en Google Sheets por número de fila
async function writeEmpleadoRowToSheets(emp: EmpleadoRH): Promise<boolean> {
  try {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (!token) throw new Error('No se pudo autenticar con Google');

    const rowNumber = emp.rowNumber || (emp.numeroEmpleado - 999);
    const range = `RH!A${rowNumber}:T${rowNumber}`;

    const values = [[
      emp.estatus,
      emp.primerApellido,
      emp.segundoApellido,
      emp.nombre,
      emp.nombreCompleto,
      emp.fechaNacimiento || '',
      emp.curp || '',
      emp.telefonoWhatsapp || '',
      emp.correoElectronico || '',
      emp.contactoEmergenciaTelefono || '',
      emp.contactoEmergenciaParentesco || '',
      emp.contactoEmergenciaNombre || '',
      emp.puesto,
      emp.sueldoBaseTexto,
      emp.fechaIngreso || '',
      emp.fechaBaja || '',
      emp.departamento,
      emp.tipoSalario,
      String(emp.numeroEmpleado),
      emp.jornada || '58:00'
    ]];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    if (!res.ok) {
      console.error('[rhService] Error al escribir en Google Sheets:', await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('[rhService] Error guardando fila de empleado en Google Sheets:', err);
    return false;
  }
}
