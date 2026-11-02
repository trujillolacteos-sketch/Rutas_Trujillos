import fs from 'fs';
import path from 'path';
import { getGoogleAccessToken } from './googleCredentials.ts';

const SPREADSHEET_ID = process.env.NEW_SPREADSHEET_ID || '1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE';
const SHEET_NAME = 'Usuarios';

/**
 * Verifica si la pestaña 'Usuarios' existe en Google Sheets; si no, la crea con su fila de encabezados.
 */
async function ensureUsersSheetExists(token: string): Promise<boolean> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta: any = await metaRes.json();
    const titles = (meta.sheets || []).map((s: any) => s.properties?.title);

    if (!titles.includes(SHEET_NAME)) {
      console.log(`[usersSheetService] Creando pestaña "${SHEET_NAME}" en Google Sheets...`);
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
                    gridProperties: { rowCount: 150, columnCount: 10 }
                  }
                }
              }
            ]
          })
        }
      );
      if (!addRes.ok) {
        console.error('[usersSheetService] Error al crear pestaña en Google Sheets:', await addRes.text());
        return false;
      }
    }

    // Encabezados
    const header = [
      'ID',
      'Usuario',
      'Rol Base',
      'Contraseña',
      'Menús Temporales (separados por coma)',
      'Válido Hasta (YYYY-MM-DD)',
      'Última Actualización'
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!A1:G1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [header] })
      }
    );

    return true;
  } catch (err: any) {
    console.error('[usersSheetService] Error en ensureUsersSheetExists:', err.message);
    return false;
  }
}

/**
 * Obtiene todos los usuarios almacenados en la pestaña 'Usuarios' de Google Sheets.
 */
export async function getGoogleSheetUsers(): Promise<any[]> {
  try {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (!token) return [];

    await ensureUsersSheetExists(token);

    const range = encodeURIComponent(`'${SHEET_NAME}'!A2:G150`);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      console.error('[usersSheetService] Error al leer usuarios desde Sheet:', await res.text());
      return [];
    }

    const data: any = await res.json();
    const rows = data.values || [];

    const users = rows
      .map((row: any[]) => {
        const username = row[1] ? String(row[1]).trim() : '';
        if (!username) return null;

        const extraMenusRaw = row[4] ? String(row[4]).trim() : '';
        const extraMenus = extraMenusRaw
          ? extraMenusRaw.split(',').map(m => m.trim()).filter(Boolean)
          : [];

        const expiresAtRaw = row[5] ? String(row[5]).trim() : '';
        const extraMenusExpiresAt = expiresAtRaw || null;

        return {
          id: Number(row[0]) || Date.now(),
          username,
          role: row[2] ? String(row[2]).trim() : 'operator',
          password: row[3] ? String(row[3]).trim() : '',
          extraMenus,
          extraMenusExpiresAt
        };
      })
      .filter(Boolean);

    return users;
  } catch (err: any) {
    console.error('[usersSheetService] Excepción en getGoogleSheetUsers:', err.message);
    return [];
  }
}

/**
 * Guarda y actualiza la lista completa de usuarios en la pestaña 'Usuarios' de Google Sheets.
 */
export async function saveUsersToGoogleSheet(users: any[]): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (!Array.isArray(users) || users.length === 0) {
      return { success: false, message: 'No hay usuarios para sincronizar.' };
    }

    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
    if (!token) {
      return { success: false, message: 'No se obtuvo token de Google Sheets.' };
    }

    await ensureUsersSheetExists(token);

    // 1. Limpiar el rango A2:G150 para no dejar usuarios eliminados
    const clearRange = encodeURIComponent(`'${SHEET_NAME}'!A2:G150`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${clearRange}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 2. Mapear usuarios a filas
    const nowStr = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const rows = users.map(u => [
      u.id || '',
      u.username || '',
      u.role || '',
      u.password || '',
      Array.isArray(u.extraMenus) ? u.extraMenus.join(', ') : '',
      u.extraMenusExpiresAt || '',
      nowStr
    ]);

    // 3. Escribir las filas
    const writeRange = encodeURIComponent(`'${SHEET_NAME}'!A2:G${rows.length + 1}`);
    const putRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${writeRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      }
    );

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error('[usersSheetService] Error al escribir en Google Sheet:', errText);
      return { success: false, message: errText };
    }

    console.log(`[usersSheetService] ¡${users.length} usuarios sincronizados en Google Sheets con éxito!`);
    return { success: true, message: `¡${users.length} usuarios sincronizados en Google Sheets!`, count: users.length };
  } catch (err: any) {
    console.error('[usersSheetService] Excepción en saveUsersToGoogleSheet:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Sincronización bidireccional automática al arrancar el servidor en Render:
 * - Si Google Sheets ya tiene usuarios guardados, los restaura como la fuente de la verdad.
 * - Si Google Sheets está vacío, sube los usuarios del archivo local a la hoja.
 */
export async function initUsersSyncOnStartup(state: any, saveStateFn: (s: any) => void): Promise<any[]> {
  try {
    console.log('[usersSheetService] Verificando usuarios en Google Sheets...');
    const sheetUsers = await getGoogleSheetUsers();

    if (sheetUsers && sheetUsers.length > 0) {
      console.log(`[usersSheetService] ¡RESTAURACIÓN EXITOSA! Se cargaron ${sheetUsers.length} usuarios directamente desde Google Sheets.`);
      state.users = sheetUsers;
      saveStateFn(state);
      return sheetUsers;
    } else {
      console.log('[usersSheetService] Google Sheets sin usuarios registrados. Inicializando con usuarios actuales...');
      if (state.users && state.users.length > 0) {
        await saveUsersToGoogleSheet(state.users);
      }
      return state.users || [];
    }
  } catch (err: any) {
    console.warn('[usersSheetService] Aviso durante inicio (continuando con local):', err.message);
    return state.users || [];
  }
}
