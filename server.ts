import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { generateMasterPlan } from './server/algorithm';
import { executeKw } from './server/odoo';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { startOdooSync, syncCommissions, loadLocalCommissions, saveLocalCommissions } from './server/odooSync.ts';
import { getSalesReport } from './server/reportsService';
import { db, pool } from './src/db/index.ts';
import { gpsLogs, commissions, payrolls } from './src/db/schema.ts';
import { getUserRole } from './src/db/users.ts';
import { eq, desc } from 'drizzle-orm';
import cron from 'node-cron';

const STORE_FILE = 'data_store.json';
let _cachedState: AppState | null = null;

import { AppState } from './src/types.ts';

async function initPersistentDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log("No DATABASE_URL configured. Running with local JSON persistence.");
    return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      const res = await client.query(`SELECT data FROM app_state WHERE key = 'master_state' LIMIT 1;`);
      if (res.rows && res.rows.length > 0 && res.rows[0].data) {
        try {
          const dbState = JSON.parse(res.rows[0].data);
          if (dbState && typeof dbState === 'object') {
            _cachedState = dbState;
            fs.writeFileSync(STORE_FILE, JSON.stringify(dbState, null, 2));
            console.log("Master state restored from PostgreSQL database.");
          }
        } catch (parseErr) {
          console.error("Error parsing master state from database:", parseErr);
        }
      } else {
        const currentState = loadState();
        await client.query(`
          INSERT INTO app_state (key, data, updated_at)
          VALUES ('master_state', $1, NOW())
          ON CONFLICT (key) DO UPDATE
          SET data = EXCLUDED.data, updated_at = NOW();
        `, [JSON.stringify(currentState)]);
        console.log("Master state initialized in PostgreSQL database.");
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("PostgreSQL notice (using local storage fallback):", err.message);
  }
}

export async function triggerWeeklyAutomatedSync() {
  try {
    const existingState = loadState();
    console.log("Iniciando cálculo automático semanal de rutas y sincronización con Odoo...");
    try {
      await syncCommissions();
    } catch (commErr) {
      console.warn("Non-fatal error in syncCommissions:", commErr);
    }
    const plan = await generateMasterPlan(
      existingState.routes || [],
      existingState.clientOverrides || {},
      existingState.disabledZones || [],
      existingState.visits || [],
      existingState.zoneOverrides || {}
    );
    const state = {
      clients: plan.clients,
      visits: plan.visits,
      routes: plan.routes,
      syncLogs: plan.logs,
      disabledZones: existingState.disabledZones || [],
      clientOverrides: existingState.clientOverrides || {},
      zoneOverrides: existingState.zoneOverrides || {},
      settings: existingState.settings || { closeTime: "18:00" },
      users: existingState.users || [],
      trackingLogs: existingState.trackingLogs || [],
      lastWeekReset: existingState.lastWeekReset,
      lastSync: new Date().toISOString(),
      stateVersion: Date.now()
    };
    saveState(state);
    console.log("Cálculo automático semanal completado con éxito.");
    return state;
  } catch (error: any) {
    console.error("Error en triggerWeeklyAutomatedSync:", error);
    throw error;
  }
}

function checkWeeklyReset(state: any) {
  const now = new Date();
  const day = now.getDay();
  // Monday as start of week:
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const currentWeekStart = new Date(now.getFullYear(), now.getMonth(), diff);
  currentWeekStart.setHours(0, 0, 0, 0);
  const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0];

  if (state.lastWeekReset !== currentWeekStartStr) {
    console.log(`[Reinicio Semanal] Semana anterior: ${state.lastWeekReset}, Nueva semana: ${currentWeekStartStr}. Reiniciando visitas a PENDIENTE.`);
    if (state.visits && state.visits.length > 0) {
      state.visits.forEach((v: any) => {
        v.status = 'PENDIENTE';
        v.updatedAt = Date.now();
      });
    }
    state.lastWeekReset = currentWeekStartStr;
    saveState(state);

    // Trigger automated route plan recalculation in background
    setTimeout(() => {
      triggerWeeklyAutomatedSync().catch(e => console.error("Error en sincronización automática de inicio de semana:", e));
    }, 2000);
  }
}

function loadState(): AppState {
  let state: any = _cachedState;
  if (!state) {
    state = { clients: [], visits: [], routes: [], users: [], trackingLogs: [], disabledZones: [], clientOverrides: {}, zoneOverrides: {}, settings: { closeTime: "18:00" }, lastSync: null, lastWeekReset: null };
    if (fs.existsSync(STORE_FILE)) {
      try {
        state = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      } catch (e) {
        console.error("Error loading state", e);
      }
    }
  }

  // Always check weekly reset even when cached state is present!
  checkWeeklyReset(state);

  if (!state.users || state.users.length === 0) {
    state.users = [
      { id: 1, username: 'Administrador', role: 'admin', password: 'Admin.1234' },
      { id: 2, username: 'Supervisor', role: 'supervisor', password: 'Super.1234' },
      { id: 3, username: 'Ruta 1', role: 'operator', password: 'Ruta1.1234' },
      { id: 4, username: 'Ruta 2', role: 'operator', password: 'Ruta2.1234' },
      { id: 5, username: 'Ruta 3', role: 'operator', password: 'Ruta3.1234' },
      { id: 6, username: 'Ruta 4', role: 'operator', password: 'Ruta4.1234' },
      { id: 7, username: 'Ruta 5', role: 'operator', password: 'Ruta5.1234' }
    ];
    saveState(state);
  }

  if (!state.stateVersion) {
    state.stateVersion = Date.now();
  }

  _cachedState = state;
  return state;
}

function saveState(state: any) {
  state.stateVersion = Date.now();
  _cachedState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Error writing data_store.json", e);
  }

  if (process.env.DATABASE_URL) {
    pool.query(`
      INSERT INTO app_state (key, data, updated_at)
      VALUES ('master_state', $1, NOW())
      ON CONFLICT (key) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW();
    `, [JSON.stringify(state)]).catch((err: any) => {
      console.warn("Notice: could not persist state to PostgreSQL:", err.message);
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  await initPersistentDatabase();
  startOdooSync();

  // Automated Cron for Sunday and Monday 3:00 AM
  cron.schedule('0 3 * * 0,1', async () => {
    console.log('[Cron] Ejecutando sincronización y cálculo de rutas de inicio de semana...');
    try {
      await triggerWeeklyAutomatedSync();
    } catch (e) {
      console.error('[Cron] Error en sincronización semanal programada:', e);
    }
  });

  const PORT = process.env.PORT || 3000;

  // Sync / Calculate Routes
  app.post('/api/sync', async (req, res) => {
    try {
      const state = await triggerWeeklyAutomatedSync();
      res.json({ success: true, state });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/data/delta', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const since = parseInt(req.query.since as string) || 0;
    const clientVersion = parseInt(req.query.version as string) || 0;
    const state = loadState();
    const deltaVisits = (state.visits || []).filter((v: any) => v.updatedAt && v.updatedAt >= since);
    
    const needsFullSync = !clientVersion || clientVersion !== state.stateVersion;
    
    if (needsFullSync) {
      res.json({
        needsFullSync: true,
        stateVersion: state.stateVersion,
        users: state.users || [],
        settings: state.settings || {},
        routes: state.routes || [],
        disabledZones: state.disabledZones || [],
        clientOverrides: state.clientOverrides || {},
        zoneOverrides: state.zoneOverrides || {},
        visits: deltaVisits
      });
    } else {
      res.json({
        needsFullSync: false,
        stateVersion: state.stateVersion,
        visits: deltaVisits
      });
    }
  });

  app.get('/api/data', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(loadState());
  });

  app.get('/api/tracking', async (req, res) => {
    try {
      const logs = await db.select().from(gpsLogs).orderBy(desc(gpsLogs.timestamp)).limit(10000);
      res.json(logs);
    } catch(e) {
      res.status(500).json({ error: 'Failed' });
    }
  });


  app.post('/api/tracking', async (req, res) => {
    try {
      const log = req.body;
      await db.insert(gpsLogs).values({ routeId: log.routeId, lat: log.lat, lng: log.lng, timestamp: new Date(log.timestamp) }).catch(() => {});
      
      const state = loadState();
      if (!state.trackingLogs) state.trackingLogs = [];
      state.trackingLogs.push(log);
      saveState(state);
      
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  
  app.post('/api/visits/reorder', (req, res) => {
    const { newVisits } = req.body;
    const state = loadState();
    
    // We only want to update the visits order/array, or just merge them
    // Assuming newVisits has the fully updated array
    if (newVisits && Array.isArray(newVisits)) {
      const now = Date.now();
      newVisits.forEach((v: any) => v.updatedAt = now);
      state.visits = newVisits;
      saveState(state);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid payload" });
    }
  });

  app.post('/api/visit/status', (req, res) => {
    const { visitId, status } = req.body;
    const state = loadState();
    const visit = state.visits.find((v: any) => v.id === visitId);
    if (visit) {
      visit.status = status;
      visit.updatedAt = Date.now();
      saveState(state);
      res.json({ success: true, visit });
    } else {
      res.status(404).json({ error: "Visit not found" });
    }
  });

  app.post('/api/routes/:id', (req, res) => {
    const { id } = req.params;
    const { isDelivery, isAuthorized } = req.body;
    const state = loadState();
    const route = state.routes.find((r: any) => r.id === parseInt(id));
    if (route) {
      if (isDelivery !== undefined) route.isDelivery = isDelivery;
      if (isAuthorized !== undefined) route.isAuthorized = isAuthorized;
      saveState(state);
      res.json({ success: true, route });
    } else {
      res.status(404).json({ error: "Route not found" });
    }
  });

  
  
  
  app.post('/api/settings', async (req, res) => {
    const { settings } = req.body;
    const state = loadState();
    
    const oldRateCompany = state.settings?.commissionRateCompany;
    const oldRatePerson = state.settings?.commissionRatePerson;
    const oldMultiplier = state.settings?.commissionAdjustmentMultiplier;
    
    state.settings = { ...state.settings, ...settings };
    saveState(state);
    
    if (settings && (
      settings.commissionRateCompany !== oldRateCompany ||
      settings.commissionRatePerson !== oldRatePerson ||
      settings.commissionAdjustmentMultiplier !== oldMultiplier
    )) {
        try {
            const rateCompany = (typeof state.settings.commissionRateCompany === 'number' ? state.settings.commissionRateCompany : 1.0) / 100;
            const ratePerson = (typeof state.settings.commissionRatePerson === 'number' ? state.settings.commissionRatePerson : 2.0) / 100;
            const multiplier = (typeof state.settings.commissionAdjustmentMultiplier === 'number' && Number.isFinite(state.settings.commissionAdjustmentMultiplier))
              ? Math.max(0, state.settings.commissionAdjustmentMultiplier)
              : 1.0;
            
            const unpaid = await db.select().from(commissions).where(eq(commissions.isPaid, false));
            for (const u of unpaid) {
                const isCompany = u.clientType === 'company';
                const baseRate = isCompany ? rateCompany : ratePerson;
                const effectiveRate = baseRate * multiplier;
                const newAmt = u.orderTotal * effectiveRate;
                if (u.commissionRate !== effectiveRate || u.commissionAmount !== newAmt) {
                   await db.update(commissions).set({ commissionRate: effectiveRate, commissionAmount: newAmt }).where(eq(commissions.id, u.id));
                }
            }
        } catch(e) { console.error("Error updating commissions on setting change:", e); }
    }
    
    res.json({ success: true, settings: state.settings });
  });

  
  app.post('/api/settings/zone-overrides/:zone', (req, res) => {
    const { zone } = req.params;
    const updates = req.body;
    const state = loadState();
    if (!state.zoneOverrides) state.zoneOverrides = {};
    
    state.zoneOverrides[zone] = { 
        ...(state.zoneOverrides[zone] || {}), 
        ...updates 
    };
    
    saveState(state);
    res.json({ success: true, zoneOverrides: state.zoneOverrides });
  });

  app.post('/api/settings/zones', (req, res) => {
    const { disabledZones } = req.body;
    const state = loadState();
    state.disabledZones = disabledZones;
    saveState(state);
    res.json({ success: true, disabledZones: state.disabledZones });
  });

  app.post('/api/settings/client-overrides/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const state = loadState();
    if (!state.clientOverrides) state.clientOverrides = {};
    
    state.clientOverrides[id] = { 
        ...(state.clientOverrides[id] || {}), 
        ...updates 
    };
    
    // Also update the client in state.clients directly for immediate UI reflection
    const client = state.clients.find(c => c.id === parseInt(id));
    if (client) {
       if (updates.isActive !== undefined) client.isActive = updates.isActive;
       if (updates.assignedRouteId !== undefined) client.assignedRouteId = updates.assignedRouteId;
       if (updates.permanentRouteId !== undefined) client.permanentRouteId = updates.permanentRouteId;
       if (updates.assignedDay !== undefined) client.assignedDay = updates.assignedDay;
       if (updates.permanentDay !== undefined) client.permanentDay = updates.permanentDay;
       if (updates.visitFrequency !== undefined) client.visitFrequency = updates.visitFrequency;
    }
    
    saveState(state);
    res.json({ success: true, clientOverrides: state.clientOverrides[id], client });
  });

  app.post('/api/clients/:id/coordinates', async (req, res) => {
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

  app.post('/api/users', (req, res) => {
    const user = req.body;
    const state = loadState();
    user.id = Date.now();
    state.users.push(user);
    saveState(state);
    res.json({ success: true, user });
  });

  app.put('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const state = loadState();
    const idx = state.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      state.users[idx] = { ...state.users[idx], ...updates };
      saveState(state);
      res.json({ success: true, user: state.users[idx] });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const state = loadState();
    state.users = state.users.filter(u => u.id !== id);
    saveState(state);
    res.json({ success: true });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }
    const state = loadState();
    const sanitizedUsername = String(username).trim().toLowerCase().replace(/[\x00-\x1F\x7F]/g, '');
    const sanitizedPassword = String(password).trim();
    
    const foundUser = (state.users || []).find((u: any) => 
      String(u.username).trim().toLowerCase() === sanitizedUsername && 
      String(u.password).trim() === sanitizedPassword
    );
    
    if (foundUser) {
      res.json({
        success: true,
        user: {
          id: foundUser.id,
          username: foundUser.username,
          role: foundUser.role
        }
      });
    } else {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
  });

  // Backup / Export Master State
  app.get('/api/backup/export', (req, res) => {
    const state = loadState();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="lacteos_backup_' + new Date().toISOString().slice(0, 10) + '.json"');
    res.send(JSON.stringify(state, null, 2));
  });

  // Restore Master State
  app.post('/api/backup/restore', (req, res) => {
    try {
      const backupData = req.body;
      if (!backupData || typeof backupData !== 'object') {
        return res.status(400).json({ error: "Datos de respaldo inválidos" });
      }
      const existing = loadState();
      const restoredState: AppState = {
        clients: backupData.clients || existing.clients || [],
        visits: backupData.visits || existing.visits || [],
        routes: backupData.routes || existing.routes || [],
        users: backupData.users || existing.users || [],
        trackingLogs: existing.trackingLogs || [],
        disabledZones: backupData.disabledZones || existing.disabledZones || [],
        clientOverrides: backupData.clientOverrides || existing.clientOverrides || {},
        zoneOverrides: backupData.zoneOverrides || existing.zoneOverrides || {},
        settings: backupData.settings || existing.settings || { closeTime: "18:00" },
        lastSync: backupData.lastSync || existing.lastSync,
        lastWeekReset: backupData.lastWeekReset || existing.lastWeekReset,
        stateVersion: Date.now()
      };
      saveState(restoredState);
      res.json({ success: true, state: restoredState });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development


  app.get('/api/auth/role', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      res.json({ role });
    } catch(e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  
  app.post('/api/commissions/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });
      
      await syncCommissions();
      res.json({ success: true });
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: "Failed to sync" });
    }
  });

  app.get('/api/commissions', requireAuth, async (req: AuthRequest, res) => {
    try {
      try {
        const data = await db.select().from(commissions).orderBy(desc(commissions.dateOrder)).limit(10000);
        if (data && data.length > 0) return res.json(data);
      } catch (dbErr) {}

      const local = loadLocalCommissions();
      local.sort((a, b) => new Date(b.dateOrder).getTime() - new Date(a.dateOrder).getTime());
      res.json(local);
    } catch(e) {
      console.error(e);
      const local = loadLocalCommissions();
      res.json(local);
    }
  });

  app.get('/api/reports/sales', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });

      const type = (req.query.type as 'weekly' | 'monthly' | 'yearly') || 'weekly';
      const date = (req.query.date as string) || undefined;
      const routeId = req.query.routeId ? parseInt(req.query.routeId as string) : undefined;

      const report = await getSalesReport(type, date, routeId);
      res.json(report);
    } catch (e: any) {
      console.error("Error generating sales report:", e);
      res.status(500).json({ error: e.message || "Failed to generate report" });
    }
  });



  app.post('/api/commissions/:id/toggle-type', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });
      
      const { id } = req.params;
      const { clientType, clientId } = req.body;
      
      const state = loadState();
      let rateCompany = 0.01;
      let ratePerson = 0.02;
      let multiplier = 1.0;
      if (state.settings) {
         if (typeof state.settings.commissionRateCompany === 'number') rateCompany = state.settings.commissionRateCompany / 100;
         if (typeof state.settings.commissionRatePerson === 'number') ratePerson = state.settings.commissionRatePerson / 100;
         if (typeof state.settings.commissionAdjustmentMultiplier === 'number' && Number.isFinite(state.settings.commissionAdjustmentMultiplier)) {
           multiplier = Math.max(0, state.settings.commissionAdjustmentMultiplier);
         }
      }
      
      const baseRate = clientType === 'company' ? rateCompany : ratePerson;
      const rate = baseRate * multiplier;
      
      // Update in DB if available
      try {
        const targetComm = await db.select().from(commissions).where(eq(commissions.id, parseInt(id))).limit(1);
        if (targetComm.length > 0) {
           const newAmt = targetComm[0].orderTotal * rate;
           await db.update(commissions).set({ clientType, commissionRate: rate, commissionAmount: newAmt }).where(eq(commissions.id, parseInt(id)));
        }
        if (clientId) {
           const unpaid = await db.select().from(commissions).where(eq(commissions.clientId, parseInt(clientId)));
           for (const u of unpaid) {
              if (!u.isPaid) {
                 await db.update(commissions).set({ clientType, commissionRate: rate, commissionAmount: u.orderTotal * rate }).where(eq(commissions.id, u.id));
              }
           }
        }
      } catch (dbErr) {}

      // Always update local store
      const local = loadLocalCommissions();
      for (const item of local) {
        if (String(item.id) === String(id) || String(item.orderId) === String(id)) {
          item.clientType = clientType;
          item.commissionRate = rate;
          item.commissionAmount = (item.orderTotal || 0) * rate;
        } else if (clientId && String(item.clientId) === String(clientId) && !item.isPaid) {
          item.clientType = clientType;
          item.commissionRate = rate;
          item.commissionAmount = (item.orderTotal || 0) * rate;
        }
      }
      saveLocalCommissions(local);

      if (clientId) {
         if (!state.clientOverrides) state.clientOverrides = {};
         state.clientOverrides[clientId] = {
             ...(state.clientOverrides[clientId] || {}),
             clientType
         };
         saveState(state);
      }

      res.json({ success: true, rate });
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post('/api/commissions/:id/liquidate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });

      const { id } = req.params;

      try {
        await db
          .update(commissions)
          .set({ isLiquidated: true, dateOrder: new Date() })
          .where(eq(commissions.id, parseInt(id)));
      } catch (dbErr) {}

      const local = loadLocalCommissions();
      for (const item of local) {
        if (String(item.id) === String(id) || String(item.orderId) === String(id)) {
          item.isLiquidated = true;
          item.dateOrder = new Date().toISOString();
        }
      }
      saveLocalCommissions(local);

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post('/api/commissions/:id/pay', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });

      const { id } = req.params;
      const { isPaid } = req.body;
      try {
        await db.update(commissions).set({ isPaid }).where(eq(commissions.id, parseInt(id)));
      } catch (dbErr) {}

      const local = loadLocalCommissions();
      for (const item of local) {
        if (String(item.id) === String(id) || String(item.orderId) === String(id)) {
          item.isPaid = isPaid;
        }
      }
      saveLocalCommissions(local);

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get('/api/payrolls', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = await getUserRole(req.user!.uid);
      if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });
      const data = await db.select().from(payrolls).orderBy(desc(payrolls.startDate));
      res.json(data);
    } catch(e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post('/api/payrolls', requireAuth, async (req: AuthRequest, res) => {
    try {
       const role = await getUserRole(req.user!.uid);
       if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Forbidden" });
       await db.insert(payrolls).values(req.body);
       res.json({ success: true });
    } catch(e) {
       res.status(500).json({ error: "Failed" });
    }
  });


  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
