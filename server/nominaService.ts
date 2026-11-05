import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';
import { loadLocalRH, getEmpleadosActivosRH, normalizeEmployeeName, EmpleadoRH } from './rhService.ts';
import { loadStore as loadChecadasStore, SemanaChecadas, EmpleadoChecada, getWeekDetails } from './checadasService.ts';

const NEW_SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const NOMINA_STORE_FILE = 'nomina_store.json';
const GOOGLE_DRIVE_NOMINA_FOLDER_ID = '1-hohnHSwZQ2g1QpxCAITvophsz0PEW8i';

export interface VentaDiaRuta {
  efectivo: number;
  transferencias: number;
}

export interface NominaEmpleado {
  rowNumber: number;
  id?: string;
  numeroEmpleado?: number;
  nombreCompleto: string;
  primerApellido?: string;
  segundoApellido?: string;
  nombres?: string;
  puesto: string;
  departamento: string;
  curp: string;
  fechaIngreso: string;
  antiguedad: string;
  telefonoWhatsapp: string;
  tipoJornada: string; // 'jornada' | 'fijo' | 'hora' | 'Gerencia'
  
  // Asistencia y Horas (provenientes de Checadas)
  salarioBase: number;
  horasTrabajadas: string; // e.g. "54:00"
  montoPorHoras: number;
  faltas: number;
  faltasMonto: number;
  horasJornadaIncompleta: string; // e.g. "01:29"
  montoJornadaIncompleta: number;
  extras: string; // e.g. "01:45"
  extrasMonto: number;
  incapacidades: number;
  vacacionesUtilizadas: number;

  // Percepciones adicionales
  pagosPendientes: number;
  bonosExtras: number;

  // Deducciones adicionales
  prestamos: number;
  abonos: number;
  saldoPrestamoAnterior?: number; // Saldo que debía antes de la semana
  saldoPrestamoActual?: number;   // Saldo resultante = Math.max(0, saldoPrestamoAnterior + prestamos - abonos)
  gasolina: number;
  notasQueseria: number;
  tienda: number;
  cobrosPendientes: number;

  // Totales calculados
  percepciones: number;
  descuentos: number;
  pagoFinal: number;

  // Metadatos
  fechaDePago: string; // e.g. "07/11/2026"
  periodoDePago: string; // e.g. "01/11/2026 al 07/11/2026"
  semana: string; // e.g. "Semana 45"
  linkWhatsApp?: string;
  whatsappEnviado?: boolean;

  // Datos específicos para Choferes / Rutas (reciboruta)
  ventasPorDia?: {
    lunes: VentaDiaRuta;
    martes: VentaDiaRuta;
    miercoles: VentaDiaRuta;
    jueves: VentaDiaRuta;
    viernes: VentaDiaRuta;
    sabado: VentaDiaRuta;
  };
  totalVentaSemanalEfectivo?: number;
  totalVentaSemanalBancos?: number;
  totalVentaSemanal?: number;
  comisionRuta?: number; // 2.5%
}

export interface SemanaNomina {
  id: string; // e.g. "2026-W45"
  semanaNum: number;
  anio: number;
  periodo: string;
  fechaPago: string;
  fechaCierre?: string;
  cerrada: boolean;
  empleados: NominaEmpleado[];
  totales: {
    totalPercepciones: number;
    totalDescuentos: number;
    totalPagoNeto: number;
    totalEmpleados: number;
    totalFaltas: number;
    totalHorasExtrasMonto: number;
  };
}

export interface NominaStore {
  semanaActiva: SemanaNomina;
  historico: SemanaNomina[];
  saldosPrestamos?: Record<string, number>; // Mapa maestro de saldos pendientes de préstamo por colaborador
}

function getStorePath(): string {
  return path.resolve(process.cwd(), NOMINA_STORE_FILE);
}

// Convert string "HH:MM" to decimal hours
export function parseHoursToDecimal(hhmm?: string): number {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const parts = hhmm.trim().split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h + (m / 60);
}

// Convert decimal hours to "HH:MM"
export function formatDecimalToHHMM(dec: number): string {
  if (isNaN(dec) || dec <= 0) return '0:00';
  const totalMin = Math.round(dec * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Format currency
export function formatMoney(val: number): string {
  if (isNaN(val) || val == null) return '$0.00';
  return '$' + Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Friendly date: "07 de noviembre de 2026"
export function formatFechaBonita(dateStr?: string): string {
  if (!dateStr) return '';
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Recalcula toda la nómina de un empleado aplicando exactamente las reglas oficiales
 */
export function calcularEmpleadoNomina(emp: Partial<NominaEmpleado>, baseSueldo?: number): NominaEmpleado {
  const salarioBase = baseSueldo !== undefined ? baseSueldo : (emp.salarioBase || 0);
  const tipoJornada = (emp.tipoJornada || 'jornada').trim().toLowerCase();
  
  // 1. Faltas y Faltas Monto: = (SalarioBase / 7) * Faltas
  const faltas = Number(emp.faltas) || 0;
  const faltasMonto = faltas > 0 ? Math.round((salarioBase / 7) * faltas) : 0;

  // 2. Horas Trabajadas y Monto por Horas
  const horasTrabajadas = emp.horasTrabajadas || '0:00';
  const horasTrabajadasDec = parseHoursToDecimal(horasTrabajadas);
  const montoPorHoras = tipoJornada === 'hora' ? Number((horasTrabajadasDec * salarioBase).toFixed(2)) : 0;

  // 3. Horas Jornada Incompleta Monto: = Horas * (SalarioBase / 7 / 8)
  const horasJornadaIncompleta = emp.horasJornadaIncompleta || '0:00';
  const horasIncompletasDec = parseHoursToDecimal(horasJornadaIncompleta);
  const montoJornadaIncompleta = horasIncompletasDec > 0 
    ? Math.round(horasIncompletasDec * (salarioBase / 7 / 8))
    : 0;

  // 4. Horas Extras Monto: (SalarioBase / 7 / 8) * 1.2 * Extras
  const extras = emp.extras || '0:00';
  const extrasDec = parseHoursToDecimal(extras);
  const horaNormal = (salarioBase / 7) / 8;
  const extrasMonto = extrasDec > 0 
    ? Math.round(extrasDec * horaNormal * 1.2)
    : 0;

  // 5. Percepciones adicionales y Control de Saldos de Préstamos
  const bonosExtras = Number(emp.bonosExtras) || 0;
  const pagosPendientes = Number(emp.pagosPendientes) || 0;
  const prestamos = Number(emp.prestamos) || 0;
  const abonos = Number(emp.abonos) || 0;

  // Control de Saldos de Préstamos:
  // Saldo Anterior + Nuevo Préstamo Otorgado - Abono Descontado
  const saldoPrestamoAnterior = Number(emp.saldoPrestamoAnterior) || 0;
  const saldoPrestamoActual = Math.max(0, Number((saldoPrestamoAnterior + prestamos - abonos).toFixed(2)));

  // Si es chofer de ruta, calcular comisión de ruta 2.5%
  let comisionRuta = Number(emp.comisionRuta) || 0;
  if (emp.ventasPorDia) {
    const vd = emp.ventasPorDia;
    const dias = [vd.lunes, vd.martes, vd.miercoles, vd.jueves, vd.viernes, vd.sabado];
    let sumEf = 0;
    let sumTrans = 0;
    dias.forEach(d => {
      if (d) {
        sumEf += Number(d.efectivo) || 0;
        sumTrans += Number(d.transferencias) || 0;
      }
    });
    emp.totalVentaSemanalEfectivo = sumEf;
    emp.totalVentaSemanalBancos = sumTrans;
    emp.totalVentaSemanal = sumEf + sumTrans;
    comisionRuta = Number(((sumEf + sumTrans) * 0.025).toFixed(2));
    emp.comisionRuta = comisionRuta;
  }

  // 6. TOTAL PERCEPCIONES (SalarioBase/Horas + Extras + Bonos + PagosPendientes + Prestamos + ComisionRuta)
  let percepciones = 0;
  if (tipoJornada === 'hora') {
    percepciones = montoPorHoras + extrasMonto + bonosExtras + pagosPendientes + prestamos + comisionRuta;
  } else {
    percepciones = salarioBase + extrasMonto + bonosExtras + pagosPendientes + prestamos + comisionRuta;
  }
  percepciones = Number(percepciones.toFixed(2));

  // 7. TOTAL DEDUCCIONES (Faltas + Incompleta + Gasolina + Notas + Tienda + CobrosPendientes + Abonos)
  const gasolina = Number(emp.gasolina) || 0;
  const notasQueseria = Number(emp.notasQueseria) || 0;
  const tienda = Number(emp.tienda) || 0;
  const cobrosPendientes = Number(emp.cobrosPendientes) || 0;

  const descuentos = Number((
    faltasMonto +
    montoJornadaIncompleta +
    gasolina +
    notasQueseria +
    tienda +
    cobrosPendientes +
    abonos
  ).toFixed(2));

  // 8. PAGO FINAL
  const pagoFinal = Math.max(0, Math.round(percepciones - descuentos));

  // WhatsApp Link
  let tel = (emp.telefonoWhatsapp || '').replace(/\D/g, '');
  if (tel.length === 12 && tel.startsWith('52')) {
    tel = tel.slice(2);
  }
  let linkWhatsApp = '';
  if (tel.length === 10) {
    const nombre = emp.nombreCompleto || 'Colaborador';
    const msg = `🧀 *LÁCTEOS TRUJILLOS* 🧀\n📄 *RECIBO DE NÓMINA - ${emp.semana || 'Semana Actual'}*\n\n` +
      `👤 *Colaborador:* ${nombre}\n` +
      `🏢 *Puesto:* ${emp.puesto || 'General'}\n` +
      `📅 *Periodo:* ${emp.periodoDePago || ''}\n` +
      `--------------------------------\n` +
      `💵 *Percepciones:* ${formatMoney(percepciones)}\n` +
      `  • Sueldo Base: ${formatMoney(salarioBase)}\n` +
      (extrasMonto > 0 ? `  • Horas Extras (${extras}): ${formatMoney(extrasMonto)}\n` : '') +
      (bonosExtras > 0 ? `  • Bonos Extras: ${formatMoney(bonosExtras)}\n` : '') +
      (pagosPendientes > 0 ? `  • Pagos Pendientes: ${formatMoney(pagosPendientes)}\n` : '') +
      (prestamos > 0 ? `  • Préstamo Otorgado: ${formatMoney(prestamos)}\n` : '') +
      (comisionRuta > 0 ? `  • Comisión Rutas (2.5%): ${formatMoney(comisionRuta)}\n` : '') +
      `🔻 *Descuentos:* ${formatMoney(descuentos)}\n` +
      (faltasMonto > 0 ? `  • Faltas (${faltas} días): ${formatMoney(faltasMonto)}\n` : '') +
      (montoJornadaIncompleta > 0 ? `  • Retardos / J. Incompleta (${horasJornadaIncompleta}): ${formatMoney(montoJornadaIncompleta)}\n` : '') +
      (abonos > 0 ? `  • Abono a Préstamo: ${formatMoney(abonos)}\n` : '') +
      (saldoPrestamoActual > 0 ? `  💳 Saldo Pendiente Préstamo: ${formatMoney(saldoPrestamoActual)}\n` : (abonos > 0 ? `  💳 Préstamo Liquidado.\n` : '')) +
      (gasolina > 0 ? `  • Movilidad / Gasolina: ${formatMoney(gasolina)}\n` : '') +
      (tienda > 0 ? `  • Crédito Tienda: ${formatMoney(tienda)}\n` : '') +
      (notasQueseria > 0 ? `  • Notas Quesería: ${formatMoney(notasQueseria)}\n` : '') +
      (cobrosPendientes > 0 ? `  • Cobros Pendientes: ${formatMoney(cobrosPendientes)}\n` : '') +
      `--------------------------------\n` +
      `💰 *TOTAL A PAGAR: ${formatMoney(pagoFinal)} MXN*\n` +
      `--------------------------------\n` +
      `_Comprobante de dispersión semanal generado por Sistema Rutas Trujillos._`;
    linkWhatsApp = `https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`;
  }

  return {
    rowNumber: emp.rowNumber || 2,
    id: emp.id || String(emp.rowNumber || 2),
    numeroEmpleado: emp.numeroEmpleado,
    nombreCompleto: emp.nombreCompleto || '',
    primerApellido: emp.primerApellido || '',
    segundoApellido: emp.segundoApellido || '',
    nombres: emp.nombres || '',
    puesto: emp.puesto || '',
    departamento: emp.departamento || '',
    curp: emp.curp || '',
    fechaIngreso: emp.fechaIngreso || '',
    antiguedad: emp.antiguedad || '',
    telefonoWhatsapp: emp.telefonoWhatsapp || '',
    tipoJornada: emp.tipoJornada || 'jornada',
    salarioBase,
    horasTrabajadas,
    montoPorHoras,
    faltas,
    faltasMonto,
    horasJornadaIncompleta,
    montoJornadaIncompleta,
    extras,
    extrasMonto,
    incapacidades: Number(emp.incapacidades) || 0,
    vacacionesUtilizadas: Number(emp.vacacionesUtilizadas) || 0,
    pagosPendientes,
    bonosExtras,
    saldoPrestamoAnterior,
    prestamos,
    abonos,
    saldoPrestamoActual,
    gasolina,
    notasQueseria,
    tienda,
    cobrosPendientes,
    percepciones,
    descuentos,
    pagoFinal,
    fechaDePago: emp.fechaDePago || '',
    periodoDePago: emp.periodoDePago || '',
    semana: emp.semana || '',
    linkWhatsApp,
    whatsappEnviado: emp.whatsappEnviado || false,
    ventasPorDia: emp.ventasPorDia,
    totalVentaSemanalEfectivo: emp.totalVentaSemanalEfectivo,
    totalVentaSemanalBancos: emp.totalVentaSemanalBancos,
    totalVentaSemanal: emp.totalVentaSemanal,
    comisionRuta
  };
}

/**
 * Calcula los totales globales de la semana
 */
export function calcularTotalesSemana(empleados: NominaEmpleado[]) {
  let totalPercepciones = 0;
  let totalDescuentos = 0;
  let totalPagoNeto = 0;
  let totalFaltas = 0;
  let totalHorasExtrasMonto = 0;

  empleados.forEach(e => {
    totalPercepciones += e.percepciones;
    totalDescuentos += e.descuentos;
    totalPagoNeto += e.pagoFinal;
    totalFaltas += e.faltas;
    totalHorasExtrasMonto += e.extrasMonto;
  });

  return {
    totalPercepciones: Number(totalPercepciones.toFixed(2)),
    totalDescuentos: Number(totalDescuentos.toFixed(2)),
    totalPagoNeto: Number(totalPagoNeto.toFixed(2)),
    totalEmpleados: empleados.length,
    totalFaltas,
    totalHorasExtrasMonto: Number(totalHorasExtrasMonto.toFixed(2))
  };
}

/**
 * Carga el store local de Nómina
 */
export function loadNominaStore(): NominaStore {
  try {
    const p = getStorePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.semanaActiva) {
        if (!parsed.saldosPrestamos) parsed.saldosPrestamos = {};
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[nominaService] Error cargando nomina_store.json, regenerando...', err);
  }

  // Inicialización por defecto usando la semana actual
  const details = getWeekDetails();
  const fechaPago = details.fechaFin; // Sábado como fecha de pago habitual

  const store: NominaStore = {
    semanaActiva: {
      id: details.id,
      semanaNum: details.semana,
      anio: details.anio,
      periodo: details.periodo,
      fechaPago,
      cerrada: false,
      empleados: [],
      totales: {
        totalPercepciones: 0,
        totalDescuentos: 0,
        totalPagoNeto: 0,
        totalEmpleados: 0,
        totalFaltas: 0,
        totalHorasExtrasMonto: 0
      }
    },
    historico: [],
    saldosPrestamos: {}
  };

  saveNominaStore(store);
  return store;
}

export function saveNominaStore(store: NominaStore): void {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[nominaService] Error guardando nomina_store.json:', err);
  }
}

/**
 * Genera o sincroniza la nómina de la semana activa conectando Checadas y RH
 */
/**
 * Genera o sincroniza la nómina de la semana activa conectando Checadas y RH.
 * Padrón RH es la fuente maestra única de colaboradores ACTIVOS, salarios base y tipos de jornada.
 */
export async function sincronizarNominaSemanal(forzarRecalculo = false): Promise<SemanaNomina> {
  const store = loadNominaStore();
  const checadasStore = loadChecadasStore();
  const activosRH = await getEmpleadosActivosRH(true); // Siempre obtiene los colaboradores activos frescos de RH

  const semanaChecadas = checadasStore.semanaActiva;
  const semanaId = semanaChecadas.id || store.semanaActiva.id;

  // Mapa de ajustes manuales previos para conservarlos al 100%:
  // (PAGOSPENDIENTES, BONOSEXTRAS, Prestamos, Abonos, GASOLINA, NOTASQUESERIA, TIENDA, COBROSPENDIENTES)
  const manualAdjustmentsMap = new Map<string, Partial<NominaEmpleado>>();
  store.semanaActiva.empleados.forEach(e => {
    const adj: Partial<NominaEmpleado> = {
      pagosPendientes: Number(e.pagosPendientes) || 0,
      bonosExtras: Number(e.bonosExtras) || 0,
      prestamos: Number(e.prestamos) || 0,
      abonos: Number(e.abonos) || 0,
      saldoPrestamoAnterior: Number(e.saldoPrestamoAnterior) || 0,
      gasolina: Number(e.gasolina) || 0,
      notasQueseria: Number(e.notasQueseria) || 0,
      tienda: Number(e.tienda) || 0,
      cobrosPendientes: Number(e.cobrosPendientes) || 0,
      whatsappEnviado: e.whatsappEnviado || false,
      ventasPorDia: e.ventasPorDia
    };
    manualAdjustmentsMap.set(normalizeEmployeeName(e.nombreCompleto), adj);
    if (e.numeroEmpleado) {
      manualAdjustmentsMap.set(`NUM_${e.numeroEmpleado}`, adj);
    }
  });

  const semanaTexto = `Semana ${semanaChecadas.semana || store.semanaActiva.semanaNum}`;
  const periodoTexto = `Del ${semanaChecadas.fechaInicio || ''} al ${semanaChecadas.fechaFin || ''}`;
  const fechaPago = semanaChecadas.fechaFin || store.semanaActiva.fechaPago;

  // Mapa de asistencia de Checadas indexado por nombre normalizado
  const checadasMap = new Map<string, EmpleadoChecada>();
  semanaChecadas.empleados.forEach(c => {
    checadasMap.set(normalizeEmployeeName(c.nombre), c);
  });

  // Nómina es alimentada EXCLUSIVAMENTE por los colaboradores con estatus ACTIVO en Padrón RH
  const empleadosNomina: NominaEmpleado[] = activosRH.map((rhEmp, index) => {
    const normKey = normalizeEmployeeName(rhEmp.nombreCompleto);
    const checada = checadasMap.get(normKey);
    const manual = (rhEmp.numeroEmpleado ? manualAdjustmentsMap.get(`NUM_${rhEmp.numeroEmpleado}`) : null) || manualAdjustmentsMap.get(normKey);

    // Salario base tomado directamente de RH (inmune a fallos)
    const salarioBase = Number(rhEmp.sueldoBase) || 0;
    const tipoJornada = (rhEmp.tipoSalario || 'jornada').trim().toLowerCase();
    const esGerencia = tipoJornada === 'gerencia';

    // Asistencia desde Checadas
    const faltas = esGerencia ? 0 : (checada ? checada.faltas : 0);
    const horasTrabajadas = checada?.totalHorasSemana || (esGerencia ? '00:00' : '54:00');
    const horasJornadaIncompleta = checada?.jornadaIncompleta || '0:00';
    const extras = esGerencia ? '0:00' : (checada?.extrasSemana || '0:00');
    const incapacidades = checada?.incapacidades || 0;
    const vacacionesUtilizadas = checada?.vacaciones || 0;

    // Los 8 campos de llenado manual y Control de Préstamos
    const pagosPendientes = manual?.pagosPendientes !== undefined 
      ? manual.pagosPendientes 
      : (esGerencia ? 5000 : 0);
    const bonosExtras = manual?.bonosExtras || 0;
    const prestamos = manual?.prestamos || 0;
    const abonos = manual?.abonos || 0;

    // Saldo deudor anterior: del ajuste previo o del mapa maestro persistente
    const empKey = rhEmp.numeroEmpleado ? String(rhEmp.numeroEmpleado) : normKey;
    const saldoMaestro = store.saldosPrestamos?.[empKey] ?? store.saldosPrestamos?.[normKey] ?? 0;
    const saldoPrestamoAnterior = manual?.saldoPrestamoAnterior !== undefined 
      ? Number(manual.saldoPrestamoAnterior) 
      : Number(saldoMaestro);

    const gasolina = manual?.gasolina || 0;
    const notasQueseria = manual?.notasQueseria || 0;
    const tienda = manual?.tienda || 0;
    const cobrosPendientes = manual?.cobrosPendientes || 0;

    const baseData: Partial<NominaEmpleado> = {
      rowNumber: index + 2,
      id: String(rhEmp.numeroEmpleado || rhEmp.id || (index + 2)),
      numeroEmpleado: rhEmp.numeroEmpleado,
      nombreCompleto: rhEmp.nombreCompleto,
      primerApellido: rhEmp.primerApellido,
      segundoApellido: rhEmp.segundoApellido,
      nombres: rhEmp.nombre,
      puesto: rhEmp.puesto || (esGerencia ? 'GERENCIA' : 'PRODUCCIÓN'),
      departamento: rhEmp.departamento || (esGerencia ? 'GERENCIA' : 'PLANTA'),
      curp: rhEmp.curp || '',
      fechaIngreso: rhEmp.fechaIngreso || '',
      antiguedad: rhEmp.antiguedad || '',
      telefonoWhatsapp: rhEmp.telefonoWhatsapp || '',
      tipoJornada,
      salarioBase,
      horasTrabajadas,
      faltas,
      horasJornadaIncompleta,
      extras,
      incapacidades,
      vacacionesUtilizadas,
      pagosPendientes,
      bonosExtras,
      saldoPrestamoAnterior,
      prestamos,
      abonos,
      gasolina,
      notasQueseria,
      tienda,
      cobrosPendientes,
      fechaDePago: fechaPago,
      periodoDePago: periodoTexto,
      semana: semanaTexto,
      whatsappEnviado: manual?.whatsappEnviado || false,
      ventasPorDia: manual?.ventasPorDia
    };

    return calcularEmpleadoNomina(baseData, salarioBase);
  });

  const totales = calcularTotalesSemana(empleadosNomina);

  const semanaActiva: SemanaNomina = {
    id: semanaId,
    semanaNum: semanaChecadas.semana || store.semanaActiva.semanaNum,
    anio: semanaChecadas.anio || store.semanaActiva.anio,
    periodo: semanaChecadas.periodo || store.semanaActiva.periodo,
    fechaPago,
    cerrada: false,
    empleados: empleadosNomina,
    totales
  };

  store.semanaActiva = semanaActiva;
  saveNominaStore(store);

  return semanaActiva;
}

/**
 * Actualiza los conceptos variables de un empleado en la nómina activa (los 8 campos manuales)
 */
export function updateEmpleadoAjustes(identifier: string | number, ajustes: Partial<NominaEmpleado>): NominaEmpleado {
  const store = loadNominaStore();

  // REGLA DE ORO: Si la semana está cerrada, NO se puede modificar desde la aplicación
  if (store.semanaActiva.cerrada) {
    throw new Error('La semana de nómina está CERRADA. Por seguridad, no se puede modificar desde la aplicación. Las modificaciones deben realizarse directamente en Google Sheets y sincronizarse.');
  }

  const idStr = String(identifier).trim();
  const numId = parseInt(idStr, 10);
  const empIndex = store.semanaActiva.empleados.findIndex(e =>
    e.rowNumber === numId ||
    e.id === idStr ||
    String(e.numeroEmpleado) === idStr ||
    normalizeEmployeeName(e.nombreCompleto) === normalizeEmployeeName(idStr)
  );
  if (empIndex === -1) {
    throw new Error(`Empleado con identificador ${identifier} no encontrado en la nómina activa.`);
  }

  const current = store.semanaActiva.empleados[empIndex];
  const merged: Partial<NominaEmpleado> = {
    ...current,
    ...ajustes
  };

  // Mantener salarioBase original de RH
  const sueldoBase = current.salarioBase;
  const recalculated = calcularEmpleadoNomina(merged, sueldoBase);
  store.semanaActiva.empleados[empIndex] = recalculated;
  store.semanaActiva.totales = calcularTotalesSemana(store.semanaActiva.empleados);

  // Actualizar el saldo de préstamo maestro persistente para este colaborador
  if (!store.saldosPrestamos) store.saldosPrestamos = {};
  const empKey = recalculated.numeroEmpleado ? String(recalculated.numeroEmpleado) : normalizeEmployeeName(recalculated.nombreCompleto);
  store.saldosPrestamos[empKey] = recalculated.saldoPrestamoActual || 0;

  saveNominaStore(store);
  return recalculated;
}

/**
 * Marca un recibo como enviado por WhatsApp
 */
export function markWhatsAppEnviado(identifier: string | number, enviado = true): NominaEmpleado {
  const store = loadNominaStore();
  const idStr = String(identifier).trim();
  const numId = parseInt(idStr, 10);
  const empIndex = store.semanaActiva.empleados.findIndex(e =>
    e.rowNumber === numId ||
    e.id === idStr ||
    String(e.numeroEmpleado) === idStr ||
    normalizeEmployeeName(e.nombreCompleto) === normalizeEmployeeName(idStr)
  );
  if (empIndex === -1) throw new Error('Empleado no encontrado');
  store.semanaActiva.empleados[empIndex].whatsappEnviado = enviado;
  saveNominaStore(store);
  return store.semanaActiva.empleados[empIndex];
}

/**
 * Archiva la semana de Nómina activa:
 * 1. Guarda la nómina en el histórico de nomina_store.json.
 * 2. Guarda las filas en Google Sheets ("nomina producción historico").
 * 3. Si es posible, guarda el respaldo en Google Drive folder 1-hohnHSwZQ2g1QpxCAITvophsz0PEW8i.
 */
export async function archivarSemanaNomina(): Promise<{ success: boolean; semanaArchivada: SemanaNomina; sheetsSynced: boolean; driveSynced: boolean; message: string }> {
  const store = loadNominaStore();
  const semanaActual = { ...store.semanaActiva };

  if (semanaActual.empleados.length === 0) {
    throw new Error('No hay empleados en la semana activa de nómina.');
  }

  const fechaCierre = new Date().toISOString();
  semanaActual.cerrada = true;
  semanaActual.fechaCierre = fechaCierre;

  // 1. Guardar en histórico local
  store.historico.unshift(semanaActual);

  // Actualizar mapa maestro de saldos de préstamos para arrastre a semanas futuras
  if (!store.saldosPrestamos) store.saldosPrestamos = {};
  semanaActual.empleados.forEach(emp => {
    const key = emp.numeroEmpleado ? String(emp.numeroEmpleado) : normalizeEmployeeName(emp.nombreCompleto);
    store.saldosPrestamos[key] = emp.saldoPrestamoActual || 0;
  });

  // 2. Intentar guardar en Google Sheets en "nomina producción historico"
  let sheetsSynced = false;
  try {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (token) {
      // Verificar si la hoja "nomina producción historico" existe
      const ssRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ssData = await ssRes.json();
      const sheetName = 'nomina producción historico';
      const sheetExists = ssData.sheets?.some((s: any) => s.properties.title === sheetName);

      if (!sheetExists) {
        // Crear la hoja con los encabezados
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName,
                  gridProperties: { rowCount: 1000, columnCount: 30 }
                }
              }
            }]
          })
        });

        // Escribir encabezados en fila 1
        const headers = [
          'SalarioBase', 'Nombrecompleto', 'Faltas', 'HorasTrabajadas', 'Horasjornadaincompleta',
          'Tipodejornada', 'Extras', 'Montoporhoras', 'Faltasmonto', 'Montojornadasincompletas',
          'Extrasmonto', 'Incapacidades', 'vacacionesutilizadas', 'PAGOSPENDIENTES', 'BONOSEXTRAS',
          'Prestamos', 'Abonos', 'SaldoPrestamoActual', 'GASOLINA', 'NOTASQUESERIA', 'TIENDA',
          'COBROSPENDIENTES', 'Percepciones', 'Descuentos', 'PAGOFINAL', 'FECHADEPAGO',
          'Periododepago', 'semana', 'LinkWhatsApp', 'FechaCierre'
        ];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/'${encodeURIComponent(sheetName)}'!A1:AD1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [headers] })
        });
      }

      // Preparar filas para insertar
      const rowsToInsert = semanaActual.empleados.map(e => [
        e.salarioBase,
        e.nombreCompleto,
        e.faltas,
        e.horasTrabajadas,
        e.horasJornadaIncompleta,
        e.tipoJornada,
        e.extras,
        e.montoPorHoras,
        e.faltasMonto,
        e.montoJornadaIncompleta,
        e.extrasMonto,
        e.incapacidades,
        e.vacacionesUtilizadas,
        e.pagosPendientes,
        e.bonosExtras,
        e.prestamos,
        e.abonos,
        e.saldoPrestamoActual || 0,
        e.gasolina,
        e.notasQueseria,
        e.tienda,
        e.cobrosPendientes,
        e.percepciones,
        e.descuentos,
        e.pagoFinal,
        e.fechaDePago,
        e.periodoDePago,
        e.semana,
        e.linkWhatsApp ? `=HYPERLINK("${e.linkWhatsApp}","📱 WhatsApp")` : 'Sin WhatsApp',
        fechaCierre
      ]);

      // Append filas a la hoja de histórico
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/'${encodeURIComponent(sheetName)}'!A2:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rowsToInsert })
      });

      sheetsSynced = true;
    }
  } catch (sheetErr: any) {
    console.error('[nominaService] Error guardando en Google Sheets:', sheetErr.message);
  }

  // 3. Intentar respaldo en Google Drive folder
  let driveSynced = false;
  try {
    const driveToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/drive']);
    if (driveToken) {
      const manifest = {
        semana: semanaActual.semanaNum,
        anio: semanaActual.anio,
        id: semanaActual.id,
        periodo: semanaActual.periodo,
        totales: semanaActual.totales,
        totalEmpleados: semanaActual.empleados.length,
        fechaCierre,
        empleados: semanaActual.empleados.map(e => ({
          nombre: e.nombreCompleto,
          puesto: e.puesto,
          salarioBase: e.salarioBase,
          percepciones: e.percepciones,
          descuentos: e.descuentos,
          pagoFinal: e.pagoFinal,
          whatsapp: e.telefonoWhatsapp
        }))
      };

      const fileName = `Nomina_${semanaActual.id}_Cierre_${fechaCierre.slice(0, 10)}.json`;
      const metadata = {
        name: fileName,
        parents: [GOOGLE_DRIVE_NOMINA_FOLDER_ID],
        mimeType: 'application/json'
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(manifest, null, 2) +
        closeDelimiter;

      const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (driveRes.ok) {
        driveSynced = true;
      }
    }
  } catch (driveErr: any) {
    console.warn('[nominaService] Google Drive backup opcional no completado:', driveErr.message);
  }

  saveNominaStore(store);

  return {
    success: true,
    semanaArchivada: semanaActual,
    sheetsSynced,
    driveSynced,
    message: `Semana ${semanaActual.semanaNum} archivada con éxito. ${sheetsSynced ? 'Sincronizado con Google Sheets.' : ''} ${driveSynced ? 'Copia respaldada en Google Drive.' : ''}`
  };
}
