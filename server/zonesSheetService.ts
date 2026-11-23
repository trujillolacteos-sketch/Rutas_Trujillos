import { getGoogleAccessToken } from './googleCredentials.ts';

const SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const SHEET_NAME = 'Predisposicion_Zonas';

export const ZONES_HEADERS = [
  'Zona / Municipio',
  'ID Ruta Asignada',
  'Ruta Asignada',
  'Días de Visita Asignados',
  'Frecuencia (Días/Sem)',
  'Estatus Zona',
  'Clientes Registrados',
  'Última Actualización'
];

/**
 * Normaliza nombres de zona para comparaciones uniformes
 */
export function normalizeZoneName(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica o crea la pestaña 'Predisposicion_Zonas' en Google Sheets con encabezados formateados.
 */
async function ensureZonesSheetExists(token: string): Promise<{ exists: boolean; sheetId?: number }> {
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

    console.log(`[zonesSheetService] Creando pestaña '${SHEET_NAME}' en Google Sheets...`);
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
                  gridProperties: { rowCount: 100, columnCount: 10, frozenRowCount: 1 }
                }
              }
            }
          ]
        })
      }
    );

    if (!addRes.ok) {
      console.error('[zonesSheetService] Error creando pestaña:', await addRes.text());
      return { exists: false };
    }

    const addData = await addRes.json();
    const newSheetId = addData?.replies?.[0]?.addSheet?.properties?.sheetId;

    // Escribir fila de encabezados
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:H1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [ZONES_HEADERS] })
      }
    );

    // Formatear encabezados (fondo verde esmeralda, texto blanco negrita)
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
                    endColumnIndex: ZONES_HEADERS.length
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.05, green: 0.45, blue: 0.35 },
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
    console.error('[zonesSheetService] Error en ensureZonesSheetExists:', err.message);
    return { exists: false };
  }
}

/**
 * Guarda las predisposiciones de todas las zonas (rutas asignadas, días asignados y estatus) en Google Sheets.
 */
export async function saveZonesToGoogleSheet(state: any): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const clients = state?.clients || [];
    const routes = state?.routes || [];
    const zoneOverrides = state?.zoneOverrides || {};
    const disabledZones = new Set((state?.disabledZones || []).map((z: string) => (z || '').toLowerCase().trim()));

    const token = await getGoogleAccessToken();
    if (!token) {
      return { success: false, count: 0, error: 'Token de Google Sheets no disponible.' };
    }

    const sheetCheck = await ensureZonesSheetExists(token);
    if (!sheetCheck.exists) {
      return { success: false, count: 0, error: 'No se pudo crear o verificar la pestaña en Google Sheets.' };
    }

    // Recolectar todas las zonas conocidas
    const allZonesMap = new Map<string, { originalName: string; clientCount: number }>();

    // Zonas desde el catálogo de clientes
    clients.forEach((c: any) => {
      const orig = (c.city || 'Desconocida').trim();
      const lower = orig.toLowerCase();
      if (!allZonesMap.has(lower)) {
        allZonesMap.set(lower, { originalName: orig, clientCount: 0 });
      }
      allZonesMap.get(lower)!.clientCount += 1;
    });

    // Zonas desde zoneOverrides
    Object.keys(zoneOverrides).forEach((zKey) => {
      const lower = zKey.toLowerCase().trim();
      if (!allZonesMap.has(lower)) {
        allZonesMap.set(lower, { originalName: zKey, clientCount: 0 });
      }
    });

    // Zonas estándar indispensables
    const standardZones = [
      'Zona Metropolitana AGS',
      'Encarnación de Díaz',
      'San Juan de los Lagos',
      'Arandas',
      'Yahualica',
      'Lagos de Moreno',
      'Jalostotitlán',
      'Valle de Guadalupe',
      'San Miguel el Alto',
      'Tepatitlán',
      'Cuquio',
      'Zacatecas',
      'Guadalajara'
    ];
    standardZones.forEach((z) => {
      const lower = z.toLowerCase().trim();
      if (!allZonesMap.has(lower)) {
        allZonesMap.set(lower, { originalName: z, clientCount: 0 });
      }
    });

    // Mapa de rutas por ID
    const routeMap = new Map<number, string>();
    routes.forEach((r: any) => routeMap.set(r.id, r.name));

    const nowStr = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

    // Construir filas ordenadas alfabéticamente
    const sortedKeys = Array.from(allZonesMap.keys()).sort();
    const rows: any[][] = [];

    for (const key of sortedKeys) {
      const info = allZonesMap.get(key)!;
      const override = zoneOverrides[key] || zoneOverrides[info.originalName] || {};

      const rId = override.assignedRouteId;
      const routeName = rId ? (routeMap.get(rId) || `Ruta ${rId}`) : '⚡ Automático';
      
      const daysList: string[] = Array.isArray(override.assignedDays) && override.assignedDays.length > 0
        ? override.assignedDays
        : (override.assignedDay ? [override.assignedDay] : []);
      
      const daysStr = daysList.length > 0 ? daysList.join(', ') : 'Cualquiera / Auto';
      const freqStr = daysList.length > 0 ? `${daysList.length} día${daysList.length > 1 ? 's' : ''}/sem` : 'Auto';
      const isDisabled = disabledZones.has(key) || disabledZones.has(info.originalName.toLowerCase());
      const statusStr = isDisabled ? '❌ Deshabilitada' : '✅ Activa';

      rows.push([
        info.originalName,        // Zona / Municipio
        rId ? rId : '',           // ID Ruta Asignada
        routeName,                // Ruta Asignada
        daysStr,                  // Días de Visita Asignados
        freqStr,                  // Frecuencia (Días/Sem)
        statusStr,                // Estatus Zona
        info.clientCount,         // Clientes Registrados
        nowStr                    // Última Actualización
      ]);
    }

    // 1. Limpiar datos previos
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:H200:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    ).catch(() => {});

    // 2. Reescribir encabezados
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:H1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [ZONES_HEADERS] })
      }
    );

    // 3. Escribir filas
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:H${rows.length + 1}?valueInputOption=USER_ENTERED`,
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
      const err = await writeRes.text();
      console.error('[zonesSheetService] Error al guardar zonas en Google Sheets:', err);
      return { success: false, count: 0, error: err };
    }

    console.log(`[zonesSheetService] ✅ Predisposiciones de ${rows.length} zonas respaldadas exitosamente en Google Sheets.`);
    return { success: true, count: rows.length };
  } catch (err: any) {
    console.error('[zonesSheetService] Error en saveZonesToGoogleSheet:', err.message);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Lee y recupera las predisposiciones de zonas desde la pestaña 'Predisposicion_Zonas' de Google Sheets.
 */
export async function loadZonesFromGoogleSheet(): Promise<{
  zoneOverrides: Record<string, { assignedRouteId?: number; assignedDay?: string; assignedDays?: string[]; visitFrequency?: number }>;
  disabledZones: string[];
} | null> {
  try {
    const token = await getGoogleAccessToken();
    if (!token) return null;

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A2:F200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;

    const data: any = await res.json();
    const rows = data.values || [];
    if (rows.length === 0) return null;

    const zoneOverrides: Record<string, { assignedRouteId?: number; assignedDay?: string; assignedDays?: string[]; visitFrequency?: number }> = {};
    const disabledZones: string[] = [];

    for (const r of rows) {
      const zoneName = (r[0] || '').trim();
      if (!zoneName) continue;

      const lowerZone = zoneName.toLowerCase();
      const rIdRaw = r[1] ? parseInt(r[1], 10) : NaN;
      const daysRaw = (r[3] || '').trim();
      const statusRaw = (r[5] || '').trim();

      const override: { assignedRouteId?: number; assignedDay?: string; assignedDays?: string[]; visitFrequency?: number } = {};
      if (!isNaN(rIdRaw) && rIdRaw > 0) {
        override.assignedRouteId = rIdRaw;
      }
      if (daysRaw && !daysRaw.toLowerCase().includes('auto') && !daysRaw.toLowerCase().includes('cualquiera')) {
        const days = daysRaw.split(',').map((d: string) => d.trim()).filter(Boolean);
        if (days.length > 0) {
          override.assignedDays = days;
          override.assignedDay = days[0];
          override.visitFrequency = days.length;
        }
      }

      if (override.assignedRouteId !== undefined || override.assignedDay !== undefined || override.assignedDays !== undefined) {
        zoneOverrides[lowerZone] = override;
      }

      if (statusRaw.includes('Deshabilitada') || statusRaw.includes('❌')) {
        disabledZones.push(lowerZone);
      }
    }

    console.log(`[zonesSheetService] Se leyeron ${Object.keys(zoneOverrides).length} predisposiciones de zona desde Google Sheets.`);
    return { zoneOverrides, disabledZones };
  } catch (err: any) {
    console.error('[zonesSheetService] Error leyendo zonas de Google Sheets:', err.message);
    return null;
  }
}
