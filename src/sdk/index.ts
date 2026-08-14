import { deriveAllKeys, DerivedKeyInfo, generateMnemonic, validateMnemonic } from '../crypto/keyDerivation.js';
import { encryptData, decryptData, EncryptedPayload } from '../crypto/cipher.js';
import { walletExists, saveVaultFile, loadVaultFile, unlockVault, getWalletAddress } from '../crypto/storage.js';
import { getChainAdapter, EthereumAdapter, TronAdapter, SolanaAdapter, BitcoinAdapter } from '../adapters/index.js';
import { NetworkMode, getNetworkMode, setNetworkMode, getChainConfig, getAllChains } from '../config/chains.js';
import { getAllTokens, findToken, saveCustomToken, TokenConfig } from '../config/tokens.js';
import { PolicyEngine, PolicyConfig, loadPolicies, savePolicies } from '../policy/policyEngine.js';
import { TransactionSimulator, SimulationResult } from '../simulation/simulator.js';
import { HistoryManager, HistoryEntry } from '../history/historyManager.js';
import { DexSwapper, SwapQuote } from '../dex/swapper.js';
import { SafeManager, SafeTransactionProposal } from '../safe/safeManager.js';
import { approvalGate, ApprovalGateManager, PendingTransaction } from '../mcp/approvalGate.js';

export class McwWallet {
  private mnemonic?: string;
  private networkMode: NetworkMode;

  constructor(mnemonic?: string, mode?: NetworkMode) {
    this.mnemonic = mnemonic;
    this.networkMode = mode || getNetworkMode();
  }

  /**
   * Derive addresses for all chains
   */
  getAddresses(): Record<string, string> {
    if (this.mnemonic) {
      const keys = deriveAllKeys(this.mnemonic, undefined, this.networkMode);
      return {
        btc: keys.btc.address,
        eth: keys.eth.address,
        sol: keys.sol.address,
        trx: keys.trx.address,
      };
    }
    return {
      btc: getWalletAddress('btc', this.networkMode),
      eth: getWalletAddress('eth', this.networkMode),
      sol: getWalletAddress('sol', this.networkMode),
      trx: getWalletAddress('trx', this.networkMode),
    };
  }

  /**
   * Get balance for a chain
   */
  async getBalance(chain: string) {
    const adapter = getChainAdapter(chain, this.networkMode);
    const addr = this.getAddresses()[chain.toLowerCase()] || getWalletAddress(chain, this.networkMode);
    return adapter.getBalance(addr);
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenSymbolOrAddress: string, chain: string = 'eth') {
    const adapter = getChainAdapter(chain, this.networkMode);
    const token = findToken(tokenSymbolOrAddress, this.networkMode, chain);
    const contract = token ? token.contractAddress : tokenSymbolOrAddress;
    const decimals = token ? token.decimals : 18;
    const walletAddr = this.getAddresses()[chain.toLowerCase()] || getWalletAddress(chain, this.networkMode);

    if (adapter instanceof EthereumAdapter) {
      return adapter.getERC20Balance(contract, walletAddr, decimals);
    }
    if (adapter instanceof TronAdapter) {
      return adapter.getTRC20Balance(contract, walletAddr, decimals);
    }
    if (adapter instanceof SolanaAdapter) {
      return adapter.getSPLBalance(contract, walletAddr, decimals);
    }
    throw new Error(`Token balances not supported on chain: ${chain}`);
  }

  /**
   * Simulate a transaction
   */
  async simulate(chain: string, to: string, amount: string, data: string = '0x'): Promise<SimulationResult> {
    const from = this.getAddresses()[chain.toLowerCase()] || getWalletAddress(chain, this.networkMode);
    if (chain === 'sol') {
      return TransactionSimulator.simulateSolana(this.networkMode, from, to, amount);
    }
    return TransactionSimulator.simulateEVM(chain, this.networkMode, from, to, amount, data);
  }

  /**
   * Get swap quote
   */
  async getSwapQuote(chain: string, fromToken: string, toToken: string, amount: string): Promise<SwapQuote> {
    return DexSwapper.getQuote(chain, this.networkMode, fromToken, toToken, amount);
  }

  /**
   * Propose a Gnosis Safe transaction
   */
  async proposeSafe(safeAddress: string, to: string, amount: string, data: string = '0x'): Promise<SafeTransactionProposal> {
    return SafeManager.proposeTransaction(safeAddress, 'eth', this.networkMode, to, amount, data);
  }

  /**
   * Query local audit memory
   */
  getHistory(limit: number = 20): HistoryEntry[] {
    return HistoryManager.getHistory({ networkMode: this.networkMode, limit });
  }
}

export {
  deriveAllKeys,
  generateMnemonic,
  validateMnemonic,
  encryptData,
  decryptData,
  walletExists,
  saveVaultFile,
  loadVaultFile,
  unlockVault,
  getWalletAddress,
  getChainAdapter,
  EthereumAdapter,
  TronAdapter,
  SolanaAdapter,
  BitcoinAdapter,
  PolicyEngine,
  TransactionSimulator,
  HistoryManager,
  DexSwapper,
  SafeManager,
  approvalGate,
  ApprovalGateManager,
  findToken,
  getAllTokens,
  saveCustomToken,
};
