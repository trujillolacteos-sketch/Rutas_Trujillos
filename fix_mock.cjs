const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const isActivo = i <= 432;/;

const replacement = `const isActivo = i % 7 !== 0; // Make ~85% of them active across all regions`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed mock data active distribution.");
} else {
  console.log("Regex not found!");
}
