const fs = require('fs');
let code = fs.readFileSync('src/components/RouteAnalytics.tsx', 'utf8');
code = code.replace(/c\.freq/g, 'c.visitFrequency');
fs.writeFileSync('src/components/RouteAnalytics.tsx', code);
