import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import { getChainConfig, NetworkMode } from '../config/chains.js';

export interface SimulationResult {
  chain: string;
  network: string;
  status: 'SUCCESS' | 'REVERTED' | 'FAILED';
  gasOrFeeEstimated: string;
  assetDeltas: Array<{
    asset: string;
    delta: string; // e.g. "-0.1 ETH" or "+300 USDC"
    direction: 'OUT' | 'IN';
  }>;
  executionLogs: string[];
  revertReason?: string;
  rawDetails?: any;
}

export class TransactionSimulator {
  /**
   * Simulate an EVM transaction (Dry-run via eth_call + estimateGas)
   */
  static async simulateEVM(
    chain: string,
    mode: NetworkMode,
    fromAddress: string,
    toAddress: string,
    amountEth: string,
    data: string = '0x'
  ): Promise<SimulationResult> {
    const config = getChainConfig(chain, mode);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);

    const tx: ethers.TransactionRequest = {
      from: fromAddress,
      to: toAddress,
      value: ethers.parseEther(amountEth || '0'),
      data,
    };

    const logs: string[] = [];
    logs.push(`[EVM Simulator] Simulating call from ${fromAddress} to ${toAddress}`);
    logs.push(`[EVM Simulator] Value: ${amountEth} ${config.symbol}, Data size: ${(data.length - 2) / 2} bytes`);

    try {
      // 1. Dry run call via eth_call
      const callResult = await provider.call(tx);
      logs.push(`[EVM Simulator] eth_call returned: ${callResult || '0x (Empty return)'}`);

      // 2. Gas estimation
      let gasEstimate = 21000n;
      try {
        gasEstimate = await provider.estimateGas(tx);
      } catch (gasErr: any) {
        logs.push(`[EVM Simulator] Warning on gas estimation: ${gasErr.message}`);
      }

      const feeData = await provider.getFeeData();
      const feeWei = gasEstimate * (feeData.gasPrice || ethers.parseUnits('20', 'gwei'));
      const feeEth = ethers.formatEther(feeWei);

      return {
        chain,
        network: config.networkName,
        status: 'SUCCESS',
        gasOrFeeEstimated: `${parseFloat(feeEth).toFixed(6)} ${config.symbol} (${gasEstimate.toString()} gas)`,
        assetDeltas: [
          {
            asset: config.symbol,
            delta: `-${amountEth} ${config.symbol}`,
            direction: 'OUT',
          },
        ],
        executionLogs: logs,
        rawDetails: { gasEstimate: gasEstimate.toString(), callResult },
      };
    } catch (err: any) {
      logs.push(`[EVM Simulator] Call reverted: ${err.message}`);
      return {
        chain,
        network: config.networkName,
        status: 'REVERTED',
        gasOrFeeEstimated: '0',
        assetDeltas: [],
        revertReason: err.reason || err.shortMessage || err.message,
        executionLogs: logs,
        rawDetails: err,
      };
    }
  }

  /**
   * Simulate a Solana transaction
   */
  static async simulateSolana(
    mode: NetworkMode,
    fromAddress: string,
    toAddress: string,
    amountSol: string
  ): Promise<SimulationResult> {
    const config = getChainConfig('sol', mode);
    const connection = new Connection(config.rpcUrl, 'confirmed');

    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.round(parseFloat(amountSol) * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add({
      keys: [
        { pubkey: fromPubkey, isSigner: true, isWritable: true },
        { pubkey: toPubkey, isSigner: false, isWritable: true },
      ],
      programId: new PublicKey('11111111111111111111111111111111'),
      data: Buffer.alloc(0),
    });

    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = fromPubkey;

    try {
      const sim = await connection.simulateTransaction(transaction);
      const isSuccess = !sim.value.err;
      const logs = sim.value.logs || [];

      return {
        chain: 'sol',
        network: config.networkName,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        gasOrFeeEstimated: '0.000005 SOL (5,000 lamports)',
        assetDeltas: [
          {
            asset: 'SOL',
            delta: `-${amountSol} SOL`,
            direction: 'OUT',
          },
        ],
        executionLogs: logs,
        revertReason: sim.value.err ? JSON.stringify(sim.value.err) : undefined,
        rawDetails: sim.value,
      };
    } catch (err: any) {
      return {
        chain: 'sol',
        network: config.networkName,
        status: 'FAILED',
        gasOrFeeEstimated: '0.000005 SOL',
        assetDeltas: [],
        revertReason: err.message,
        executionLogs: [err.message],
      };
    }
  }
}
