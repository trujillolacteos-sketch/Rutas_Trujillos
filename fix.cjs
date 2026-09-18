const fs = require('fs');
let code = fs.readFileSync('src/components/RouteAnalytics.tsx', 'utf8');
code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/RouteAnalytics.tsx', code);
