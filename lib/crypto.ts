import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex chars');
  }
  return Buffer.from(key, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv(12 bytes hex):tag(16 bytes hex):ciphertext hex
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(':');
  const ivHex = parts[0];
  const tagHex = parts[1];
  const ctHex = parts[2];

  if (!ivHex || !tagHex || !ctHex) {
    throw new Error('Invalid encrypted secret format');
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8');
}
