const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'let state = { clients: [], visits: [], routes: [], users: [], trackingLogs: [], disabledZones: [], clientOverrides: {}, lastSync: null, lastWeekReset: null };',
  'let state = { clients: [], visits: [], routes: [], users: [], trackingLogs: [], disabledZones: [], clientOverrides: {}, settings: { closeTime: "18:00" }, lastSync: null, lastWeekReset: null };'
);

fs.writeFileSync('server.ts', code);
