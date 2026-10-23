import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron from 'node-cron';
import { loadLocalCommissions } from './odooSync.ts';
import { encryptPayload } from './cryptoBackup.ts';
import { loadLocalProduction, loadLocalPackaging } from './productionService.ts';
import { getServiceAccountKey, getGoogleAccessToken } from './googleCredentials.ts';

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1mT33WRGF8yEecTOdBwcbApFFmMYJ3gCj';

export { getServiceAccountKey };

export async function getDriveAccessToken(): Promise<string | null> {
  try {
    return await getGoogleAccessToken(['https://www.googleapis.com/auth/drive']);
  } catch (err: any) {
    console.error('Error obtaining Google Drive token:', err.message);
    return null;
  }
}

/**
 * Realiza una copia cifrada y la sube automáticamente a la carpeta de Google Drive
 */
export async function uploadEncryptedBackupToDrive(loadStateFn: () => any, loadPayrollsFn: () => any[]): Promise<{ success: boolean; message: string; fileId?: string; fileName?: string }> {
  try {
    const token = await getDriveAccessToken();
    if (!token) {
      return { success: false, message: 'No se encontraron credenciales de la cuenta de servicio de Google Drive.' };
    }

    const state = loadStateFn();
    const commissions = loadLocalCommissions();
    const payrolls = loadPayrollsFn();

    const bundle = {
      version: 3,
      state,
      commissions,
      payrolls,
      production: loadLocalProduction(),
      packaging: loadLocalPackaging(),
      timestamp: new Date().toISOString()
    };

    const encryptedData = encryptPayload(bundle);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `rutas_trujillos_${dateStr}.enc`;

    const metadata = {
      name: fileName,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
      mimeType: 'text/plain'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/plain\r\n\r\n' +
      encryptedData +
      closeDelimiter;

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    const uploadData: any = await uploadRes.json();

    if (uploadData.id) {
      console.log(`[Google Drive Backup] ¡Respaldo guardado con éxito! Archivo: ${fileName} (ID: ${uploadData.id})`);
      cleanOldBackups(token, GOOGLE_DRIVE_FOLDER_ID).catch(() => {});
      return { success: true, message: `Respaldo cifrado subido con éxito a tu Drive: ${fileName}`, fileId: uploadData.id, fileName };
    } else {
      console.error('[Google Drive Backup] Error en Drive API:', uploadData);
      const errMsg = uploadData.error?.message || 'Error desconocido';
      return { success: false, message: `Error de Google Drive: ${errMsg}` };
    }
  } catch (err: any) {
    console.error('[Google Drive Backup] Excepción:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Limpieza controlada: Mantiene solo los últimos 15 respaldos
 */
async function cleanOldBackups(token: string, folderId: string) {
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&orderBy=createdTime+desc&fields=files(id,name,createdTime)`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const listData: any = await listRes.json();
    if (listData.files && listData.files.length > 15) {
      const filesToDelete = listData.files.slice(15);
      for (const file of filesToDelete) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log(`[Google Drive Backup] Eliminado respaldo antiguo para control de espacio: ${file.name}`);
      }
    }
  } catch (e: any) {
    console.warn('[Google Drive Backup] Aviso limpiando respaldos antiguos:', e.message);
  }
}

/**
 * Programa el respaldo nocturno diario a las 23:59:00
 */
export function startDriveBackupCron(loadStateFn: () => any, loadPayrollsFn: () => any[]) {
  // Todos los días a las 23:59
  cron.schedule('59 23 * * *', async () => {
    console.log('[Google Drive Backup] Iniciando respaldo programado diario...');
    await uploadEncryptedBackupToDrive(loadStateFn, loadPayrollsFn);
  });
  console.log('[Google Drive Backup] Cron diario programado para las 23:59 hrs.');
}
