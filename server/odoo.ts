export const ODOO_URL = "https://lacteos-trujillos2.odoo.com/jsonrpc";
export const ODOO_DB = "lacteos-trujillos2";
export const ODOO_USER = "estelacampos1200@gmail.com";
export const ODOO_PASS = "LacteosTrujillos2024";

let _uid: number | null = null;
let _authPromise: Promise<number> | null = null;

async function jsonRpc(method: string, params: any, retries = 3, delayMs = 800): Promise<any> {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: params,
    id: Math.floor(Math.random() * 1000000)
  };
  
  try {
    const response = await fetch(ODOO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 429 && retries > 0) {
      console.warn(`[Odoo Rate Limit] 429 received, retrying in ${delayMs}ms...`);
      await new Promise(res => setTimeout(res, delayMs));
      return await jsonRpc(method, params, retries - 1, delayMs * 2);
    }
    
    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      if ((response.status === 429 || text.includes('Rate limit exceeded')) && retries > 0) {
        console.warn(`[Odoo Rate Limit] HTML 429 received, retrying in ${delayMs}ms...`);
        await new Promise(res => setTimeout(res, delayMs));
        return await jsonRpc(method, params, retries - 1, delayMs * 2);
      }
      console.error(`[Odoo RPC Error] HTTP ${response.status} ${response.statusText}:`, text.slice(0, 300));
      throw new Error(`Odoo HTTP ${response.status}: ${text.slice(0, 100)}`);
    }
    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message || "Odoo RPC Error");
    }
    return data.result;
  } catch (e: any) {
    if (retries > 0 && (e.message?.includes('429') || e.message?.includes('fetch failed'))) {
      await new Promise(res => setTimeout(res, delayMs));
      return await jsonRpc(method, params, retries - 1, delayMs * 2);
    }
    throw e;
  }
}

export async function authenticate() {
  if (_uid) return _uid;
  if (_authPromise) return await _authPromise;
  _authPromise = (async () => {
    try {
      const res = await jsonRpc("common", {
        service: "common",
        method: "authenticate",
        args: [ODOO_DB, ODOO_USER, ODOO_PASS, {}]
      });
      _uid = res;
      return res;
    } finally {
      _authPromise = null;
    }
  })();
  return await _authPromise;
}

export async function executeKw(model: string, method: string, args: any[], kwargs: any = {}) {
  const uid = await authenticate();
  return await jsonRpc("object", {
    service: "object",
    method: "execute_kw",
    args: [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]
  });
}

export async function fetchClients() {
  // Only active clients that are actually customers
  return await executeKw(
    "res.partner",
    "search_read",
    [[["active", "=", true]]],
    {
      fields: ["id", "name", "partner_latitude", "partner_longitude", "city", "state_id", "street", "street2", "zip", "company_type", "is_company"],
      limit: 2000 // Ensure we get a good amount
    }
  );
}

export async function fetchRoutes() {
  return await executeKw(
    "pos.config",
    "search_read",
    [[]],
    {
      fields: ["id", "name"]
    }
  );
}

export async function fetchRecentSales() {
  // Last 100 days
  const date100DaysAgo = new Date();
  date100DaysAgo.setDate(date100DaysAgo.getDate() - 100);
  const dateString = date100DaysAgo.toISOString().split('T')[0] + " 00:00:00";

  return await executeKw(
    "pos.order",
    "search_read",
    [[["date_order", ">=", dateString]]],
    {
      fields: ["id", "name", "date_order", "partner_id", "config_id", "amount_total"],
      limit: 10000 // Get up to 10k orders to analyze
    }
  );
}

export const RUTAS_USER_ID = 18;
export const RUTAS_USER_EMAIL = 'lacteostrujillosrutas@gmail.com';

// Mapeo unificado de TPVs / Rutas en Odoo:
// Todas las rutas en campo utilizan la cuenta unificada lacteostrujillosrutas@gmail.com (ID: 18)
// y Estela Campos (ID: 2) se mantiene como administradora / cerebro para la sincronización y reportes del servidor.
export const ROUTE_USER_MAPPING: Record<number, { userId: number; name: string; email: string }> = {
  1: { userId: RUTAS_USER_ID, name: 'Ruta 1', email: RUTAS_USER_EMAIL },
  2: { userId: RUTAS_USER_ID, name: 'Ruta 2', email: RUTAS_USER_EMAIL },
  3: { userId: RUTAS_USER_ID, name: 'Ruta 3', email: RUTAS_USER_EMAIL },
  4: { userId: RUTAS_USER_ID, name: 'Ruta 4', email: RUTAS_USER_EMAIL },
  5: { userId: RUTAS_USER_ID, name: 'Ruta 4', email: RUTAS_USER_EMAIL },
  9: { userId: RUTAS_USER_ID, name: 'Ruta 5', email: RUTAS_USER_EMAIL },
};

/**
 * Revisa todas las sesiones abiertas de TPV / POS en Odoo y las asigna automáticamente
 * a la cuenta unificada de rutas (lacteostrujillosrutas@gmail.com - ID 18) para evitar bloqueos
 * cuando Estela Campos u otro supervisor abre las sesiones en la mañana.
 */
export async function ensureOpenSessionsAssignedToRouteDrivers() {
  try {
    const openSessions = await executeKw(
      'pos.session',
      'search_read',
      [[['state', '=', 'opened']]],
      { fields: ['id', 'name', 'config_id', 'user_id', 'state'] }
    );

    if (!Array.isArray(openSessions)) return;

    for (const session of openSessions) {
      const configId = Array.isArray(session.config_id) ? session.config_id[0] : session.config_id;
      const targetUser = ROUTE_USER_MAPPING[configId] || { userId: RUTAS_USER_ID, name: `Ruta ${configId}`, email: RUTAS_USER_EMAIL };
      const currentUserId = Array.isArray(session.user_id) ? session.user_id[0] : session.user_id;
      if (currentUserId !== targetUser.userId) {
        console.log(`[POS Auto-Assign] Reasignando sesión ${session.id} (${session.name}) del TPV ${configId} del usuario ${currentUserId} a cuenta unificada ${targetUser.userId} (${targetUser.email})`);
        await executeKw('pos.session', 'write', [
          [session.id],
          { user_id: targetUser.userId }
        ]);
      }
    }
  } catch (err: any) {
    console.error('[POS Auto-Assign] Error al sincronizar usuarios de sesiones POS:', err.message);
  }
}

/**
 * Asegura inmediatamente que la sesión activa del configId dado pertenezca al usuario de rutas (18).
 */
export async function reconcileSinglePosSession(routeOrConfigId: number) {
  const configId = routeOrConfigId === 4 ? 5 : routeOrConfigId;
  const targetUser = ROUTE_USER_MAPPING[configId] || { userId: RUTAS_USER_ID, name: `Ruta ${configId}`, email: RUTAS_USER_EMAIL };
  try {
    const sessions = await executeKw(
      'pos.session',
      'search_read',
      [[['config_id', '=', configId], ['state', '=', 'opened']]],
      { fields: ['id', 'name', 'user_id', 'state'], limit: 1 }
    );

    if (Array.isArray(sessions) && sessions.length > 0) {
      const currentUserId = Array.isArray(sessions[0].user_id) ? sessions[0].user_id[0] : sessions[0].user_id;
      if (currentUserId !== targetUser.userId) {
        console.log(`[POS Auto-Assign] Reconciliando sesión ${sessions[0].id} de TPV ${configId} para usuario unificado ${targetUser.userId} (${targetUser.email})`);
        await executeKw('pos.session', 'write', [
          [sessions[0].id],
          { user_id: targetUser.userId }
        ]);
      }
    }
  } catch (err: any) {
    console.error(`[POS Auto-Assign] Error reconciliando TPV ${configId}:`, err.message);
  }
}

