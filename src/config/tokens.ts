import fs from 'fs';
import path from 'path';
import os from 'os';
import { NetworkMode, getNetworkMode } from './chains.js';

export interface TokenConfig {
  id: string; // e.g. 'usdc-sepolia', 'link-sepolia'
  symbol: string; // e.g. 'USDC'
  name: string; // e.g. 'USD Coin'
  chain: string; // e.g. 'eth', 'base-sepolia', 'polygon', 'sol', 'trx'
  networkMode: NetworkMode;
  contractAddress: string; // Contract address or Mint address
  decimals: number;
  standard: 'erc20' | 'spl' | 'trc20';
  isCustom?: boolean;
}

// Built-in Popular Testnet Tokens
export const BUILT_IN_TOKENS: TokenConfig[] = [
  {
    id: 'usdc-sepolia',
    symbol: 'USDC',
    name: 'USD Coin (Sepolia)',
    chain: 'eth',
    networkMode: 'testnet',
    contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle Official Sepolia USDC
    decimals: 6,
    standard: 'erc20',
  },
  {
    id: 'link-sepolia',
    symbol: 'LINK',
    name: 'ChainLink Token (Sepolia)',
    chain: 'eth',
    networkMode: 'testnet',
    contractAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789', // Chainlink Sepolia
    decimals: 18,
    standard: 'erc20',
  },
  {
    id: 'usdc-sol-devnet',
    symbol: 'USDC',
    name: 'USD Coin (Solana Devnet)',
    chain: 'sol',
    networkMode: 'testnet',
    contractAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Circle Devnet USDC Mint
    decimals: 6,
    standard: 'spl',
  },
  // Mainnet Popular Tokens
  {
    id: 'usdt-eth-mainnet',
    symbol: 'USDT',
    name: 'Tether USD (Ethereum)',
    chain: 'eth',
    networkMode: 'mainnet',
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    standard: 'erc20',
  },
  {
    id: 'usdc-eth-mainnet',
    symbol: 'USDC',
    name: 'USD Coin (Ethereum)',
    chain: 'eth',
    networkMode: 'mainnet',
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    standard: 'erc20',
  },
];

const CONFIG_DIR = path.join(os.homedir(), '.mcw');
const CUSTOM_TOKENS_FILE = path.join(CONFIG_DIR, 'custom_tokens.json');

export function ensureConfigDirectory(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadCustomTokens(): Record<string, TokenConfig> {
  try {
    if (fs.existsSync(CUSTOM_TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_TOKENS_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

export function saveCustomToken(token: TokenConfig): void {
  ensureConfigDirectory();
  const tokens = loadCustomTokens();
  tokens[token.id.toLowerCase()] = {
    ...token,
    isCustom: true,
  };
  fs.writeFileSync(CUSTOM_TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function removeCustomToken(tokenId: string): boolean {
  ensureConfigDirectory();
  const tokens = loadCustomTokens();
  const key = tokenId.toLowerCase();
  if (tokens[key]) {
    delete tokens[key];
    fs.writeFileSync(CUSTOM_TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    return true;
  }
  return false;
}

export function getAllTokens(mode?: NetworkMode, chain?: string): TokenConfig[] {
  const activeMode = mode || getNetworkMode();
  const custom = Object.values(loadCustomTokens());
  const all = [...BUILT_IN_TOKENS, ...custom];

  return all.filter((t) => {
    const matchesMode = t.networkMode === activeMode;
    const matchesChain = chain ? t.chain.toLowerCase() === chain.toLowerCase() : true;
    return matchesMode && matchesChain;
  });
}

export function findToken(tokenSymbolOrAddress: string, mode?: NetworkMode, chain?: string): TokenConfig | undefined {
  const tokens = getAllTokens(mode, chain);
  const search = tokenSymbolOrAddress.toLowerCase();

  return tokens.find(
    (t) =>
      t.id.toLowerCase() === search ||
      t.symbol.toLowerCase() === search ||
      t.contractAddress.toLowerCase() === search
  );
}
