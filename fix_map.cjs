const fs = require('fs');
let code = fs.readFileSync('src/components/ClientsView.tsx', 'utf8');

code = code.replace("Save, Download, Map } from 'lucide-react';", "Save, Download, Map as MapIcon } from 'lucide-react';");
code = code.replace("<Map className=\"w-3 h-3\"", "<MapIcon className=\"w-3 h-3\"");

fs.writeFileSync('src/components/ClientsView.tsx', code);
