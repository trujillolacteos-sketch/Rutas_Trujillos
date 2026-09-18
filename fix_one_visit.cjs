const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /let targetVisits = 1;\s*if \(isMetro\) {\s*targetVisits = c.iov > 70 \? 3 : c.iov > 40 \? 2 : 1;\s*}/g;
const replacement = `let targetVisits = 1;`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log("Updated to 1 visit per week");
} else {
  console.log("Regex not found!");
}
