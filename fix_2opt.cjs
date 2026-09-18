const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const maxIterations = 50;/g;

const replacement = `const maxIterations = 200;`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Fixed maxIterations!");
} else {
  console.log("Regex not found!");
}
