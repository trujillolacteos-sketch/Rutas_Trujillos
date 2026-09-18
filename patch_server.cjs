const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

const liquidateEndpoint = `  app.post('/api/commissions/:id/liquidate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });
      
      const { id } = req.params;
      
      // We set isLiquidated = true and also bring the dateOrder to NOW so it counts for the current week's commissions!
      await db.update(commissions).set({ isLiquidated: true, dateOrder: new Date() }).where(eq(commissions.id, parseInt(id)));
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: "Failed" });
    }
  });`;

server = server.replace(
  /app\.post\('\/api\/commissions\/:id\/pay'[\s\S]*?\}\);/,
  `$&
  
${liquidateEndpoint}`
);

fs.writeFileSync('server.ts', server);
console.log('Patched server.ts with liquidate endpoint');
