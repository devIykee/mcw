import axios from 'axios';
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

export class TronAdapter extends BaseChainAdapter {
  private apiBaseUrl: string;

  constructor(mode?: NetworkMode) {
    const config = getChainConfig('trx', mode);
    super(config);
    this.apiBaseUrl = config.rpcUrl;
  }

  async getBalance(address: string): Promise<BalanceResult> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/wallet/getaccount`, {
        address: address,
        visible: true
      }, { timeout: 10000 });

      const balanceSun = response.data && response.data.balance ? response.data.balance : 0;
      const trx = (balanceSun / 1e6).toFixed(6);

      return {
        chain: 'trx',
        chainName: this.config.name,
        address,
        balanceFormatted: trx,
        balanceRaw: balanceSun.toString(),
        symbol: this.config.symbol,
        network: this.config.networkName
      };
    } catch (error: any) {
      return {
        chain: 'trx',
        chainName: this.config.name,
        address,
        balanceFormatted: '0.000000',
        balanceRaw: '0',
        symbol: this.config.symbol,
        network: this.config.networkName
      };
    }
  }

  async buildTransaction(fromAddress: string, payload: TransactionPayload): Promise<BuiltTransaction> {
    const amountSun = Math.round(parseFloat(payload.amount) * 1e6);

    const createTxRes = await axios.post(`${this.apiBaseUrl}/wallet/createtransaction`, {
      to_address: payload.to,
      owner_address: fromAddress,
      amount: amountSun,
      visible: true
    });

    if (createTxRes.data.Error) {
      throw new Error(`Tron transaction creation failed: ${createTxRes.data.Error}`);
    }

    const estimatedFee = '1.0 TRX';

    return {
      chain: 'trx',
      to: payload.to,
      amount: payload.amount,
      estimatedFee,
      rawPayload: createTxRes.data,
      summary: `Send ${payload.amount} ${this.config.symbol} to ${payload.to} on ${this.config.networkName} (Est. Fee: ${estimatedFee})`
    };
  }

  async signAndSendTransaction(privateKeyHex: string, builtTx: BuiltTransaction): Promise<BroadcastResult> {
    const tx = builtTx.rawPayload;
    const txID = tx.txID;

    const signingKey = new ethers.SigningKey(privateKeyHex);
    const signature = signingKey.sign(Buffer.from(txID, 'hex'));
    
    const rHex = signature.r.slice(2).padStart(64, '0');
    const sHex = signature.s.slice(2).padStart(64, '0');
    const vHex = signature.v.toString(16).padStart(2, '0');
    const fullSigHex = `${rHex}${sHex}${vHex}`;

    tx.signature = [fullSigHex];

    const broadcastRes = await axios.post(`${this.apiBaseUrl}/wallet/broadcasttransaction`, tx);

    if (!broadcastRes.data.result) {
      throw new Error(`Tron broadcast failed: ${broadcastRes.data.message || JSON.stringify(broadcastRes.data)}`);
    }

    return {
      chain: 'trx',
      txHash: txID,
      explorerUrl: `${this.config.explorerTxUrl}${txID}`,
      status: 'submitted',
      amount: builtTx.amount,
      recipient: builtTx.to
    };
  }

  async requestFaucet(address: string): Promise<FaucetResult> {
    if (this.config.networkMode === 'mainnet') {
      return {
        chain: 'trx',
        success: false,
        message: 'Faucets are not available for Tron Mainnet (Real Assets).'
      };
    }
    return {
      chain: 'trx',
      success: true,
      message: `Tron Nile testnet TRX can be requested via faucet:`,
      instructionsUrl: `${this.config.faucetUrl}?address=${address}`
    };
  }

  async getTransactionStatus(txHash: string): Promise<{ status: string; confirmations?: number; details?: any }> {
    try {
      const res = await axios.post(`${this.apiBaseUrl}/wallet/gettransactionbyid`, { value: txHash });
      const confirmed = res.data && res.data.ret && res.data.ret[0]?.contractRet === 'SUCCESS';
      return {
        status: confirmed ? 'confirmed' : (res.data.ret ? 'failed' : 'pending'),
        details: res.data
      };
    } catch {
      return { status: 'not_found' };
    }
  }
}
