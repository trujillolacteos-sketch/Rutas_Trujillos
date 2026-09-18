const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('DollarSign')) {
  console.log("No DollarSign at all?");
} else if (!code.includes('import { DollarSign }')) {
  code = code.replace(
    "import { Route, LayoutDashboard, Map, Map as MapIcon, Bell, Settings as SettingsIcon, LogOut, CheckCircle2, Navigation, AlertTriangle, RefreshCw, Users, Clock } from 'lucide-react';",
    "import { Route, LayoutDashboard, Map, Map as MapIcon, Bell, Settings as SettingsIcon, LogOut, CheckCircle2, Navigation, AlertTriangle, RefreshCw, Users, Clock, DollarSign } from 'lucide-react';"
  );
  fs.writeFileSync('src/App.tsx', code);
}
