import { loadNominaStore, saveNominaStore, calcularEmpleadoNomina } from '../server/nominaService.ts';

const store = loadNominaStore();

// Pre-fill attendance & manual adjustments from user screenshots
const semanaCaptura: Record<string, any> = {
  'JORGE ORTIZ PAREDES': { horasTrabajadas: '54:00', faltas: 0, extras: '00:00', gasolina: 250, tienda: 120 },
  'JOSE ANTONIO SANROMAN ZUNIGA': { horasTrabajadas: '54:00', faltas: 0, extras: '00:00', gasolina: 200 },
  'ANA ROCIO FLORES SANCHEZ': { horasTrabajadas: '-09:00', faltas: 5, extras: '00:00' },
  'ANA ELISELDA CUELLAR MONTOYA': { horasTrabajadas: '45:00', faltas: 1, extras: '00:00' },
  'LIDIA GONZALEZ MAGDALENO': { horasTrabajadas: '55:00', faltas: 0, extras: '00:00' },
  'JAIME ORTIZ PAREDES': { horasTrabajadas: '54:00', faltas: 0, extras: '00:00', gasolina: 250, tienda: 52 },
  'ESTELA CAMPOS': { horasTrabajadas: '00:00', faltas: 0, extras: '00:00', pagosPendientes: 5000 },
  'MARIA DE SAN JUAN GONZALEZ GUTIERRES': { horasTrabajadas: '68:35', faltas: 0, extras: '14:35', tienda: 25 },
  'Liliana del Carmen Espinoza Avalos': { horasTrabajadas: '55:45', faltas: 0, extras: '01:45' },
  'CLAUDIA BERENICE MONTES ZANDOVAL': { horasTrabajadas: '46:02', faltas: 1, extras: '01:02', notasQueseria: 139 },
  'ALMA AVALOS  ESPINOZA': { horasTrabajadas: '46:29', faltas: 1, extras: '01:29' },
  'MARIANA': { horasTrabajadas: '54:00', faltas: 0, extras: '00:00', notasQueseria: 251 },
  'LAURA ELIZABETH DE SANTOS  ROMO': { horasTrabajadas: '54:35', faltas: 0, extras: '00:35', tienda: 18 },
  'SARAHÍ HERNADEZ CUELLAR': { horasTrabajadas: '54:57', faltas: 0, extras: '00:57', tienda: 18 },
  'JAIME': { horasTrabajadas: '54:00', faltas: 0, extras: '00:00' }
};

store.semanaActiva.semanaNum = 45;
store.semanaActiva.id = '2026-W45';
store.semanaActiva.periodo = '01/11/2026 al 07/11/2026';
store.semanaActiva.fechaPago = '07/11/2026';

let totPercepciones = 0;
let totDescuentos = 0;
let totNeto = 0;
let totFaltas = 0;
let totExtrasMonto = 0;

store.semanaActiva.empleados = store.semanaActiva.empleados.map(emp => {
  const normName = emp.nombreCompleto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const foundKey = Object.keys(semanaCaptura).find(k => {
    const kNorm = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    return kNorm === normName;
  });

  const ajustes = foundKey ? semanaCaptura[foundKey] : {};
  const merged = { ...emp, ...ajustes, semana: 'Semana 45', periodoDePago: '01/11/2026 al 07/11/2026', fechaDePago: '07/11/2026' };
  const calc = calcularEmpleadoNomina(merged, emp.salarioBase);

  totPercepciones += calc.percepciones;
  totDescuentos += calc.descuentos;
  totNeto += calc.pagoFinal;
  totFaltas += calc.faltas;
  totExtrasMonto += calc.extrasMonto;

  return calc;
});

store.semanaActiva.totales = {
  totalPercepciones: Number(totPercepciones.toFixed(2)),
  totalDescuentos: Number(totDescuentos.toFixed(2)),
  totalPagoNeto: Number(totNeto.toFixed(2)),
  totalEmpleados: store.semanaActiva.empleados.length,
  totalFaltas: totFaltas,
  totalHorasExtrasMonto: Number(totExtrasMonto.toFixed(2))
};

saveNominaStore(store);
console.log('Semana 45 precargada con exito.');
store.semanaActiva.empleados.forEach(e => {
  console.log(`${e.nombreCompleto.padEnd(36)} Base: $${String(e.salarioBase).padEnd(6)} | Perc: $${String(e.percepciones).padEnd(8)} | Desc: -$${String(e.descuentos).padEnd(7)} | NETO: $${e.pagoFinal}`);
});
console.log('TOTALES:', store.semanaActiva.totales);
