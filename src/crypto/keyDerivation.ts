import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';
import crypto from 'crypto';
import { getChainConfig, SupportedChain, NetworkMode, getNetworkMode } from '../config/chains.js';

// Initialize BIP32 factory with secp256k1 implementation
const bip32 = BIP32Factory(ecc);

export interface DerivedKeyInfo {
  chain: SupportedChain;
  chainName: string;
  networkMode: NetworkMode;
  derivationPath: string;
  address: string;
  publicKey: string;
  privateKey: string; // WIF for BTC, Hex for ETH/TRX, Base58 for SOL
  extra?: Record<string, string>;
}

export interface MultiChainWalletKeys {
  mnemonic: string;
  seedHex: string;
  networkMode: NetworkMode;
  btc: DerivedKeyInfo;
  eth: DerivedKeyInfo;
  sol: DerivedKeyInfo;
  trx: DerivedKeyInfo;
}

/**
 * Base58Check Encoder for Bitcoin & Tron addresses
 */
export function base58CheckEncode(payload: Buffer): string {
  const hash1 = crypto.createHash('sha256').update(payload).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  const checksum = hash2.subarray(0, 4);
  return bs58.encode(Buffer.concat([payload, checksum]));
}

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39.generateMnemonic(strength);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic.trim());
}

/**
 * Derives Bitcoin Keypair and Address (BIP-84 Native SegWit)
 * Testnet: m/84'/1'/0'/0/0 (tb1q...)
 * Mainnet: m/84'/0'/0'/0/0 (bc1q...)
 */
export function deriveBitcoinKey(seed: Buffer, mode: NetworkMode = 'testnet'): DerivedKeyInfo {
  const config = getChainConfig('btc', mode);
  const network = mode === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(config.derivationPath);

  if (!child.privateKey) {
    throw new Error('Failed to derive Bitcoin private key.');
  }

  // Native SegWit (P2WPKH - bech32 starting with tb1q on testnet or bc1q on mainnet)
  const p2wpkh = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network,
  });

  const p2pkh = bitcoin.payments.p2pkh({
    pubkey: child.publicKey,
    network,
  });

  return {
    chain: 'btc',
    chainName: config.name,
    networkMode: mode,
    derivationPath: config.derivationPath,
    address: p2wpkh.address || '',
    publicKey: child.publicKey.toString('hex'),
    privateKey: child.toWIF(),
    extra: {
      legacyAddress: p2pkh.address || '',
      nativeSegwitAddress: p2wpkh.address || ''
    }
  };
}

/**
 * Derives Ethereum / EVM keypair and address.
 * Path: m/44'/60'/0'/0/0 (BIP-44 standard EVM path)
 */
export function deriveEthereumKey(seed: Buffer, mode: NetworkMode = 'testnet'): DerivedKeyInfo {
  const config = getChainConfig('eth', mode);
  const hdNode = ethers.HDNodeWallet.fromSeed(seed);
  const childWallet = hdNode.derivePath(config.derivationPath);

  return {
    chain: 'eth',
    chainName: config.name,
    networkMode: mode,
    derivationPath: config.derivationPath,
    address: ethers.getAddress(childWallet.address),
    publicKey: childWallet.publicKey,
    privateKey: childWallet.privateKey,
  };
}

/**
 * Derives Solana keypair using SLIP-0010 Ed25519 derivation.
 * Path: m/44'/501'/0'/0'
 */
export function deriveSolanaKey(seed: Buffer, mode: NetworkMode = 'testnet'): DerivedKeyInfo {
  const config = getChainConfig('sol', mode);
  const derived = derivePath(config.derivationPath, seed.toString('hex'));
  const keypair = Keypair.fromSeed(derived.key);

  return {
    chain: 'sol',
    chainName: config.name,
    networkMode: mode,
    derivationPath: config.derivationPath,
    address: keypair.publicKey.toBase58(),
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}

/**
 * Derives Tron keypair and Base58Check address.
 * Path: m/44'/195'/0'/0/0
 */
export function deriveTronKey(seed: Buffer, mode: NetworkMode = 'testnet'): DerivedKeyInfo {
  const config = getChainConfig('trx', mode);
  const root = bip32.fromSeed(seed);
  const child = root.derivePath(config.derivationPath);

  if (!child.privateKey) {
    throw new Error('Failed to derive Tron private key.');
  }

  const uncompressedPubKey = ecc.pointCompress(child.publicKey, false);
  const pubKeyBytes = uncompressedPubKey.subarray(1);
  const keccakHex = ethers.keccak256(pubKeyBytes);
  const keccakBuffer = Buffer.from(keccakHex.slice(2), 'hex');
  const address20 = keccakBuffer.subarray(keccakBuffer.length - 20);
  const tronAddressPayload = Buffer.concat([Buffer.from([0x41]), address20]);
  const tronAddress = base58CheckEncode(tronAddressPayload);

  return {
    chain: 'trx',
    chainName: config.name,
    networkMode: mode,
    derivationPath: config.derivationPath,
    address: tronAddress,
    publicKey: child.publicKey.toString('hex'),
    privateKey: '0x' + child.privateKey.toString('hex'),
  };
}

/**
 * Unified Multi-Chain Derivation Function.
 */
export function deriveAllKeys(mnemonic: string, passphrase?: string, mode?: NetworkMode): MultiChainWalletKeys {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid BIP-39 mnemonic phrase.');
  }

  const activeMode = mode || getNetworkMode();
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim(), passphrase);

  return {
    mnemonic: mnemonic.trim(),
    seedHex: seed.toString('hex'),
    networkMode: activeMode,
    btc: deriveBitcoinKey(seed, activeMode),
    eth: deriveEthereumKey(seed, activeMode),
    sol: deriveSolanaKey(seed, activeMode),
    trx: deriveTronKey(seed, activeMode),
  };
}
