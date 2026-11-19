import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';
import { executeKw } from './odoo.ts';

const SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const SHEET_NAME = 'Catalogo_Clientes';
const CACHE_FILE = path.join(process.cwd(), 'odoo_clients_cache.json');

export const CLIENTS_HEADERS = [
  'ID Odoo',
  'Código / Ref',
  'Cliente / Negocio',
  'Ruta Asignada',
  'Día Visita',
  'Municipio / Ciudad',
  'Estado',
  'Dirección (Calle)',
  'Colonia / Ref 2',
  'Código Postal',
  'Teléfono',
  'Móvil',
  'Correo Electrónico',
  'RFC',
  'Latitud GPS',
  'Longitud GPS',
  'Compras (Rank)',
  'Estatus',
  'Última Actualización'
];

export interface SyncedClientItem {
  id: number;
  ref: string;
  name: string;
  rutaAsignada: string;
  diaVisita: string;
  municipio: string;
  estado: string;
  calle: string;
  colonia: string;
  zip: string;
  phone: string;
  mobile: string;
  email: string;
  vat: string;
  lat: number | null;
  lng: number | null;
  customerRank: number;
  active: boolean;
  updatedAt: string;
}

/**
 * Limpia etiquetas HTML de notas de Odoo (ej. día de visita)
 */
export function cleanHtmlComment(html: string): string {
  if (!html) return '';
  let text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

/**
 * Asegura que la pestaña Catalogo_Clientes exista en Google Sheets
 */
async function ensureClientsSheetExists(token: string): Promise<{ exists: boolean; sheetId?: number }> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta: any = await metaRes.json();
    const sheetObj = (meta.sheets || []).find((s: any) => s.properties?.title === SHEET_NAME);

    if (sheetObj) {
      return { exists: true, sheetId: sheetObj.properties?.sheetId };
    }

    console.log(`[clientsSheetService] Creando pestaña "${SHEET_NAME}" en Google Sheets...`);
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_NAME,
                  gridProperties: { rowCount: 1500, columnCount: 22 }
                }
              }
            }
          ]
        })
      }
    );
    if (!addRes.ok) {
      console.error('[clientsSheetService] Error creando pestaña:', await addRes.text());
      return { exists: false };
    }

    const addData = await addRes.json();
    const newSheetId = addData?.replies?.[0]?.addSheet?.properties?.sheetId;

    // Escribir fila de encabezados
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:S1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [CLIENTS_HEADERS] })
      }
    );

    return { exists: true, sheetId: newSheetId };
  } catch (err) {
    console.error('[clientsSheetService] ensureClientsSheetExists error:', err);
    return { exists: false };
  }
}

/**
 * Guarda en caché local JSON
 */
export function saveLocalClientsCache(clients: SyncedClientItem[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      updatedAt: new Date().toISOString(),
      count: clients.length,
      clients
    }, null, 2), 'utf8');
  } catch (e) {
    console.warn('[clientsSheetService] Error saving local clients cache:', e);
  }
}

/**
 * Carga desde caché local JSON
 */
export function loadLocalClientsCache(): SyncedClientItem[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return data.clients || [];
    }
  } catch (e) {
    console.warn('[clientsSheetService] Error reading local clients cache:', e);
  }
  return [];
}

/**
 * Normaliza un partner de Odoo al formato SyncedClientItem
 */
export function formatPartnerToClientItem(p: any): SyncedClientItem {
  const nowIso = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  // Ruta asignada desde user_id
  let ruta = '';
  if (Array.isArray(p.user_id) && p.user_id.length > 1) {
    ruta = String(p.user_id[1]);
  }

  // Día de visita desde notas/comment
  const diaVisita = cleanHtmlComment(p.comment || '');

  // Estado
  let estadoStr = '';
  if (Array.isArray(p.state_id) && p.state_id.length > 1) {
    estadoStr = String(p.state_id[1]).replace(/\s*\(MX\)/i, '').trim();
  }

  // Coordenadas GPS
  const lat = typeof p.partner_latitude === 'number' && p.partner_latitude !== 0 ? p.partner_latitude : null;
  const lng = typeof p.partner_longitude === 'number' && p.partner_longitude !== 0 ? p.partner_longitude : null;

  return {
    id: p.id,
    ref: p.ref ? String(p.ref).trim() : '',
    name: p.name ? String(p.name).trim() : 'Sin Nombre',
    rutaAsignada: ruta,
    diaVisita,
    municipio: p.city ? String(p.city).trim() : '',
    estado: estadoStr,
    calle: p.street ? String(p.street).trim() : '',
    colonia: p.street2 ? String(p.street2).trim() : '',
    zip: p.zip ? String(p.zip).trim() : '',
    phone: p.phone ? String(p.phone).trim() : '',
    mobile: p.mobile ? String(p.mobile).trim() : '',
    email: p.email ? String(p.email).trim() : '',
    vat: p.vat ? String(p.vat).trim() : '',
    lat,
    lng,
    customerRank: Number(p.customer_rank) || 0,
    active: p.active !== false,
    updatedAt: nowIso
  };
}

/**
 * Consulta Odoo ERP en vivo para extraer todos los clientes activos
 */
export async function fetchLiveOdooClients(): Promise<SyncedClientItem[]> {
  console.log('[clientsSheetService] Consultando clientes activos desde Odoo...');
  const fields = [
    'id', 'name', 'ref', 'street', 'street2', 'city', 'state_id', 'zip',
    'phone', 'mobile', 'email', 'vat', 'partner_latitude', 'partner_longitude',
    'user_id', 'comment', 'customer_rank', 'active', 'write_date'
  ];

  // Buscamos clientes activos
  const partners = await executeKw(
    'res.partner',
    'search_read',
    [[['active', '=', true]]],
    {
      fields,
      limit: 2500,
      order: 'customer_rank desc, name asc'
    }
  );

  const items: SyncedClientItem[] = (partners || []).map(formatPartnerToClientItem);
  saveLocalClientsCache(items);
  console.log(`[clientsSheetService] Se obtuvieron ${items.length} clientes desde Odoo.`);
  return items;
}

/**
 * Sincroniza la lista de clientes hacia la hoja Catalogo_Clientes en Google Sheets
 */
export async function syncClientsToGoogleSheet(clients?: SyncedClientItem[]): Promise<{
  success: boolean;
  count: number;
  sheetUrl: string;
  sheetId?: number;
}> {
  try {
    const token = await getGoogleAccessToken();
    const { exists, sheetId } = await ensureClientsSheetExists(token);
    if (!exists) throw new Error('No se pudo acceder o crear la pestaña Catalogo_Clientes');

    const items = clients && clients.length > 0 ? clients : await fetchLiveOdooClients();

    // Preparar filas para Sheets
    const rows = items.map(c => [
      c.id,
      c.ref,
      c.name,
      c.rutaAsignada,
      c.diaVisita,
      c.municipio,
      c.estado,
      c.calle,
      c.colonia,
      c.zip,
      c.phone,
      c.mobile,
      c.email,
      c.vat,
      c.lat ?? '',
      c.lng ?? '',
      c.customerRank,
      c.active ? 'ACTIVO' : 'INACTIVO',
      c.updatedAt
    ]);

    // Limpiar rango existente (desde A2 hacia abajo)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:S3000:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    // Escribir filas actualizadas
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      }
    );

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`Error escribiendo en Catalogo_Clientes: ${errText}`);
    }

    const sheetUrl = sheetId !== undefined
      ? `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheetId}`
      : `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

    console.log(`[clientsSheetService] ${items.length} clientes sincronizados exitosamente a Catalogo_Clientes en Google Sheets.`);
    return {
      success: true,
      count: items.length,
      sheetUrl,
      sheetId
    };
  } catch (err: any) {
    console.error('[clientsSheetService] syncClientsToGoogleSheet error:', err.message);
    throw err;
  }
}

/**
 * Carga clientes desde Google Sheets si Odoo no está disponible
 */
export async function loadClientsFromGoogleSheet(): Promise<SyncedClientItem[]> {
  try {
    const token = await getGoogleAccessToken();
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:S3000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];

    const json: any = await res.json();
    const values: any[][] = json.values || [];

    const items: SyncedClientItem[] = values.map(row => ({
      id: parseInt(row[0], 10) || 0,
      ref: row[1] || '',
      name: row[2] || '',
      rutaAsignada: row[3] || '',
      diaVisita: row[4] || '',
      municipio: row[5] || '',
      estado: row[6] || '',
      calle: row[7] || '',
      colonia: row[8] || '',
      zip: row[9] || '',
      phone: row[10] || '',
      mobile: row[11] || '',
      email: row[12] || '',
      vat: row[13] || '',
      lat: row[14] ? parseFloat(row[14]) : null,
      lng: row[15] ? parseFloat(row[15]) : null,
      customerRank: parseInt(row[16], 10) || 0,
      active: (row[17] || '').toUpperCase() === 'ACTIVO',
      updatedAt: row[18] || ''
    })).filter(c => c.id > 0);

    if (items.length > 0) {
      saveLocalClientsCache(items);
    }
    return items;
  } catch (err) {
    console.error('[clientsSheetService] loadClientsFromGoogleSheet error:', err);
    return [];
  }
}

/**
 * Obtiene el catálogo maestro de clientes (Odoo en vivo -> Sheets -> Caché local)
 */
export async function getMasterClientsCatalog(forceOdoo = false): Promise<SyncedClientItem[]> {
  if (forceOdoo) {
    try {
      const live = await fetchLiveOdooClients();
      if (live.length > 0) {
        syncClientsToGoogleSheet(live).catch(e => console.warn('[clientsSheetService] Async sync to sheet failed:', e.message));
        return live;
      }
    } catch (e: any) {
      console.warn('[clientsSheetService] Odoo fetch falló, intentando Sheets...', e.message);
    }
  }

  // 1. Intentar desde Caché local reciente
  const cached = loadLocalClientsCache();
  if (cached.length > 0 && !forceOdoo) {
    return cached;
  }

  // 2. Intentar Odoo en vivo
  try {
    const live = await fetchLiveOdooClients();
    if (live.length > 0) {
      syncClientsToGoogleSheet(live).catch(e => console.warn('[clientsSheetService] Async sync to sheet failed:', e.message));
      return live;
    }
  } catch (e: any) {
    console.warn('[clientsSheetService] Odoo inaccesible, recurriendo a Google Sheets...', e.message);
  }

  // 3. Fallback a Google Sheets
  const sheetItems = await loadClientsFromGoogleSheet();
  if (sheetItems.length > 0) {
    return sheetItems;
  }

  // 4. Último recurso: caché local existente
  return cached;
}

/**
 * Actualiza un cliente específico por ID, Nombre o Referencia desde Odoo
 */
export async function syncSingleClientFromOdoo(query: string | number): Promise<SyncedClientItem | null> {
  const fields = [
    'id', 'name', 'ref', 'street', 'street2', 'city', 'state_id', 'zip',
    'phone', 'mobile', 'email', 'vat', 'partner_latitude', 'partner_longitude',
    'user_id', 'comment', 'customer_rank', 'active', 'write_date'
  ];

  let domain: any[] = [];
  const numId = typeof query === 'number' ? query : parseInt(query, 10);
  if (!isNaN(numId) && numId > 0 && String(numId) === String(query).trim()) {
    domain = [['id', '=', numId]];
  } else {
    domain = ['|', ['name', 'ilike', String(query).trim()], ['ref', 'ilike', String(query).trim()]];
  }

  const partners = await executeKw('res.partner', 'search_read', [domain], {
    fields,
    limit: 1
  });

  if (!partners || partners.length === 0) {
    return null;
  }

  const updatedItem = formatPartnerToClientItem(partners[0]);

  // Actualizar en caché local
  const currentCatalog = loadLocalClientsCache();
  const idx = currentCatalog.findIndex(c => c.id === updatedItem.id);
  if (idx >= 0) {
    currentCatalog[idx] = updatedItem;
  } else {
    currentCatalog.unshift(updatedItem);
  }
  saveLocalClientsCache(currentCatalog);

  // Actualizar en Google Sheets en segundo plano
  syncClientsToGoogleSheet(currentCatalog).catch(e => console.warn('[clientsSheetService] Sync single client to sheet error:', e.message));

  return updatedItem;
}
