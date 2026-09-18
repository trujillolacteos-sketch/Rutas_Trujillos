const fs = require('fs');
let code = fs.readFileSync('src/components/ZonesView.tsx', 'utf8');

code = code.replace(/<>\s*<EyeOff className="w-3 h-3" \/> Inactiva\s*<\/>/g, '<span className="flex items-center gap-2"><EyeOff className="w-3 h-3" /> Inactiva</span>');
code = code.replace(/<>\s*<Eye className="w-3 h-3" \/> Activa\s*<\/>/g, '<span className="flex items-center gap-2"><Eye className="w-3 h-3" /> Activa</span>');

fs.writeFileSync('src/components/ZonesView.tsx', code);
