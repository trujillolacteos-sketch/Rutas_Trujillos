const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');
code = code.replace(/console\.log\('DEBUG:/g, '// console.log(\'DEBUG:');
fs.writeFileSync('server/algorithm.ts', code);
