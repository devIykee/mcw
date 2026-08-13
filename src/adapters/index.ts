import { SupportedChain, NetworkMode, getNetworkMode, getChainConfig } from '../config/chains.js';
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

export function getChainAdapter(chain: string, mode?: NetworkMode): BaseChainAdapter {
  const activeMode = mode || getNetworkMode();
  const lowerChain = chain.toLowerCase();

  switch (lowerChain) {
    case 'eth':
      return new EthereumAdapter(activeMode, 'eth');
    case 'sol':
      return new SolanaAdapter(activeMode);
    case 'btc':
      return new BitcoinAdapter(activeMode);
    case 'trx':
      return new TronAdapter(activeMode);
    default: {
      // Check if it is a custom EVM chain
      const config = getChainConfig(lowerChain, activeMode);
      if (config.type === 'evm') {
        return new EthereumAdapter(activeMode, lowerChain);
      }
      throw new Error(`Unsupported chain: ${chain}`);
    }
  }
}
