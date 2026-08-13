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

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint amount) returns (bool)',
];

export interface TokenBalanceResult {
  symbol: string;
  name?: string;
  contractAddress: string;
  walletAddress: string;
  balanceFormatted: string;
  balanceRaw: string;
  decimals: number;
  network: string;
}

export class EthereumAdapter extends BaseChainAdapter {
  private provider: ethers.JsonRpcProvider;

  constructor(mode?: NetworkMode, chain: string = 'eth') {
    const config = getChainConfig(chain, mode);
    super(config);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  }

  async getBalance(address: string): Promise<BalanceResult> {
    const balanceWei = await this.provider.getBalance(address);
    const balanceEth = ethers.formatEther(balanceWei);

    return {
      chain: this.config.id,
      chainName: this.config.name,
      address,
      balanceFormatted: parseFloat(balanceEth).toFixed(6),
      balanceRaw: balanceWei.toString(),
      symbol: this.config.symbol,
      network: this.config.networkName
    };
  }

  /**
   * Query ERC-20 Token Balance
   */
  async getERC20Balance(tokenContractAddress: string, walletAddress: string, explicitDecimals?: number): Promise<TokenBalanceResult> {
    const contract = new ethers.Contract(tokenContractAddress, ERC20_ABI, this.provider);
    
    let decimals = explicitDecimals;
    let symbol = 'TOKEN';
    let name = 'Custom Token';

    try {
      if (decimals === undefined) {
        decimals = await contract.decimals();
      }
      symbol = await contract.symbol().catch(() => 'TOKEN');
      name = await contract.name().catch(() => 'Custom Token');
    } catch {
      decimals = decimals ?? 18;
    }

    const rawBalance = await contract.balanceOf(walletAddress);
    const formatted = ethers.formatUnits(rawBalance, decimals);

    return {
      symbol,
      name,
      contractAddress: tokenContractAddress,
      walletAddress,
      balanceFormatted: parseFloat(formatted).toFixed(4),
      balanceRaw: rawBalance.toString(),
      decimals: Number(decimals),
      network: this.config.networkName,
    };
  }

  /**
   * Build ERC-20 Token Transfer
   */
  async buildERC20Transfer(
    fromAddress: string,
    tokenContractAddress: string,
    toAddress: string,
    amount: string,
    explicitDecimals: number = 18
  ): Promise<BuiltTransaction> {
    const contract = new ethers.Contract(tokenContractAddress, ERC20_ABI, this.provider);
    const parsedAmount = ethers.parseUnits(amount, explicitDecimals);
    const data = contract.interface.encodeFunctionData('transfer', [toAddress, parsedAmount]);

    const feeData = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(fromAddress, 'pending');

    const tx: ethers.TransactionRequest = {
      from: fromAddress,
      to: tokenContractAddress,
      value: 0n,
      data,
      nonce,
      chainId: this.config.chainId,
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1.5', 'gwei'),
    };

    let estimatedGas = 65000n;
    try {
      estimatedGas = await this.provider.estimateGas(tx);
      estimatedGas = (estimatedGas * 120n) / 100n;
    } catch {}

    tx.gasLimit = estimatedGas;
    const feeWei = estimatedGas * (tx.maxFeePerGas as bigint);
    const feeEth = ethers.formatEther(feeWei);

    return {
      chain: this.config.id,
      to: toAddress,
      amount,
      estimatedFee: `${parseFloat(feeEth).toFixed(6)} ${this.config.symbol}`,
      rawPayload: tx,
      summary: `Transfer ${amount} tokens to ${toAddress} on ${this.config.networkName} (Contract: ${tokenContractAddress}, Est. Gas: ${parseFloat(feeEth).toFixed(6)} ${this.config.symbol})`
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
      data: payload.data || '0x',
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1.5', 'gwei'),
    };

    let estimatedGas = 21000n;
    try {
      estimatedGas = await this.provider.estimateGas(tx);
    } catch {}

    tx.gasLimit = estimatedGas;
    const feeWei = estimatedGas * (tx.maxFeePerGas as bigint);
    const feeEth = ethers.formatEther(feeWei);

    return {
      chain: this.config.id,
      to: payload.to,
      amount: payload.amount,
      estimatedFee: `${parseFloat(feeEth).toFixed(6)} ${this.config.symbol}`,
      rawPayload: tx,
      summary: `Send ${payload.amount} ${this.config.symbol} to ${payload.to} on ${this.config.networkName} (Est. Gas: ${parseFloat(feeEth).toFixed(6)} ${this.config.symbol})`
    };
  }

  async signAndSendTransaction(privateKeyHex: string, builtTx: BuiltTransaction): Promise<BroadcastResult> {
    const wallet = new ethers.Wallet(privateKeyHex, this.provider);
    const txResponse = await wallet.sendTransaction(builtTx.rawPayload as ethers.TransactionRequest);

    return {
      chain: this.config.id,
      txHash: txResponse.hash,
      explorerUrl: `${this.config.explorerTxUrl}${txResponse.hash}`,
      status: 'submitted',
      amount: builtTx.amount,
      recipient: builtTx.to,
    };
  }

  async requestFaucet(address: string): Promise<FaucetResult> {
    if (this.config.networkMode === 'mainnet') {
      return {
        chain: this.config.id,
        success: false,
        message: 'Faucets are not available for Mainnet (Real Assets).'
      };
    }
    return {
      chain: this.config.id,
      success: true,
      message: `${this.config.networkName} testnet tokens require PoW or Authenticated Faucet access. Visit portal below:`,
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
