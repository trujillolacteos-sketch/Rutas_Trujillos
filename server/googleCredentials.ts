import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ServiceAccountKey {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
  [key: string]: any;
}

// Fallback embedded service account credentials for Sustained Truck / Lacteos Trujillos
const FALLBACK_SERVICE_ACCOUNT: ServiceAccountKey = {
  type: "service_account",
  project_id: "sustained-truck-462415-n9",
  private_key_id: "523ef9eb192b5c6f57f93cbbb312b48867988c46",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDO+IJsUIrQ88V5\nzv+lFLQsiWOozNJehsmxrApN9Kem07g69C3+GzSyyalBC2LqR0d+sAcr1QBZGfeD\nKo9dFQvJdzJZ2epYFIPiu3lJx6jmGQcRVun+PiPURnuhHiGMrWAvKIAdrUOqIIG5\nnOqQFEBjVmzW5rts/C4MpK8XSD2xIn8gQ9a74gntvpQuYCoDukefTjELB3jaiuVp\nzh4DubcLQGITRHti9r90dwhSo9j/MOLpn5oRkBpy7gbp9r144Jd8Ye3TABj4eqy1\ngJctyi9MIgrvnfELLr/4rMBTiUWuhcWgml0Wpt4F7x4nYATRRSH1QG8ccKRT4VkV\nic2bKjmBAgMBAAECggEADRMwSL/FJ+fL07hKzcwjM7sRiNeOT1AW4XqxA0q6Op+e\nawRY/CK42gtDqNXGJRm6qltcIJ3p/IxXkWQ4vqnL3v7WN0yScYezleO/s58BjFkM\nFBbYXRTiNjtQ/RUxC7jk3iXMriiaITRrguUnAPzJMogCWTMl/P++DajBB5NV6QuG\nkcSEYM0I+3Xa/7oN5VMedtNxE782M0tG+7gaNnR0Be2WvaKXA7dUvx4nC01d6AHl\nJjNqg59jdsYADidrvsP8eiqkztIyaLDR3jKpwddRGQGWs6pUGJdXOGNnAtk2Pib2\ndVP/mSFuNowDzhJAE0J0YYiGqsI1OQqMcAsVue0yPwKBgQDxWWGeSxa99KxFtecd\ncktCPBRMij8xEjj/PEuljxv5uYmnIyhEJ3LhdgoGHxSZMAi2M2WprUe5loNNk6Pa\nokckoDi3vbCAOEdircHWJNTZF2EdNFBvWSM16/Q973Hw2+Vv2BxefkvmPdbkffNH\nuR/SQerxQHHBAMBEx2aupPSdkwKBgQDbiOFTPwtZTFxSzdx9cR/4UDKXijb0c5bQ\n1dCCIP8923YIKgRpN09HwKPYPXK16yNx7Z/4oj7kVECAoGbIMn1sVmM2YmAfc4Cu\nIHygS0Ua/bXji1wIFbF6/+8tGNtwr+JIoswS6OGOwlxn00hPTwqhw6nm+pm9f49s\nDR49dITZGwKBgG/wALKmKPoZTP1YDMU/iWBC9Tc6t2xPA1h94qf65ALC5vE6ASb7\nFPE1ChkkuS0DdkbrN6+myqltAaEtZMW2lkCKf0PZGs+dSp6d8FUd6Ap4KXaeGOBL\n+2S69yDyuWn400U4eo/pC9LRw6VeNUOCvRuLrygNt7TIYGSGBz3hDAM5AoGBALSN\noyPgGelbkCLaBJl2zKBg9PsFRaVO257t+wrLMKEjObQFOpN+Vcnhed+CyjEsLn6o\nvIS0i50mXdZsFZxZSiYr9nTn+75iNFcBiP4cab2FJG78UrijftB2ZbNlWjUXsrei\njMyQk9HhsDYD4ti3XTslvTqmqILdwotPTqukhQ45AoGAWILMAzci33ne2RQpInuz\ndkSnXu0NvpBz09TjvjIFiTc9jDJ+/0uAcz+8MuXA/X4cr/9dUIMnLAcXf9BpbsWP\nafMT3u/hMR7EmTCi69Ja6tXMi0Of2Kzag0bM89SJh2KMiFmBtZgIDSwBwKDuft2U\nvQxvXvUHoSqZ4RBa8RLoBRI=\n-----END PRIVATE KEY-----\n",
  client_email: "drive-backup-bot@sustained-truck-462415-n9.iam.gserviceaccount.com",
  client_id: "100734963706735945814",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/drive-backup-bot%40sustained-truck-462415-n9.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

const KEY_FILE = 'google-drive-key.json';

let _cachedToken: string | null = null;
let _cachedScopes: string = '';
let _tokenExpiresAt = 0;

export function getServiceAccountKey(): ServiceAccountKey {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn('[GoogleAuth] Error parsing GOOGLE_SERVICE_ACCOUNT_KEY env var:', e);
    }
  }

  const resolvedPath = path.resolve(process.cwd(), KEY_FILE);
  if (fs.existsSync(resolvedPath)) {
    try {
      return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    } catch (e) {
      console.warn('[GoogleAuth] Error reading google-drive-key.json:', e);
    }
  }

  return FALLBACK_SERVICE_ACCOUNT;
}

export async function getGoogleAccessToken(
  scopes: string[] = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
): Promise<string> {
  const scopeStr = scopes.sort().join(' ');

  // Return cached token if valid for at least another 60 seconds and with matching scopes
  if (_cachedToken && _cachedScopes === scopeStr && Date.now() < _tokenExpiresAt - 60000) {
    return _cachedToken;
  }

  const key = getServiceAccountKey();
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: scopeStr,
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
    _cachedScopes = scopeStr;
    _tokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
    return data.access_token;
  }

  throw new Error(`[GoogleAuth] Error obteniendo access token de Google: ${JSON.stringify(data)}`);
}
