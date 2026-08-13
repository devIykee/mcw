import { SupportedChain, NetworkMode, getNetworkMode } from '../config/chains.js';
import { BaseChainAdapter } from './base.js';
import { EthereumAdapter } from './ethAdapter.js';
import { SolanaAdapter } from './solAdapter.js';
import { BitcoinAdapter } from './btcAdapter.js';
import { TronAdapter } from './trxAdapter.js';

export * from './base.js';
export * from './ethAdapter.js';
export * from './solAdapter.js';
export * from './btcAdapter.js';
export * from './trxAdapter.js';

export function getChainAdapter(chain: SupportedChain, mode?: NetworkMode): BaseChainAdapter {
  const activeMode = mode || getNetworkMode();
  switch (chain) {
    case 'eth':
      return new EthereumAdapter(activeMode);
    case 'sol':
      return new SolanaAdapter(activeMode);
    case 'btc':
      return new BitcoinAdapter(activeMode);
    case 'trx':
      return new TronAdapter(activeMode);
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}
