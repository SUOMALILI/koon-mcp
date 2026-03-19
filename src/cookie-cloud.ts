import https from 'https';
import http from 'http';
import crypto from 'crypto';

interface Cookie {
  name: string;
  value: string;
}

interface CookieData {
  cookie_data?: Record<string, Cookie[]>;
  local_storage_data?: Record<string, unknown>;
}

export interface CookieCloudConfig {
  url: string;
  uuid: string;
  password: string;
}

/**
 * Get CookieCloud configuration from environment variables.
 * Priority: CLAUDE_* (from settings.json) > * (from .mcp.json or system env)
 */
export function getCookieCloudConfig(): CookieCloudConfig {
  return {
    url: process.env.CLAUDE_COOKIE_CLOUD_URL || process.env.COOKIE_CLOUD_URL || '',
    uuid: process.env.CLAUDE_COOKIE_CLOUD_UUID || process.env.COOKIE_CLOUD_UUID || '',
    password: process.env.CLAUDE_COOKIE_CLOUD_PASSWORD || process.env.COOKIE_CLOUD_PASSWORD || '',
  };
}

/**
 * Check if CookieCloud is properly configured
 */
export function isCookieCloudEnabled(): boolean {
  const config = getCookieCloudConfig();
  return !!(config.url && config.uuid && config.password);
}

/**
 * Decrypt CookieCloud encrypted data
 */
function decryptCookieData(uuid: string, password: string, encrypted: string, cryptoType: string = 'legacy'): CookieData {
  // Derive base key: MD5(uuid + '-' + password), take first 16 hex chars as ASCII key
  const key = crypto.createHash('md5').update(`${uuid}-${password}`).digest('hex').substring(0, 16);

  const raw = Buffer.from(encrypted, 'base64');

  if (cryptoType === 'aes-128-cbc-fixed') {
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    let pt = decipher.update(raw);
    pt = Buffer.concat([pt, decipher.final()]);
    return JSON.parse(pt.toString('utf-8'));
  } else {
    // legacy: "Salted__" (8 bytes) + salt (8 bytes) + ciphertext
    if (raw.subarray(0, 8).toString() !== 'Salted__') {
      throw new Error("Invalid ciphertext: missing 'Salted__' header");
    }
    const salt = raw.subarray(8, 16);
    const ct = raw.subarray(16);

    // OpenSSL EVP_BytesToKey with MD5, key=32 bytes, iv=16 bytes
    let keyIv = Buffer.alloc(0);
    let prev = Buffer.alloc(0);
    while (keyIv.length < 48) {
      prev = crypto.createHash('md5').update(Buffer.concat([prev, Buffer.from(key), salt])).digest();
      keyIv = Buffer.concat([keyIv, prev]);
    }
    const _key = keyIv.subarray(0, 32);
    const _iv = keyIv.subarray(32, 48);

    const decipher = crypto.createDecipheriv('aes-256-cbc', _key, _iv);
    let pt = decipher.update(ct);
    pt = Buffer.concat([pt, decipher.final()]);
    return JSON.parse(pt.toString('utf-8'));
  }
}

/**
 * Fetch and decrypt cookie data from a CookieCloud server.
 * Uses configuration from environment variables (with CLAUDE_* prefix priority).
 */
export async function fetchCookies(): Promise<CookieData | null> {
  const config = getCookieCloudConfig();

  if (!isCookieCloudEnabled()) {
    return null;
  }

  const url = `${config.url.replace(/\/$/, '')}/get/${config.uuid}`;

  try {
    const response = await new Promise<{ status: number | undefined; data: string }>((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, (res: http.IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer) => data += chunk.toString());
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = JSON.parse(response.data);
    if (!data.encrypted) {
      throw new Error('No encrypted field in response');
    }

    const cryptoType = data.crypto_type || 'legacy';
    return decryptCookieData(config.uuid, config.password, data.encrypted, cryptoType);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[koon-mcp] Failed to fetch or decrypt cookies:', msg);
    return null;
  }
}

/**
 * Get cookie string for a specific domain
 */
export function getCookiesForDomain(cookieData: CookieData | null, domain: string): string {
  if (!cookieData || !cookieData.cookie_data) {
    return '';
  }

  const cookies = cookieData.cookie_data;
  const result: string[] = [];

  // Handle both single domain keys and comma-separated domain keys
  for (const [key, cookieList] of Object.entries(cookies)) {
    // Check if this key contains our domain (handles comma-separated keys like "acm.org,ieee.org")
    const domainsInKey = key.split(',').map(d => d.trim());
    const domainMatch = domainsInKey.some(d => {
      // Exact match or subdomain match
      return domain === d || domain.endsWith('.' + d) || d === domain;
    });

    if (domainMatch && Array.isArray(cookieList)) {
      result.push(...cookieList.map((c: Cookie) => `${c.name}=${c.value}`));
    }
  }

  // Try exact match first
  if (cookies[domain] && Array.isArray(cookies[domain])) {
    for (const c of cookies[domain]) {
      result.push(`${c.name}=${c.value}`);
    }
  }

  // Try with leading dot
  if (cookies[`.${domain}`] && Array.isArray(cookies[`.${domain}`])) {
    for (const c of cookies[`.${domain}`]) {
      result.push(`${c.name}=${c.value}`);
    }
  }

  // Try parent domains
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (cookies[`.${parentDomain}`] && Array.isArray(cookies[`.${parentDomain}`])) {
      for (const c of cookies[`.${parentDomain}`]) {
        result.push(`${c.name}=${c.value}`);
      }
    }
  }

  return result.join('; ');
}
