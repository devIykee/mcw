import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import {
  BaseChainAdapter,
  BalanceResult,
  TransactionPayload,
  BuiltTransaction,
  BroadcastResult,
  FaucetResult
} from './base.js';
import { getChainConfig, NetworkMode } from '../config/chains.js';

const ECPair = ECPairFactory(ecc);

interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

export class BitcoinAdapter extends BaseChainAdapter {
  private network: bitcoin.Network;
  private apiBaseUrl: string;

  constructor(mode?: NetworkMode) {
    const config = getChainConfig('btc', mode);
    super(config);
    this.network = config.networkMode === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    this.apiBaseUrl = config.rpcUrl;
  }

  async getBalance(address: string): Promise<BalanceResult> {
    try {
      const response = await axios.get<UTXO[]>(`${this.apiBaseUrl}/address/${address}/utxo`, { timeout: 10000 });
      const utxos = response.data || [];
      const totalSatoshis = utxos.reduce((acc, utxo) => acc + utxo.value, 0);
      const btc = (totalSatoshis / 1e8).toFixed(8);

      return {
        chain: 'btc',
        chainName: this.config.name,
        address,
        balanceFormatted: btc,
        balanceRaw: totalSatoshis.toString(),
        symbol: this.config.symbol,
        network: this.config.networkName
      };
    } catch (error: any) {
      return {
        chain: 'btc',
        chainName: this.config.name,
        address,
        balanceFormatted: '0.00000000',
        balanceRaw: '0',
        symbol: this.config.symbol,
        network: this.config.networkName
      };
    }
  }

  async buildTransaction(fromAddress: string, payload: TransactionPayload): Promise<BuiltTransaction> {
    const satoshisToSend = Math.round(parseFloat(payload.amount) * 1e8);
    const utxoResponse = await axios.get<UTXO[]>(`${this.apiBaseUrl}/address/${fromAddress}/utxo`);
    const utxos = utxoResponse.data || [];

    if (utxos.length === 0) {
      throw new Error(`Insufficient funds: No UTXOs found for ${this.config.networkName} address ${fromAddress}.`);
    }

    const estimatedFeeSatoshis = 500;
    let accumulated = 0;
    const selectedUtxos: UTXO[] = [];

    for (const utxo of utxos) {
      selectedUtxos.push(utxo);
      accumulated += utxo.value;
      if (accumulated >= satoshisToSend + estimatedFeeSatoshis) {
        break;
      }
    }

    if (accumulated < satoshisToSend + estimatedFeeSatoshis) {
      throw new Error(`Insufficient funds: Available ${(accumulated / 1e8).toFixed(8)} ${this.config.symbol}, required ${((satoshisToSend + estimatedFeeSatoshis) / 1e8).toFixed(8)} ${this.config.symbol}.`);
    }

    const changeSatoshis = accumulated - (satoshisToSend + estimatedFeeSatoshis);

    const rawPayload = {
      fromAddress,
      toAddress: payload.to,
      amountSatoshis: satoshisToSend,
      feeSatoshis: estimatedFeeSatoshis,
      changeSatoshis,
      selectedUtxos,
    };

    return {
      chain: 'btc',
      to: payload.to,
      amount: payload.amount,
      estimatedFee: `${(estimatedFeeSatoshis / 1e8).toFixed(8)} ${this.config.symbol}`,
      rawPayload,
      summary: `Send ${payload.amount} ${this.config.symbol} to ${payload.to} on ${this.config.networkName} (Est. Fee: ${(estimatedFeeSatoshis / 1e8).toFixed(8)} ${this.config.symbol})`
    };
  }

  async signAndSendTransaction(privateKeyWif: string, builtTx: BuiltTransaction): Promise<BroadcastResult> {
    const keyPair = ECPair.fromWIF(privateKeyWif, this.network);
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: this.network });

    const psbt = new bitcoin.Psbt({ network: this.network });
    const { rawPayload } = builtTx;

    for (const utxo of rawPayload.selectedUtxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: p2wpkh.output!,
          value: utxo.value,
        },
      });
    }

    // Output 1: Recipient
    psbt.addOutput({
      address: rawPayload.toAddress,
      value: rawPayload.amountSatoshis,
    });

    // Output 2: Change (if any)
    if (rawPayload.changeSatoshis > 546) {
      psbt.addOutput({
        address: rawPayload.fromAddress,
        value: rawPayload.changeSatoshis,
      });
    }

    // Sign all inputs
    rawPayload.selectedUtxos.forEach((_: any, index: number) => {
      psbt.signInput(index, keyPair);
    });

    psbt.finalizeAllInputs();
    const rawTxHex = psbt.extractTransaction().toHex();

    const broadcastRes = await axios.post(`${this.apiBaseUrl}/tx`, rawTxHex, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const txHash = broadcastRes.data;

    return {
      chain: 'btc',
      txHash,
      explorerUrl: `${this.config.explorerTxUrl}${txHash}`,
      status: 'submitted',
      amount: builtTx.amount,
      recipient: builtTx.to
    };
  }

  async requestFaucet(address: string): Promise<FaucetResult> {
    if (this.config.networkMode === 'mainnet') {
      return {
        chain: 'btc',
        success: false,
        message: 'Faucets are not available for Bitcoin Mainnet (Real Assets).'
      };
    }
    return {
      chain: 'btc',
      success: true,
      message: `Bitcoin Testnet3 funds can be claimed from public faucets:`,
      instructionsUrl: `${this.config.faucetUrl}?address=${address}`
    };
  }

  async getTransactionStatus(txHash: string): Promise<{ status: string; confirmations?: number; details?: any }> {
    try {
      const res = await axios.get<any>(`${this.apiBaseUrl}/tx/${txHash}/status`);
      return {
        status: res.data.confirmed ? 'confirmed' : 'pending',
        confirmations: res.data.block_height ? 1 : 0,
        details: res.data
      };
    } catch {
      return { status: 'not_found' };
    }
  }
}
