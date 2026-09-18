const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace('} catch (error: any) { {', '} catch (error: any) {');
fs.writeFileSync('server.ts', code);
