import path from 'path';
import os from 'os';
import fs from 'fs';

const NEW_VAULT_DIR = path.join(os.homedir(), '.mcw');
const LEGACY_VAULT_DIR = path.join(os.homedir(), '.mc-twaf');

export const SECURITY_CONFIG = {
  VAULT_DIR: fs.existsSync(NEW_VAULT_DIR) || !fs.existsSync(LEGACY_VAULT_DIR) ? NEW_VAULT_DIR : LEGACY_VAULT_DIR,
  VAULT_FILENAME: 'vault.dat',
  
  // Encryption parameters (AES-256-GCM + Scrypt)
  CIPHER_ALGORITHM: 'aes-256-gcm',
  SCRYPT_N: 16384, // CPU/memory cost parameter
  SCRYPT_R: 8,     // Block size
  SCRYPT_P: 1,     // Parallelization parameter
  MAX_MEM: 64 * 1024 * 1024, // 64 MB max memory
  KEY_LENGTH: 32,  // 256 bits for AES-256
  SALT_LENGTH: 32, // 256 bits salt
  IV_LENGTH: 12,   // 96 bits standard GCM IV (nonce)
  AUTH_TAG_LENGTH: 16, // 128 bits GCM auth tag

  // MCP Agent Human-in-the-loop Guard Settings
  APPROVAL_TIMEOUT_MS: 120000,
  SESSION_DURATION_MS: 300000,
};

export function getVaultFilePath(): string {
  // If legacy exists and new doesn't, read from legacy
  const newPath = path.join(NEW_VAULT_DIR, SECURITY_CONFIG.VAULT_FILENAME);
  const legacyPath = path.join(LEGACY_VAULT_DIR, SECURITY_CONFIG.VAULT_FILENAME);

  if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
    return legacyPath;
  }
  return newPath;
}
