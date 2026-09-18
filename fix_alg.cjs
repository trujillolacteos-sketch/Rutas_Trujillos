const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

code = code.replace(/    \}\);\n  \}\);\n  \}\);\n\n  \/\/ Distribute invalid clients evenly/,
`    });
  });

  // Distribute invalid clients evenly`);

fs.writeFileSync('server/algorithm.ts', code);
