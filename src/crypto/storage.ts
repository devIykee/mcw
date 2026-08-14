import fs from 'fs';
import path from 'path';
import os from 'os';
import { EncryptedPayload, encryptData, decryptData } from './cipher.js';
import { SECURITY_CONFIG, getVaultFilePath } from '../config/security.js';
import { SupportedChain, NetworkMode, getNetworkMode } from '../config/chains.js';
import { deriveAllKeys } from './keyDerivation.js';

export interface WalletAccount {
  index: number;
  label: string;
  createdAt: string;
  addresses: {
    btc: string;
    btcMainnet?: string;
    eth: string;
    sol: string;
    trx: string;
  };
}

export interface WalletVaultFile {
  name: string;
  createdAt: string;
  updatedAt: string;
  vault: EncryptedPayload;
  accounts: WalletAccount[];
  metadata: {
    btcAddress: string;          // Default Account 0
    btcMainnetAddress?: string;
    ethAddress: string;
    solAddress: string;
    trxAddress: string;
  };
}

export interface McwGlobalConfig {
  activeWallet: string;
  activeAccount: number;
}

const GLOBAL_CONFIG_FILE = path.join(os.homedir(), '.mcw', 'config.json');
const WALLETS_DIR = path.join(os.homedir(), '.mcw', 'wallets');

export function ensureWalletsDirectory(): void {
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadGlobalConfig(): McwGlobalConfig {
  try {
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8'));
      return { activeWallet: data.activeWallet || 'default', activeAccount: data.activeAccount ?? 0 };
    }
  } catch {}
  return { activeWallet: 'default', activeAccount: 0 };
}

export function saveGlobalConfig(config: McwGlobalConfig): void {
  const dir = path.dirname(GLOBAL_CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getActiveWalletName(): string {
  return loadGlobalConfig().activeWallet;
}

export function setActiveWalletName(name: string): void {
  const cfg = loadGlobalConfig();
  cfg.activeWallet = name;
  cfg.activeAccount = 0; // reset active account index when switching wallet
  saveGlobalConfig(cfg);
}

export function getActiveAccountIndex(): number {
  return loadGlobalConfig().activeAccount;
}

export function setActiveAccountIndex(index: number): void {
  const cfg = loadGlobalConfig();
  cfg.activeAccount = index;
  saveGlobalConfig(cfg);
}

export function getWalletFilePath(walletName?: string): string {
  ensureWalletsDirectory();
  const name = (walletName || getActiveWalletName()).trim();
  return path.join(WALLETS_DIR, `${name}.dat`);
}

/**
 * Migration helper: migrates legacy ~/.mcw/vault.dat to ~/.mcw/wallets/default.dat
 */
export function migrateLegacyVault(): void {
  const legacyPath = getVaultFilePath();
  ensureWalletsDirectory();
  const defaultPath = path.join(WALLETS_DIR, 'default.dat');

  if (fs.existsSync(legacyPath) && !fs.existsSync(defaultPath)) {
    try {
      const raw = fs.readFileSync(legacyPath, 'utf8');
      const parsed = JSON.parse(raw);
      const accounts: WalletAccount[] = [
        {
          index: 0,
          label: 'Default Account',
          createdAt: parsed.createdAt || new Date().toISOString(),
          addresses: {
            btc: parsed.metadata.btcAddress,
            btcMainnet: parsed.metadata.btcMainnetAddress,
            eth: parsed.metadata.ethAddress,
            sol: parsed.metadata.solAddress,
            trx: parsed.metadata.trxAddress,
          },
        },
      ];
      const upgraded: WalletVaultFile = {
        name: 'default',
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vault: parsed.vault,
        accounts,
        metadata: parsed.metadata,
      };
      fs.writeFileSync(defaultPath, JSON.stringify(upgraded, null, 2), { mode: 0o600 });
    } catch {}
  }
}

export function walletExists(walletName?: string): boolean {
  migrateLegacyVault();
  const filePath = getWalletFilePath(walletName);
  return fs.existsSync(filePath);
}

export function listWallets(): Array<{ name: string; isActive: boolean; accountsCount: number; createdAt: string }> {
  migrateLegacyVault();
  ensureWalletsDirectory();
  const activeName = getActiveWalletName();
  const files = fs.readdirSync(WALLETS_DIR).filter((f) => f.endsWith('.dat'));

  return files.map((file) => {
    const name = file.replace(/\.dat$/, '');
    let accountsCount = 1;
    let createdAt = '';
    try {
      const content: WalletVaultFile = JSON.parse(fs.readFileSync(path.join(WALLETS_DIR, file), 'utf8'));
      accountsCount = content.accounts ? content.accounts.length : 1;
      createdAt = content.createdAt;
    } catch {}

    return {
      name,
      isActive: name === activeName,
      accountsCount,
      createdAt,
    };
  });
}

export function saveVaultFile(vaultFile: WalletVaultFile, walletName?: string): void {
  ensureWalletsDirectory();
  const name = walletName || vaultFile.name || getActiveWalletName();
  const filePath = getWalletFilePath(name);
  fs.writeFileSync(filePath, JSON.stringify(vaultFile, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function loadVaultFile(walletName?: string): WalletVaultFile {
  migrateLegacyVault();
  const name = walletName || getActiveWalletName();
  const filePath = getWalletFilePath(name);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Wallet profile '${name}' not initialized. Run 'mcw init' or 'mcw wallet create ${name}' first.`);
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(rawData) as WalletVaultFile;
  if (!parsed.accounts) {
    parsed.accounts = [
      {
        index: 0,
        label: 'Default Account',
        createdAt: parsed.createdAt,
        addresses: {
          btc: parsed.metadata.btcAddress,
          btcMainnet: parsed.metadata.btcMainnetAddress,
          eth: parsed.metadata.ethAddress,
          sol: parsed.metadata.solAddress,
          trx: parsed.metadata.trxAddress,
        },
      },
    ];
  }
  return parsed;
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
  },
  walletName: string = 'default'
): WalletVaultFile {
  const encryptedPayload = encryptData(mnemonic, password);
  const now = new Date().toISOString();

  const accounts: WalletAccount[] = [
    {
      index: 0,
      label: 'Main Account',
      createdAt: now,
      addresses: {
        btc: addresses.btc,
        btcMainnet: addresses.btcMainnet,
        eth: addresses.eth,
        sol: addresses.sol,
        trx: addresses.trx,
      },
    },
  ];

  const vaultFile: WalletVaultFile = {
    name: walletName,
    createdAt: now,
    updatedAt: now,
    vault: encryptedPayload,
    accounts,
    metadata: {
      btcAddress: addresses.btc,
      btcMainnetAddress: addresses.btcMainnet,
      ethAddress: addresses.eth,
      solAddress: addresses.sol,
      trxAddress: addresses.trx,
    },
  };

  saveVaultFile(vaultFile, walletName);
  setActiveWalletName(walletName);
  return vaultFile;
}

export function unlockVault(password: string, walletName?: string): string {
  const vaultFile = loadVaultFile(walletName);
  return decryptData(vaultFile.vault, password);
}

/**
 * Derive and append a new HD sub-account from the active wallet's seed
 */
export function createAccount(
  password: string,
  label?: string,
  walletName?: string
): WalletAccount {
  const vault = loadVaultFile(walletName);
  const mnemonic = unlockVault(password, walletName);

  const nextIndex = vault.accounts.length;
  const testnetKeys = deriveAllKeys(mnemonic, undefined, 'testnet', nextIndex);
  const mainnetKeys = deriveAllKeys(mnemonic, undefined, 'mainnet', nextIndex);

  const newAccount: WalletAccount = {
    index: nextIndex,
    label: label || `Account #${nextIndex}`,
    createdAt: new Date().toISOString(),
    addresses: {
      btc: testnetKeys.btc.address,
      btcMainnet: mainnetKeys.btc.address,
      eth: testnetKeys.eth.address,
      sol: testnetKeys.sol.address,
      trx: testnetKeys.trx.address,
    },
  };

  vault.accounts.push(newAccount);
  vault.updatedAt = new Date().toISOString();
  saveVaultFile(vault, walletName);

  return newAccount;
}

export function listAccounts(walletName?: string): WalletAccount[] {
  const vault = loadVaultFile(walletName);
  return vault.accounts || [];
}

export function getWalletAddress(
  chain: string,
  mode?: NetworkMode,
  accountIndex?: number,
  walletName?: string
): string {
  const vault = loadVaultFile(walletName);
  const activeMode = mode || getNetworkMode();
  const targetIndex = accountIndex !== undefined ? accountIndex : getActiveAccountIndex();

  const account = vault.accounts.find((a) => a.index === targetIndex) || vault.accounts[0];

  if (chain === 'btc') {
    if (activeMode === 'mainnet' && account.addresses.btcMainnet) {
      return account.addresses.btcMainnet;
    }
    return account.addresses.btc;
  }

  if (chain === 'sol') {
    return account.addresses.sol;
  }

  if (chain === 'trx') {
    return account.addresses.trx;
  }

  // Default for eth and all custom EVM chains
  return account.addresses.eth;
}

export function deleteWallet(walletName: string): boolean {
  ensureWalletsDirectory();
  const filePath = getWalletFilePath(walletName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    const remaining = listWallets();
    if (remaining.length > 0) {
      setActiveWalletName(remaining[0].name);
    }
    return true;
  }
  return false;
}
