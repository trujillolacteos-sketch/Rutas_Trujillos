const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetFunction = `function planificarSemanaAlgoritmo(clients: Client[], config: SystemConfig, existingVisits?: Visit[]): Visit[] {`;
if (!code.includes('function getVisitDays')) {
  const getVisitDaysFn = `
function getVisitDays(primaryDay: string, count: number): string[] {
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  if (count <= 1) return [primaryDay];
  const idx = dias.indexOf(primaryDay);
  if (count === 2) {
    return [primaryDay, dias[(idx + 3) % 6]];
  }
  if (count >= 3) {
    return [primaryDay, dias[(idx + 2) % 6], dias[(idx + 4) % 6]];
  }
  return [primaryDay];
}

function planificarSemanaAlgoritmo(clients: Client[], config: SystemConfig, existingVisits?: Visit[]): Visit[] {`;
  code = code.replace(targetFunction, getVisitDaysFn);
}

const targetMissing = `        maxId++;
        visits.push({
          id: \`VST-\${maxId}\`,
          clienteId: client.id,
          nombreCliente: client.nombre,
          ruta: client.rutaActual,
          diaSemana: assignedDay,
          estado: "PENDIENTE",
          fechaEjecucion: ""
        });`;
        
const replaceMissing = `        const targetVisits = Math.max(1, Math.min(3, Math.round(client.promedioDiasCompra || 1)));
        const days = getVisitDays(assignedDay, targetVisits);
        days.forEach(d => {
          maxId++;
          visits.push({
            id: \`VST-\${maxId}\`,
            clienteId: client.id,
            nombreCliente: client.nombre,
            ruta: client.rutaActual,
            diaSemana: d,
            estado: "PENDIENTE",
            fechaEjecucion: ""
          });
        });`;

code = code.replace(targetMissing, replaceMissing);


const targetMetro = `        orderedClients.forEach(c => {
          visits.push({
            id: \`VST-\${1000 + visitCounter++}\`,
            clienteId: c.id,
            nombreCliente: c.nombre,
            ruta: c.rutaActual,
            diaSemana: day,
            estado: "PENDIENTE",
            fechaEjecucion: ""
          });
        });`;
        
const replaceMetro = `        orderedClients.forEach(c => {
          const targetVisits = Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));
          const days = getVisitDays(day, targetVisits);
          days.forEach(d => {
            visits.push({
              id: \`VST-\${1000 + visitCounter++}\`,
              clienteId: c.id,
              nombreCliente: c.nombre,
              ruta: c.rutaActual,
              diaSemana: d,
              estado: "PENDIENTE",
              fechaEjecucion: ""
            });
          });
        });`;
        
code = code.replace(targetMetro, replaceMetro);

const targetNonMetro = `        orderedChunk.forEach(c => {
          visits.push({
            id: \`VST-\${1000 + visitCounter++}\`,
            clienteId: c.id,
            nombreCliente: c.nombre,
            ruta: c.rutaActual,
            diaSemana: assignedDay,
            estado: "PENDIENTE",
            fechaEjecucion: ""
          });
        });`;
        
const replaceNonMetro = `        orderedChunk.forEach(c => {
          const targetVisits = Math.max(1, Math.min(3, Math.round(c.promedioDiasCompra || 1)));
          const days = getVisitDays(assignedDay, targetVisits);
          days.forEach(d => {
            visits.push({
              id: \`VST-\${1000 + visitCounter++}\`,
              clienteId: c.id,
              nombreCliente: c.nombre,
              ruta: c.rutaActual,
              diaSemana: d,
              estado: "PENDIENTE",
              fechaEjecucion: ""
            });
          });
        });`;

code = code.replace(targetNonMetro, replaceNonMetro);

fs.writeFileSync('server.ts', code, 'utf8');
console.log("Replaced planner successfully.");
