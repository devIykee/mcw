import { SupportedChain, ChainConfig } from '../config/chains.js';

export interface BalanceResult {
  chain: SupportedChain;
  chainName: string;
  address: string;
  balanceFormatted: string;
  balanceRaw: string;
  symbol: string;
  network: string;
}

export interface TransactionPayload {
  to: string;
  amount: string; // Human readable (e.g. "0.01")
  feeRateOrGasPrice?: string;
  data?: string;
}

export interface BuiltTransaction {
  chain: SupportedChain;
  to: string;
  amount: string;
  estimatedFee: string;
  rawPayload: any;
  summary: string;
}

export interface BroadcastResult {
  chain: SupportedChain;
  txHash: string;
  explorerUrl: string;
  status: 'submitted' | 'confirmed' | 'failed';
  amount: string;
  recipient: string;
}

export interface FaucetResult {
  chain: SupportedChain;
  success: boolean;
  message: string;
  txHash?: string;
  instructionsUrl?: string;
}

export abstract class BaseChainAdapter {
  protected config: ChainConfig;

  constructor(config: ChainConfig) {
    this.config = config;
  }

  abstract getBalance(address: string): Promise<BalanceResult>;
  abstract buildTransaction(fromAddress: string, payload: TransactionPayload): Promise<BuiltTransaction>;
  abstract signAndSendTransaction(privateKey: string, builtTx: BuiltTransaction): Promise<BroadcastResult>;
  abstract requestFaucet(address: string): Promise<FaucetResult>;
  abstract getTransactionStatus(txHash: string): Promise<{ status: string; confirmations?: number; details?: any }>;
}
