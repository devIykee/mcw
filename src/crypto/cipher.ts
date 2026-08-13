import crypto from 'crypto';
import { SECURITY_CONFIG } from '../config/security.js';

export interface EncryptedPayload {
  version: number;
  kdf: 'scrypt';
  kdfParams: {
    N: number;
    r: number;
    p: number;
    keyLength: number;
  };
  salt: string;       // Hex encoded 32 bytes
  iv: string;         // Hex encoded 12 bytes
  authTag: string;    // Hex encoded 16 bytes
  ciphertext: string; // Hex encoded
}

/**
 * Encrypts a string (e.g., mnemonic / seed phrase) using AES-256-GCM with Scrypt key derivation.
 */
export function encryptData(plaintext: string, password: string): EncryptedPayload {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // 1. Generate cryptographic salt
  const salt = crypto.randomBytes(SECURITY_CONFIG.SALT_LENGTH);

  // 2. Derive key via memory-hard Scrypt
  const key = crypto.scryptSync(
    password,
    salt,
    SECURITY_CONFIG.KEY_LENGTH,
    {
      N: SECURITY_CONFIG.SCRYPT_N,
      r: SECURITY_CONFIG.SCRYPT_R,
      p: SECURITY_CONFIG.SCRYPT_P,
      maxmem: SECURITY_CONFIG.MAX_MEM,
    }
  );

  // 3. Generate initialization vector (IV / Nonce)
  const iv = crypto.randomBytes(SECURITY_CONFIG.IV_LENGTH);

  // 4. Create AES-256-GCM cipher
  const cipher = crypto.createCipheriv(
    SECURITY_CONFIG.CIPHER_ALGORITHM,
    key,
    iv
  ) as crypto.CipherGCM;

  // 5. Encrypt data
  const ciphertextBuffer = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final()
  ]);

  // 6. Retrieve authentication tag (for integrity and authenticity verification)
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: 'scrypt',
    kdfParams: {
      N: SECURITY_CONFIG.SCRYPT_N,
      r: SECURITY_CONFIG.SCRYPT_R,
      p: SECURITY_CONFIG.SCRYPT_P,
      keyLength: SECURITY_CONFIG.KEY_LENGTH
    },
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertextBuffer.toString('hex')
  };
}

/**
 * Decrypts an EncryptedPayload using the provided password.
 * Throws an error if the password is incorrect or the payload has been tampered with.
 */
export function decryptData(payload: EncryptedPayload, password: string): string {
  try {
    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');

    // 1. Re-derive key using same Scrypt parameters
    const key = crypto.scryptSync(
      password,
      salt,
      payload.kdfParams.keyLength || SECURITY_CONFIG.KEY_LENGTH,
      {
        N: payload.kdfParams.N || SECURITY_CONFIG.SCRYPT_N,
        r: payload.kdfParams.r || SECURITY_CONFIG.SCRYPT_R,
        p: payload.kdfParams.p || SECURITY_CONFIG.SCRYPT_P,
        maxmem: SECURITY_CONFIG.MAX_MEM,
      }
    );

    // 2. Initialize decipher
    const decipher = crypto.createDecipheriv(
      SECURITY_CONFIG.CIPHER_ALGORITHM,
      key,
      iv
    ) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    // 3. Decrypt and verify authentication tag
    const decryptedBuffer = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return decryptedBuffer.toString('utf8');
  } catch (error: any) {
    throw new Error('Decryption failed. Incorrect password or corrupted vault file.');
  }
}
