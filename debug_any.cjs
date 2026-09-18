const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /if \(c\.city\.includes\('San Juan'\) && rIdx === 1 && p\.length === 1 && c\.id === orderedClients\[orderedClients\.length-1\]\.id\) \{[\s\S]*?\}/;

const newLogic = `if (c.city.includes('San Juan') && rIdx === 1 && p.length === 1 && dayLoads[p[0]] > 30) {
                console.log(\`DebugSJ: day=\${p[0]} score=\${currentScore} overfill=\${overfill} bal=\${balanceScore} pen=\${continuityPenalty} load=\${dayLoads[p[0]]}\`);
            }`;

code = code.replace(regex, newLogic);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Done');
