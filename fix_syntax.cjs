const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /if \(rIdx === 1\) \{ \/\/ Route 2[\s\S]*?lastDays = bestPattern;/;

const newLogic = `if (rIdx === 1) { // Route 2
            // console.log(\`Assigned \${c.city} to \${bestPattern} bestScore=\${bestScore} dayLoads=\${dayLoads.join(',')}\`);
        }
        lastDays = bestPattern;`;

code = code.replace(regex, newLogic);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Done syntax fix');
