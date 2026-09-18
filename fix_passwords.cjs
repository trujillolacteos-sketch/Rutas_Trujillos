const fs = require('fs');

// Fix in server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /state\.users = \[\s*\{ id: 1, username: 'Administrador', role: 'admin', password: '123' \},\s*\{ id: 2, username: 'Supervisor', role: 'supervisor', password: '123' \},\s*\{ id: 3, username: 'Ruta 1', role: 'operator', password: '1' \},\s*\{ id: 4, username: 'Ruta 2', role: 'operator', password: '2' \},\s*\{ id: 5, username: 'Ruta 3', role: 'operator', password: '3' \},\s*\{ id: 6, username: 'Ruta 4', role: 'operator', password: '4' \},\s*\{ id: 7, username: 'Ruta 5', role: 'operator', password: '5' \}\s*\];/,
  `state.users = [
      { id: 1, username: 'Administrador', role: 'admin', password: 'Admin.1234' },
      { id: 2, username: 'Supervisor', role: 'supervisor', password: 'Super.1234' },
      { id: 3, username: 'Ruta 1', role: 'operator', password: 'Ruta1.1234' },
      { id: 4, username: 'Ruta 2', role: 'operator', password: 'Ruta2.1234' },
      { id: 5, username: 'Ruta 3', role: 'operator', password: 'Ruta3.1234' },
      { id: 6, username: 'Ruta 4', role: 'operator', password: 'Ruta4.1234' },
      { id: 7, username: 'Ruta 5', role: 'operator', password: 'Ruta5.1234' }
    ];`
);
fs.writeFileSync('server.ts', serverCode);

// Fix in data_store.json
if (fs.existsSync('data_store.json')) {
  let state = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
  if (state.users) {
    const defaultPasswords = {
      'Administrador': 'Admin.1234',
      'Supervisor': 'Super.1234',
      'Ruta 1': 'Ruta1.1234',
      'Ruta 2': 'Ruta2.1234',
      'Ruta 3': 'Ruta3.1234',
      'Ruta 4': 'Ruta4.1234',
      'Ruta 5': 'Ruta5.1234'
    };
    state.users = state.users.map(u => {
      if (defaultPasswords[u.username]) {
        return { ...u, password: defaultPasswords[u.username] };
      }
      return u;
    });
    fs.writeFileSync('data_store.json', JSON.stringify(state, null, 2));
  }
}
