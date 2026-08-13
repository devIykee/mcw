import { ethers } from 'ethers';
import {
  BaseChainAdapter,
  BalanceResult,
  TransactionPayload,
  BuiltTransaction,
  BroadcastResult,
  FaucetResult
} from './base.js';
import { getChainConfig, NetworkMode } from '../config/chains.js';

export class EthereumAdapter extends BaseChainAdapter {
  private provider: ethers.JsonRpcProvider;

  constructor(mode?: NetworkMode) {
    const config = getChainConfig('eth', mode);
    super(config);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  }

  async getBalance(address: string): Promise<BalanceResult> {
    const balanceWei = await this.provider.getBalance(address);
    const balanceEth = ethers.formatEther(balanceWei);

    return {
      chain: 'eth',
      chainName: this.config.name,
      address,
      balanceFormatted: parseFloat(balanceEth).toFixed(6),
      balanceRaw: balanceWei.toString(),
      symbol: this.config.symbol,
      network: this.config.networkName
    };
  }

  async buildTransaction(fromAddress: string, payload: TransactionPayload): Promise<BuiltTransaction> {
    const value = ethers.parseEther(payload.amount);
    const feeData = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(fromAddress, 'pending');

    const tx: ethers.TransactionRequest = {
      from: fromAddress,
      to: payload.to,
      value,
      nonce,
      chainId: this.config.chainId,
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1.5', 'gwei'),
      gasLimit: 21000n,
    };

    if (payload.data) {
      tx.data = payload.data;
    }

    const estimatedCostWei = (tx.gasLimit as bigint) * (tx.maxFeePerGas as bigint);
    const estimatedFeeEth = ethers.formatEther(estimatedCostWei);

    return {
      chain: 'eth',
      to: payload.to,
      amount: payload.amount,
      estimatedFee: `${parseFloat(estimatedFeeEth).toFixed(6)} ETH`,
      rawPayload: tx,
      summary: `Send ${payload.amount} ${this.config.symbol} to ${payload.to} on ${this.config.networkName} (Est. Fee: ${parseFloat(estimatedFeeEth).toFixed(6)} ETH)`
    };
  }

  async signAndSendTransaction(privateKey: string, builtTx: BuiltTransaction): Promise<BroadcastResult> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const txResponse = await wallet.sendTransaction(builtTx.rawPayload);

    return {
      chain: 'eth',
      txHash: txResponse.hash,
      explorerUrl: `${this.config.explorerTxUrl}${txResponse.hash}`,
      status: 'submitted',
      amount: builtTx.amount,
      recipient: builtTx.to
    };
  }

  async requestFaucet(address: string): Promise<FaucetResult> {
    if (this.config.networkMode === 'mainnet') {
      return {
        chain: 'eth',
        success: false,
        message: 'Faucets are not available for Ethereum Mainnet (Real Assets).'
      };
    }
    return {
      chain: 'eth',
      success: true,
      message: `Sepolia testnet ETH requires PoW or Authenticated Faucet access. Visit portal below:`,
      instructionsUrl: `${this.config.faucetUrl}?address=${address}`
    };
  }

  async getTransactionStatus(txHash: string): Promise<{ status: string; confirmations?: number; details?: any }> {
    const txReceipt = await this.provider.getTransactionReceipt(txHash);
    if (!txReceipt) {
      return { status: 'pending', confirmations: 0 };
    }
    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - txReceipt.blockNumber + 1;
    return {
      status: txReceipt.status === 1 ? 'confirmed' : 'failed',
      confirmations,
      details: {
        blockNumber: txReceipt.blockNumber,
        gasUsed: txReceipt.gasUsed.toString()
      }
    };
  }
}
