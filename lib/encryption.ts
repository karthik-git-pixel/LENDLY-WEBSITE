import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.KYC_ENCRYPTION_KEY || 'default_32_byte_secret_key_needs_update_in_prod';
const ALGORITHM = 'aes-256-gcm';

// Helper to ensure key is exactly 32 bytes for AES-256
const getKey = () => {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

export function encryptData(text: string): string {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:encryptedData:authTag
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decryptData(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  if (!encryptedData.includes(':')) return encryptedData; // Might not be encrypted yet

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted data format');
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    // Instead of throwing and breaking the whole admin page if decryption fails, return a safe string
    return 'ENCRYPTION_ERROR';
  }
}
