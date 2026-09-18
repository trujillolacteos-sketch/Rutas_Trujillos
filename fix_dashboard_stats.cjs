const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regex = /const routeStats = routes\.map\(route => \{[\s\S]*?\}\);/;

const replacement = `const routeStats = routes.map(route => {
    const routeVisits = state.visits.filter(v => v.ruta === route);
    const uniqueClientIds = new Set(routeVisits.map(v => v.clienteId));
    const routeClients = state.clients.filter(c => uniqueClientIds.has(c.id));
    const totalVenta = routeClients.reduce((acc, c) => acc + c.ventaPromedio, 0);
    const avgIov = routeClients.length > 0 
      ? Math.round(routeClients.reduce((acc, c) => acc + c.iov, 0) / routeClients.length)
      : 0;
    return {
      name: route,
      clientsCount: routeVisits.length, // Count visits as workload instead of unique clients
      uniqueClients: routeClients.length,
      totalVenta,
      avgIov
    };
  });`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/DashboardView.tsx', code, 'utf8');
  console.log("Successfully fixed dashboard stats.");
} else {
  console.log("Regex not found!");
}
