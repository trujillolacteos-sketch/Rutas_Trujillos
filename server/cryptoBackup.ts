import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Default master encryption key for Lácteos Trujillos database
const DEFAULT_SECRET = process.env.BACKUP_SECRET_KEY || 'LacteosTrujillos_Seguridad_AES256_2026!';
const ENCRYPTED_BACKUP_FILE = 'data_store.encrypted.enc';

/**
 * Candado 1: Cifrado Grado Militar AES-256-GCM
 * Genera un archivo protegido con Salt, IV, AuthTag y texto cifrado.
 */
export function encryptPayload(data: any, customPassphrase?: string): string {
  const secret = customPassphrase || DEFAULT_SECRET;
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secret, salt, 32);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Paquete seguro serializado: salt.iv.authTag.encrypted
  return `${salt.toString('hex')}.${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
}

/**
 * Descifra el payload validando la integridad criptográfica
 */
export function decryptPayload(packedString: string, customPassphrase?: string): any {
  const secret = customPassphrase || DEFAULT_SECRET;
  const parts = packedString.trim().split('.');
  if (parts.length !== 4) {
    throw new Error('Formato de respaldo cifrado inválido.');
  }

  const [saltHex, ivHex, tagHex, encryptedHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const key = crypto.scryptSync(secret, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Guarda una copia local cifrada automáticamente
 */
export function saveLocalEncryptedBackup(state: any): void {
  try {
    const encryptedData = encryptPayload(state);
    fs.writeFileSync(ENCRYPTED_BACKUP_FILE, encryptedData, 'utf8');
  } catch (err: any) {
    console.warn('Notice: could not save local encrypted backup:', err.message);
  }
}

/**
 * Lee la copia local cifrada si fuera necesario
 */
export function loadLocalEncryptedBackup(): any | null {
  try {
    if (fs.existsSync(ENCRYPTED_BACKUP_FILE)) {
      const encryptedData = fs.readFileSync(ENCRYPTED_BACKUP_FILE, 'utf8');
      return decryptPayload(encryptedData);
    }
  } catch (err: any) {
    console.error('Error loading encrypted backup:', err.message);
  }
  return null;
}
