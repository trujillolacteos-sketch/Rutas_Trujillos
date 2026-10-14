import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron from 'node-cron';
import { loadLocalCommissions } from './odooSync.ts';
import { encryptPayload } from './cryptoBackup.ts';
import { loadLocalProduction, loadLocalPackaging } from './productionService.ts';

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1mT33WRGF8yEecTOdBwcbApFFmMYJ3gCj';
const KEY_FILE = 'google-drive-key.json';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

export function getServiceAccountKey(): ServiceAccountKey | null {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY env var:', e);
    }
  }

  if (fs.existsSync(KEY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    } catch (e) {
      console.warn('Error reading google-drive-key.json:', e);
    }
  }

  return null;
}

export async function getDriveAccessToken(): Promise<string | null> {
  const key = getServiceAccountKey();
  if (!key) return null;

  if (_cachedToken && Date.now() < _tokenExpiresAt - 60000) {
    return _cachedToken;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claim}`);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const data: any = await res.json();
    if (data.access_token) {
      _cachedToken = data.access_token;
      _tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      return data.access_token;
    } else {
      console.error('Error obtaining Google Drive token:', data);
    }
  } catch (err: any) {
    console.error('Error signing Service Account JWT for Google Drive:', err.message);
  }

  return null;
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
