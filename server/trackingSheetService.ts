import { getGoogleAccessToken } from './googleCredentials.ts';

const SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const SHEET_NAME = 'Tracking_Colmena';

const HEADERS = [
  'ID',
  'ID de Ruta',
  'Fecha y Hora (ISO)',
  'Tipo de Evento',
  'Latitud',
  'Longitud',
  'Duración (seg)',
  'Notas / Motivo',
  'Fecha Captura'
];

/**
 * Verifica si la pestaña 'Tracking_Colmena' existe en Google Sheets; si no, la crea con sus encabezados.
 */
async function ensureTrackingSheetExists(token: string): Promise<boolean> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta: any = await metaRes.json();
    const titles = (meta.sheets || []).map((s: any) => s.properties?.title);

    if (!titles.includes(SHEET_NAME)) {
      console.log(`[trackingSheetService] Creando pestaña '${SHEET_NAME}' en Google Sheets...`);
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
                    gridProperties: { frozenRowCount: 1 }
                  }
                }
              }
            ]
          })
        }
      );

      if (!addRes.ok) {
        console.error('[trackingSheetService] Error al crear pestaña:', await addRes.text());
        return false;
      }

      // Escribir encabezados
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:I1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${SHEET_NAME}!A1:I1`,
            majorDimension: 'ROWS',
            values: [HEADERS]
          })
        }
      );
    }
    return true;
  } catch (err: any) {
    console.error('[trackingSheetService] Error en ensureTrackingSheetExists:', err.message);
    return false;
  }
}

/**
 * Guarda uno o varios logs de tracking en la pestaña 'Tracking_Colmena' de Google Sheets.
 */
export async function appendTrackingLogsToSheet(logs: any[]): Promise<boolean> {
  if (!logs || logs.length === 0) return true;
  try {
    const token = await getGoogleAccessToken();
    if (!token) {
      console.warn('[trackingSheetService] No se obtuvo token de Google Sheets');
      return false;
    }

    const sheetReady = await ensureTrackingSheetExists(token);
    if (!sheetReady) return false;

    const rows = logs.map(log => [
      log.id || '',
      log.routeId || '',
      log.timestamp || new Date().toISOString(),
      log.type || 'evento',
      log.lat !== undefined ? log.lat : '',
      log.lng !== undefined ? log.lng : '',
      log.duration || 0,
      log.notes || log.reason || '',
      new Date().toISOString()
    ]);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `${SHEET_NAME}!A1`,
          majorDimension: 'ROWS',
          values: rows
        })
      }
    );

    if (!res.ok) {
      console.error('[trackingSheetService] Error en appendTrackingLogsToSheet:', await res.text());
      return false;
    }

    console.log(`[trackingSheetService] ${rows.length} logs guardados exitosamente en Google Sheets (${SHEET_NAME})`);
    return true;
  } catch (err: any) {
    console.error('[trackingSheetService] Error al guardar logs en Google Sheets:', err.message);
    return false;
  }
}

/**
 * Carga los logs históricos de tracking desde Google Sheets para restaurar el estado en caso de reinicio de servidor.
 */
export async function loadTrackingLogsFromSheet(limit = 1000): Promise<any[]> {
  try {
    const token = await getGoogleAccessToken();
    if (!token) return [];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A2:I`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];
    const data: any = await res.json();
    const rows = data.values || [];

    const logs = rows.map((r: any[]) => ({
      id: r[0] || Math.random().toString(36).substr(2, 9),
      routeId: parseInt(r[1], 10) || r[1] || 1,
      timestamp: r[2] || new Date().toISOString(),
      type: r[3] || 'evento',
      lat: parseFloat(r[4]) || 0,
      lng: parseFloat(r[5]) || 0,
      duration: parseInt(r[6], 10) || 0,
      notes: r[7] || ''
    }));

    // Retornar los más recientes limitados
    return logs.slice(-limit);
  } catch (err: any) {
    console.error('[trackingSheetService] Error al cargar logs desde Google Sheets:', err.message);
    return [];
  }
}
