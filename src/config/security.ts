import path from 'path';
import os from 'os';

/**
 * Security, Vault, and Approval Parameters
 */
export const SECURITY_CONFIG = {
  // Vault storage location
  VAULT_DIR: path.join(os.homedir(), '.mc-twaf'),
  VAULT_FILENAME: 'vault.dat',
  
  // Encryption parameters (AES-256-GCM + Scrypt)
  CIPHER_ALGORITHM: 'aes-256-gcm',
  SCRYPT_N: 16384, // CPU/memory cost parameter (2^14)
  SCRYPT_R: 8,     // Block size
  SCRYPT_P: 1,     // Parallelization parameter
  MAX_MEM: 64 * 1024 * 1024, // 64 MB max memory
  KEY_LENGTH: 32,  // 256 bits for AES-256
  SALT_LENGTH: 32, // 256 bits salt
  IV_LENGTH: 12,   // 96 bits standard GCM IV (nonce)
  AUTH_TAG_LENGTH: 16, // 128 bits GCM auth tag

  // MCP Agent Human-in-the-loop Guard Settings
  APPROVAL_TIMEOUT_MS: 120000, // 2 minutes to approve pending agent transaction
  SESSION_DURATION_MS: 300000, // 5 minutes session window if unlocked headlessly for testing
};

export function getVaultFilePath(): string {
  return path.join(SECURITY_CONFIG.VAULT_DIR, SECURITY_CONFIG.VAULT_FILENAME);
}
