import fs from 'fs';
import path from 'path';
import os from 'os';

export type NetworkMode = 'testnet' | 'mainnet';
export type SupportedChain = 'btc' | 'eth' | 'sol' | 'trx';

export interface ChainConfig {
  id: SupportedChain;
  name: string;
  networkMode: NetworkMode;
  networkName: string;
  symbol: string;
  decimals: number;
  derivationPath: string;
  coinType: number;
  rpcUrl: string;
  fallbackRpcs: string[];
  explorerTxUrl: string;
  explorerAddressUrl: string;
  faucetUrl?: string;
  chainId?: number; // For EVM
}

export const DUAL_CHAIN_CONFIGS: Record<NetworkMode, Record<SupportedChain, ChainConfig>> = {
  testnet: {
    btc: {
      id: 'btc',
      name: 'Bitcoin (Testnet3 / Signet)',
      networkMode: 'testnet',
      networkName: 'Bitcoin Testnet3',
      symbol: 'tBTC',
      decimals: 8,
      derivationPath: "m/84'/1'/0'/0/0", // BIP-84 Testnet coin_type 1'
      coinType: 1,
      rpcUrl: 'https://blockstream.info/testnet/api',
      fallbackRpcs: ['https://mempool.space/testnet/api'],
      explorerTxUrl: 'https://mempool.space/testnet/tx/',
      explorerAddressUrl: 'https://mempool.space/testnet/address/',
      faucetUrl: 'https://coinfaucet.eu/en/btc-testnet/',
    },
    eth: {
      id: 'eth',
      name: 'Ethereum (Sepolia Testnet)',
      networkMode: 'testnet',
      networkName: 'Sepolia Testnet',
      symbol: 'SepoliaETH',
      decimals: 18,
      derivationPath: "m/44'/60'/0'/0/0",
      coinType: 60,
      chainId: 11155111,
      rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
      fallbackRpcs: ['https://rpc.sepolia.org', 'https://sepolia.gateway.tenderly.co'],
      explorerTxUrl: 'https://sepolia.etherscan.io/tx/',
      explorerAddressUrl: 'https://sepolia.etherscan.io/address/',
      faucetUrl: 'https://faucets.chain.link/sepolia',
    },
    sol: {
      id: 'sol',
      name: 'Solana (Devnet)',
      networkMode: 'testnet',
      networkName: 'Solana Devnet',
      symbol: 'SOL',
      decimals: 9,
      derivationPath: "m/44'/501'/0'/0'",
      coinType: 501,
      rpcUrl: 'https://api.devnet.solana.com',
      fallbackRpcs: ['https://api.devnet.solana.com'],
      explorerTxUrl: 'https://explorer.solana.com/tx/?cluster=devnet',
      explorerAddressUrl: 'https://explorer.solana.com/address/?cluster=devnet',
      faucetUrl: 'https://faucet.solana.com',
    },
    trx: {
      id: 'trx',
      name: 'Tron (Nile Testnet)',
      networkMode: 'testnet',
      networkName: 'Tron Nile Testnet',
      symbol: 'TRX',
      decimals: 6,
      derivationPath: "m/44'/195'/0'/0/0",
      coinType: 195,
      rpcUrl: 'https://nile.trongrid.io',
      fallbackRpcs: ['https://api.shasta.trongrid.io'],
      explorerTxUrl: 'https://nile.tronscan.org/#/transaction/',
      explorerAddressUrl: 'https://nile.tronscan.org/#/address/',
      faucetUrl: 'https://nileex.io/join/getJoinPage',
    },
  },
  mainnet: {
    btc: {
      id: 'btc',
      name: 'Bitcoin (Mainnet)',
      networkMode: 'mainnet',
      networkName: 'Bitcoin Mainnet',
      symbol: 'BTC',
      decimals: 8,
      derivationPath: "m/84'/0'/0'/0/0", // BIP-84 Mainnet coin_type 0' (bc1q...)
      coinType: 0,
      rpcUrl: 'https://mempool.space/api',
      fallbackRpcs: ['https://blockstream.info/api'],
      explorerTxUrl: 'https://mempool.space/tx/',
      explorerAddressUrl: 'https://mempool.space/address/',
    },
    eth: {
      id: 'eth',
      name: 'Ethereum (Mainnet)',
      networkMode: 'mainnet',
      networkName: 'Ethereum Mainnet',
      symbol: 'ETH',
      decimals: 18,
      derivationPath: "m/44'/60'/0'/0/0",
      coinType: 60,
      chainId: 1,
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
      fallbackRpcs: ['https://cloudflare-eth.com', 'https://eth.llamarpc.com'],
      explorerTxUrl: 'https://etherscan.io/tx/',
      explorerAddressUrl: 'https://etherscan.io/address/',
    },
    sol: {
      id: 'sol',
      name: 'Solana (Mainnet-Beta)',
      networkMode: 'mainnet',
      networkName: 'Solana Mainnet',
      symbol: 'SOL',
      decimals: 9,
      derivationPath: "m/44'/501'/0'/0'",
      coinType: 501,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      fallbackRpcs: ['https://solana-mainnet.rpc.extrnode.com'],
      explorerTxUrl: 'https://explorer.solana.com/tx/',
      explorerAddressUrl: 'https://explorer.solana.com/address/',
    },
    trx: {
      id: 'trx',
      name: 'Tron (Mainnet)',
      networkMode: 'mainnet',
      networkName: 'Tron Mainnet',
      symbol: 'TRX',
      decimals: 6,
      derivationPath: "m/44'/195'/0'/0/0",
      coinType: 195,
      rpcUrl: 'https://api.trongrid.io',
      fallbackRpcs: ['https://api.tronstack.io'],
      explorerTxUrl: 'https://tronscan.org/#/transaction/',
      explorerAddressUrl: 'https://tronscan.org/#/address/',
    },
  },
};

const NETWORK_CONFIG_FILE = path.join(os.homedir(), '.mc-twaf', 'network.json');

/**
 * Gets the current active network mode ('testnet' or 'mainnet').
 * Defaults to 'testnet'.
 */
export function getNetworkMode(): NetworkMode {
  try {
    if (fs.existsSync(NETWORK_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(NETWORK_CONFIG_FILE, 'utf8'));
      if (data.mode === 'mainnet' || data.mode === 'testnet') {
        return data.mode;
      }
    }
  } catch {}
  return 'testnet';
}

/**
 * Switches the active network mode.
 */
export function setNetworkMode(mode: NetworkMode): void {
  const dir = path.dirname(NETWORK_CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(NETWORK_CONFIG_FILE, JSON.stringify({ mode, updatedAt: new Date().toISOString() }, null, 2), {
    mode: 0o600,
  });
}

/**
 * Get chain configs for the currently active network mode
 */
export function getChainConfig(chain: SupportedChain, mode?: NetworkMode): ChainConfig {
  const activeMode = mode || getNetworkMode();
  return DUAL_CHAIN_CONFIGS[activeMode][chain];
}

// Backward compatibility helper
export const CHAIN_CONFIGS = DUAL_CHAIN_CONFIGS.testnet;
