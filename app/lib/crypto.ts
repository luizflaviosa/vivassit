import crypto from 'crypto';

// AES-256-GCM para criptografar API keys de subcontas Asaas (e outros segredos
// por tenant). Chave mestra mora em env ENCRYPTION_KEY (64 hex chars = 32 bytes).
//
// Formato armazenado: base64(iv (12 bytes) + ciphertext + authTag (16 bytes))

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'ENCRYPTION_KEY nao configurada. Gere com: openssl rand -hex 32'
    );
  }
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY precisa ter 64 caracteres hex (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

export function decryptString(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// Identificador da chave mestra atual (pra rotacao futura)
export const ENCRYPTION_KEY_ID = process.env.ENCRYPTION_KEY_ID ?? 'k1';
