const fs = require('fs');
const path = 'src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    "{activeTab === 'settings' && <SettingsView state={state} setState={setState} />}",
    "{activeTab === 'settings' && <SettingsView state={state} setState={setState} />}\n              {activeTab === 'zones' && <ZonesView state={state} setState={setState} />}"
);

// MapIcon is imported as `Map as MapIcon` in my previous patch, let's make sure it's there.
code = code.replace("import { LayoutDashboard, Map as MapIcon, Users", "import { LayoutDashboard, Users, Calendar, Settings as SettingsIcon, LogOut, Route, MapPin, Search, Plus, Map as MapIcon, Lock, UsersIcon, ShieldAlert }");

fs.writeFileSync(path, code);
