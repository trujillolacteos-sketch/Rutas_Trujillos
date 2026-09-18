const fs = require('fs');
let code = fs.readFileSync('src/components/PlannerView.tsx', 'utf8');
code = code.replace(/lastLocationRef\.current = \{ lat, lng, time: now \};\n\s+\}\n\s+\}\n\s+\} else \{/, 
`lastLocationRef.current = { lat, lng, time: now };
      }
    } else {`);
fs.writeFileSync('src/components/PlannerView.tsx', code);
