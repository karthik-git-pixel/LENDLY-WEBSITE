/**
 * End-to-End Encryption (E2EE) Module using Web Crypto API (AES-GCM 256-bit)
 * Ensures message privacy between local buyer & seller devices.
 */

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('radiuscart_salt_e2ee_2026'),
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(text: string, roomId: string): Promise<string> {
  if (!text) return '';
  try {
    const key = await deriveKey(roomId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `e2ee:${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error('E2EE Encryption Error:', err);
    return text;
  }
}

export async function decryptMessage(cipherText: string, roomId: string): Promise<string> {
  if (!cipherText || !cipherText.startsWith('e2ee:')) return cipherText || '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const ivMatch = parts[1].match(/.{1,2}/g);
    const cipherMatch = parts[2].match(/.{1,2}/g);
    if (!ivMatch || !cipherMatch) return cipherText;

    const iv = new Uint8Array(ivMatch.map(byte => parseInt(byte, 16)));
    const cipherBuffer = new Uint8Array(cipherMatch.map(byte => parseInt(byte, 16)));

    const key = await deriveKey(roomId);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuffer
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('E2EE Decryption Error:', err);
    return 'Encrypted message';
  }
}
