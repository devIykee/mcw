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
  accountIndex: number;
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
  accountIndex: number;
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
 * Testnet: m/84'/1'/0'/0/index (tb1q...)
 * Mainnet: m/84'/0'/0'/0/index (bc1q...)
 */
export function deriveBitcoinKey(
  seed: Buffer,
  mode: NetworkMode = 'testnet',
  accountIndex: number = 0
): DerivedKeyInfo {
  const config = getChainConfig('btc', mode);
  const network = mode === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  const path = `m/84'/${mode === 'mainnet' ? "0'" : "1'"}/0'/0/${accountIndex}`;

  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

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
    accountIndex,
    derivationPath: path,
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
 * Path: m/44'/60'/0'/0/index (BIP-44 standard EVM path)
 */
export function deriveEthereumKey(
  seed: Buffer,
  mode: NetworkMode = 'testnet',
  accountIndex: number = 0
): DerivedKeyInfo {
  const config = getChainConfig('eth', mode);
  const path = `m/44'/60'/0'/0/${accountIndex}`;
  const hdNode = ethers.HDNodeWallet.fromSeed(seed);
  const childWallet = hdNode.derivePath(path);

  return {
    chain: 'eth',
    chainName: config.name,
    networkMode: mode,
    accountIndex,
    derivationPath: path,
    address: ethers.getAddress(childWallet.address),
    publicKey: childWallet.publicKey,
    privateKey: childWallet.privateKey,
  };
}

/**
 * Derives Solana keypair using SLIP-0010 Ed25519 derivation.
 * Path: m/44'/501'/index'/0'
 */
export function deriveSolanaKey(
  seed: Buffer,
  mode: NetworkMode = 'testnet',
  accountIndex: number = 0
): DerivedKeyInfo {
  const config = getChainConfig('sol', mode);
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const derived = derivePath(path, seed.toString('hex'));
  const keypair = Keypair.fromSeed(derived.key);

  return {
    chain: 'sol',
    chainName: config.name,
    networkMode: mode,
    accountIndex,
    derivationPath: path,
    address: keypair.publicKey.toBase58(),
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}

/**
 * Derives Tron keypair and Base58Check address.
 * Path: m/44'/195'/0'/0/index
 */
export function deriveTronKey(
  seed: Buffer,
  mode: NetworkMode = 'testnet',
  accountIndex: number = 0
): DerivedKeyInfo {
  const config = getChainConfig('trx', mode);
  const path = `m/44'/195'/0'/0/${accountIndex}`;
  const root = bip32.fromSeed(seed);
  const child = root.derivePath(path);

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
    accountIndex,
    derivationPath: path,
    address: tronAddress,
    publicKey: child.publicKey.toString('hex'),
    privateKey: '0x' + child.privateKey.toString('hex'),
  };
}

/**
 * Unified Multi-Chain Derivation Function with Account Indexing.
 */
export function deriveAllKeys(
  mnemonic: string,
  passphrase?: string,
  mode?: NetworkMode,
  accountIndex: number = 0
): MultiChainWalletKeys {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid BIP-39 mnemonic phrase.');
  }

  const activeMode = mode || getNetworkMode();
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim(), passphrase);

  return {
    mnemonic: mnemonic.trim(),
    seedHex: seed.toString('hex'),
    networkMode: activeMode,
    accountIndex,
    btc: deriveBitcoinKey(seed, activeMode, accountIndex),
    eth: deriveEthereumKey(seed, activeMode, accountIndex),
    sol: deriveSolanaKey(seed, activeMode, accountIndex),
    trx: deriveTronKey(seed, activeMode, accountIndex),
  };
}
