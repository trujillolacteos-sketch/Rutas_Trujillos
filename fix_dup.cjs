const fs = require('fs');
const path = 'server/algorithm.ts';
let code = fs.readFileSync(path, 'utf8');

const lines = code.split('\n');
let newLines = [];
let skip = false;
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('freq = Math.max(1, freq);')) {
        newLines.push(lines[i]);
        // skip next 3 lines if they are the duplicate
        if (lines[i+1].includes('if (clientOverrides[c.id] && clientOverrides[c.id].visitFrequency !== undefined) {') && lines[i+5].includes('let isActive = true;')) {
            i += 3; // skip the duplicate if block
        }
    } else {
        newLines.push(lines[i]);
    }
}
fs.writeFileSync(path, newLines.join('\n'));
