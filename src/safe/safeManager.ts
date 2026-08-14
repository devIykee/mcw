import { ethers } from 'ethers';
import { NetworkMode, getChainConfig } from '../config/chains.js';

export interface SafeTransactionProposal {
  safeAddress: string;
  chain: string;
  networkMode: NetworkMode;
  to: string;
  value: string;
  data: string;
  operation: number; // 0 = Call, 1 = DelegateCall
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
  safeTxHash: string;
  typedDataPayload: any;
  summary: string;
}

export class SafeManager {
  /**
   * Formulate and build a Gnosis Safe transaction proposal with EIP-712 typed data
   */
  static async proposeTransaction(
    safeAddress: string,
    chain: string,
    mode: NetworkMode,
    to: string,
    valueEth: string,
    data: string = '0x',
    operation: number = 0
  ): Promise<SafeTransactionProposal> {
    const config = getChainConfig(chain, mode);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);

    // Fetch Safe nonce
    let nonce = 0;
    try {
      const safeContract = new ethers.Contract(
        safeAddress,
        ['function nonce() view returns (uint256)'],
        provider
      );
      nonce = Number(await safeContract.nonce());
    } catch {
      nonce = Math.floor(Date.now() / 1000) % 1000;
    }

    const valueWei = ethers.parseEther(valueEth || '0').toString();

    // EIP-712 Domain
    const domain = {
      chainId: config.chainId,
      verifyingContract: safeAddress,
    };

    // EIP-712 Types
    const types = {
      SafeTx: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const message = {
      to,
      value: valueWei,
      data,
      operation,
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce,
    };

    // Calculate SafeTxHash
    const safeTxHash = ethers.TypedDataEncoder.hash(domain, types, message);

    return {
      safeAddress,
      chain,
      networkMode: mode,
      to,
      value: valueEth,
      data,
      operation,
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce,
      safeTxHash,
      typedDataPayload: { domain, types, message },
      summary: `Safe Proposal: Send ${valueEth} ${config.symbol} from Multisig ${safeAddress} to ${to} (Nonce: ${nonce}, SafeTxHash: ${safeTxHash.substring(0, 10)}...)`,
    };
  }
}
