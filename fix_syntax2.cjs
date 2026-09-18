const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /if \(c\.city\.includes\('San Juan'\) && rIdx === 1 && p\.length === 1 && dayLoads\[p\[0\]\] > 30\) \{[\s\S]*?\} score=\$\{currentScore\}.*?\}/;

const newLogic = ``;

code = code.replace(regex, newLogic);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Done');
