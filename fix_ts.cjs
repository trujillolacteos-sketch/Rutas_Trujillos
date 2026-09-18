const fs = require('fs');
let code = fs.readFileSync('src/components/ClientsView.tsx', 'utf8');

code = code.split("const duplicatedGroups = Array.from(locationMap.values()).filter(group => group.length > 1);").join("const duplicatedGroups = Array.from(locationMap.values()).filter((group: any) => group.length > 1);");

code = code.split("{group.map(c => (").join("{(group as any).map((c: any) => (");

fs.writeFileSync('src/components/ClientsView.tsx', code);
