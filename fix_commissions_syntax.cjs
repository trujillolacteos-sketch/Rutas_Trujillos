const fs = require('fs');
let code = fs.readFileSync('src/components/CommissionsView.tsx', 'utf8');

code = code.replace(
  "const rid = \\`Ruta \\${c.routeId || 'Sin Asignar'}\\`;",
  "const rid = `Ruta ${c.routeId || 'Sin Asignar'}`;"
);

code = code.replace(
  "<RefreshCw className={\\`w-4 h-4 \\${syncing ? 'animate-spin' : ''}\\`} />",
  "<RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />"
);

fs.writeFileSync('src/components/CommissionsView.tsx', code);
