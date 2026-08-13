import fs from 'fs';
import path from 'path';
import { EncryptedPayload, encryptData, decryptData } from './cipher.js';
import { SECURITY_CONFIG, getVaultFilePath } from '../config/security.js';
import { SupportedChain, NetworkMode, getNetworkMode } from '../config/chains.js';

export interface WalletVaultFile {
  createdAt: string;
  updatedAt: string;
  vault: EncryptedPayload;
  metadata: {
    btcAddress: string;          // Testnet tb1q...
    btcMainnetAddress?: string;  // Mainnet bc1q...
    ethAddress: string;
    solAddress: string;
    trxAddress: string;
  };
}

export function ensureVaultDirectory(): void {
  if (!fs.existsSync(SECURITY_CONFIG.VAULT_DIR)) {
    fs.mkdirSync(SECURITY_CONFIG.VAULT_DIR, { recursive: true, mode: 0o700 });
  }
}

export function walletExists(): boolean {
  return fs.existsSync(getVaultFilePath());
}

export function saveVaultFile(vaultFile: WalletVaultFile): void {
  ensureVaultDirectory();
  const filePath = getVaultFilePath();
  fs.writeFileSync(filePath, JSON.stringify(vaultFile, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function loadVaultFile(): WalletVaultFile {
  const filePath = getVaultFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Wallet not initialized. Run 'mcw init' (or 'npx @deviykee/mcw init') first.`);
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData) as WalletVaultFile;
}

export function initializeVault(
  mnemonic: string,
  password: string,
  addresses: {
    btc: string;
    btcMainnet?: string;
    eth: string;
    sol: string;
    trx: string;
  }
): WalletVaultFile {
  const encryptedPayload = encryptData(mnemonic, password);
  const now = new Date().toISOString();

  const vaultFile: WalletVaultFile = {
    createdAt: now,
    updatedAt: now,
    vault: encryptedPayload,
    metadata: {
      btcAddress: addresses.btc,
      btcMainnetAddress: addresses.btcMainnet,
      ethAddress: addresses.eth,
      solAddress: addresses.sol,
      trxAddress: addresses.trx,
    },
  };

  saveVaultFile(vaultFile);
  return vaultFile;
}

export function unlockVault(password: string): string {
  const vaultFile = loadVaultFile();
  return decryptData(vaultFile.vault, password);
}

export function getWalletAddress(chain: SupportedChain, mode?: NetworkMode): string {
  const vault = loadVaultFile();
  const activeMode = mode || getNetworkMode();

  if (chain === 'btc') {
    if (activeMode === 'mainnet' && vault.metadata.btcMainnetAddress) {
      return vault.metadata.btcMainnetAddress;
    }
    return vault.metadata.btcAddress;
  }

  return chain === 'eth'
    ? vault.metadata.ethAddress
    : chain === 'sol'
    ? vault.metadata.solAddress
    : vault.metadata.trxAddress;
}
