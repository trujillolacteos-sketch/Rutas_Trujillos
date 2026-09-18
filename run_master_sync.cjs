import('./server/algorithm.ts').then(async (algo) => {
  const fs = require('fs');
  const state = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
  const plan = await algo.generateMasterPlan(state.routes, state.clientOverrides, state.disabledZones, state.visits, state.zoneOverrides);
  state.clients = plan.clients;
  fs.writeFileSync('data_store.json', JSON.stringify(state));
  console.log("Master sync done.");
  process.exit(0);
});
