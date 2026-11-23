import { getGoogleAccessToken } from './googleCredentials.ts';

const SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const SHEET_NAME = 'Planes_Rutas_Semanales';

export const ROUTE_PLANS_HEADERS = [
  'Semana',
  'Fecha Cálculo',
  'ID Ruta',
  'Nombre Ruta',
  'Día Programado',
  'Secuencia',
  'ID Cliente',
  'Nombre Cliente / Negocio',
  'Municipio / Zona',
  'Dirección',
  'Teléfono / Contacto',
  'Volumen Venta Estimado',
  'Estatus Visita',
  'Latitud GPS',
  'Longitud GPS'
];

/**
 * Sanitiza valores de texto para evitar que números con '+' o '=' se rompan en Google Sheets (#ERROR!)
 */
function sanitizeCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.startsWith('+') || str.startsWith('=')) {
    return `'${str}`;
  }
  return str;
}

/**
 * Obtiene el número de semana del año según ISO 8601
 */
function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Asegura que la pestaña 'Planes_Rutas_Semanales' exista en Google Sheets y tenga encabezados formateados.
 */
async function ensureRoutePlansSheetExists(token: string): Promise<{ exists: boolean; sheetId?: number }> {
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

    console.log(`[routePlansSheetService] Creando pestaña '${SHEET_NAME}' en Google Sheets...`);
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
                  gridProperties: { rowCount: 2000, columnCount: 16, frozenRowCount: 1 }
                }
              }
            }
          ]
        })
      }
    );

    if (!addRes.ok) {
      console.error('[routePlansSheetService] Error creando pestaña:', await addRes.text());
      return { exists: false };
    }

    const addData = await addRes.json();
    const newSheetId = addData?.replies?.[0]?.addSheet?.properties?.sheetId;

    // Escribir encabezados en fila 1
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:O1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [ROUTE_PLANS_HEADERS] })
      }
    );

    // Formatear encabezados (fondo azul oscuro, texto blanco, negrita)
    if (newSheetId !== undefined) {
      await fetch(
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
                repeatCell: {
                  range: {
                    sheetId: newSheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: ROUTE_PLANS_HEADERS.length
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.1, green: 0.25, blue: 0.5 },
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                      horizontalAlignment: 'CENTER'
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
              }
            ]
          })
        }
      ).catch(() => {});
    }

    return { exists: true, sheetId: newSheetId };
  } catch (err: any) {
    console.error('[routePlansSheetService] Error en ensureRoutePlansSheetExists:', err.message);
    return { exists: false };
  }
}

/**
 * Vuelca el plan maestro de rutas y visitas calculadas de la semana a Google Sheets.
 */
export async function syncRoutePlanToGoogleSheet(state: any): Promise<{ success: boolean; rowsCount: number; error?: string }> {
  try {
    const visits = state?.visits || [];
    const clients = state?.clients || [];
    const routes = state?.routes || [];

    if (!Array.isArray(visits) || visits.length === 0) {
      console.warn('[routePlansSheetService] No hay visitas en el plan para sincronizar a Google Sheets.');
      return { success: false, rowsCount: 0, error: 'No hay visitas calculadas.' };
    }

    const token = await getGoogleAccessToken();
    if (!token) {
      console.warn('[routePlansSheetService] No se obtuvo token de acceso a Google Sheets.');
      return { success: false, rowsCount: 0, error: 'Token de Google Sheets no disponible.' };
    }

    const sheetCheck = await ensureRoutePlansSheetExists(token);
    if (!sheetCheck.exists) {
      return { success: false, rowsCount: 0, error: 'No se pudo crear o verificar la pestaña en Google Sheets.' };
    }

    const now = new Date();
    const currentWeek = `Semana ${getWeekNumber(now)} - ${now.getFullYear()}`;
    const calcDateStr = now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

    // Mapa rápido de clientes por id para extraer detalles
    const clientMap = new Map<number, any>();
    clients.forEach((c: any) => clientMap.set(c.id, c));

    // Mapa rápido de rutas por id
    const routeMap = new Map<number, string>();
    routes.forEach((r: any) => routeMap.set(r.id, r.name));

    // Días ordenados de la semana
    const DAY_ORDER: Record<string, number> = {
      'Lunes': 1,
      'Martes': 2,
      'Miércoles': 3,
      'Jueves': 4,
      'Viernes': 5,
      'Sábado': 6,
      'Domingo': 7
    };

    // Agrupar visitas por Día y Ruta para calcular la secuencia (1, 2, 3...)
    const visitsByDayAndRoute = new Map<string, any[]>();
    visits.forEach((v: any) => {
      const day = v.day || 'Lunes';
      const rId = v.routeId || 0;
      const key = `${day}_${rId}`;
      if (!visitsByDayAndRoute.has(key)) {
        visitsByDayAndRoute.set(key, []);
      }
      visitsByDayAndRoute.get(key)!.push(v);
    });

    // Construir filas de datos
    const rows: any[][] = [];

    // Ordenar claves por día y luego por ruta
    const sortedKeys = Array.from(visitsByDayAndRoute.keys()).sort((a, b) => {
      const [dayA, rA] = a.split('_');
      const [dayB, rB] = b.split('_');
      const dOrderA = DAY_ORDER[dayA] || 99;
      const dOrderB = DAY_ORDER[dayB] || 99;
      if (dOrderA !== dOrderB) return dOrderA - dOrderB;
      return Number(rA) - Number(rB);
    });

    for (const key of sortedKeys) {
      const dayVisits = visitsByDayAndRoute.get(key)!;
      dayVisits.forEach((v: any, index: number) => {
        const c = clientMap.get(v.clientId) || {};
        const routeName = v.routeName || routeMap.get(v.routeId) || `Ruta ${v.routeId}`;
        const street = c.street || '';
        const phone = c.phone || c.mobile || '';
        const volumeStr = c.salesVolume ? `$${Number(c.salesVolume).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '$0.00';

        rows.push([
          currentWeek,                               // Semana
          calcDateStr,                               // Fecha Cálculo
          v.routeId,                                 // ID Ruta
          routeName,                                 // Nombre Ruta
          v.day,                                     // Día Programado
          index + 1,                                 // Secuencia / Orden Visita
          v.clientId,                                // ID Cliente
          sanitizeCell(c.name || v.clientName || ''),// Nombre Cliente / Negocio
          sanitizeCell(c.city || 'San Juan de los Lagos'), // Municipio / Zona
          sanitizeCell(street),                      // Dirección
          sanitizeCell(phone),                       // Teléfono / Contacto
          volumeStr,                                 // Volumen Estimado
          v.status || 'PENDIENTE',                   // Estatus Visita
          c.lat || v.lat || 0,                       // Latitud GPS
          c.lng || v.lng || 0                        // Longitud GPS
        ]);
      });
    }

    // 1. Limpiar datos existentes en la pestaña (a partir de la fila 2)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:O5000:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    ).catch(e => console.warn('[routePlansSheetService] Advertencia al limpiar filas previas:', e.message));

    // 2. Escribir encabezados en A1:O1 para garantizar consistencia
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:O1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [ROUTE_PLANS_HEADERS] })
      }
    );

    // 3. Escribir las filas calculadas a partir de A2
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:O${rows.length + 1}?valueInputOption=USER_ENTERED`,
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
      console.error('[routePlansSheetService] Error al escribir filas en Google Sheets:', errText);
      return { success: false, rowsCount: 0, error: errText };
    }

    console.log(`[routePlansSheetService] ✅ Plan semanal de rutas sincronizado exitosamente en Google Sheets (${rows.length} visitas guardadas).`);
    return { success: true, rowsCount: rows.length };
  } catch (err: any) {
    console.error('[routePlansSheetService] Excepción en syncRoutePlanToGoogleSheet:', err.message);
    return { success: false, rowsCount: 0, error: err.message };
  }
}
