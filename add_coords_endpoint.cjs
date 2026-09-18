const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "import { generateMasterPlan } from './server/algorithm';",
  "import { generateMasterPlan } from './server/algorithm';\nimport { executeKw } from './server/odoo';"
);

const newEndpoint = `  app.post('/api/clients/:id/coordinates', async (req, res) => {
    const { id } = req.params;
    const { lat, lng } = req.body;
    try {
      // Update in Odoo
      await executeKw('res.partner', 'write', [[parseInt(id)], { partner_latitude: lat, partner_longitude: lng }]);
      
      // Update locally
      const state = loadState();
      const client = state.clients.find(c => c.id === parseInt(id));
      if (client) {
        client.lat = lat;
        client.lng = lng;
        saveState(state);
      }
      res.json({ success: true, client });
    } catch (e) {
      console.error("Error updating coordinates in Odoo", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/users',`;

code = code.replace("  app.post('/api/users',", newEndpoint);

fs.writeFileSync('server.ts', code);
