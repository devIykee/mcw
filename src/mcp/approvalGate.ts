import crypto from 'crypto';
import { BuiltTransaction, BroadcastResult, getChainAdapter } from '../adapters/index.js';
import { SupportedChain } from '../config/chains.js';
import { unlockVault, loadVaultFile } from '../crypto/storage.js';
import { deriveAllKeys } from '../crypto/keyDerivation.js';

export interface PendingTransaction {
  id: string;
  createdAt: number;
  chain: SupportedChain;
  fromAddress: string;
  toAddress: string;
  amount: string;
  estimatedFee: string;
  summary: string;
  builtTx: BuiltTransaction;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
}

export class ApprovalGateManager {
  private pendingTxs: Map<string, PendingTransaction> = new Map();
  private sessionDecryptedMnemonic: string | null = null;
  private sessionExpiresAt: number = 0;

  /**
   * Unlocks session for headless / automated testing
   */
  public setSessionMnemonic(mnemonic: string, durationMs: number = 300000): void {
    this.sessionDecryptedMnemonic = mnemonic;
    this.sessionExpiresAt = Date.now() + durationMs;
  }

  public isSessionActive(): boolean {
    return !!this.sessionDecryptedMnemonic && Date.now() < this.sessionExpiresAt;
  }

  public getSessionMnemonic(): string | null {
    if (this.isSessionActive()) {
      return this.sessionDecryptedMnemonic;
    }
    return null;
  }

  /**
   * Registers a built transaction in the approval queue
   */
  public registerPendingTx(
    chain: SupportedChain,
    fromAddress: string,
    builtTx: BuiltTransaction
  ): PendingTransaction {
    const id = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const pendingTx: PendingTransaction = {
      id,
      createdAt: Date.now(),
      chain,
      fromAddress,
      toAddress: builtTx.to,
      amount: builtTx.amount,
      estimatedFee: builtTx.estimatedFee,
      summary: builtTx.summary,
      builtTx,
      status: 'PENDING_APPROVAL'
    };

    this.pendingTxs.set(id, pendingTx);
    return pendingTx;
  }

  public getPendingTx(id: string): PendingTransaction | undefined {
    return this.pendingTxs.get(id);
  }

  public listPendingTxs(): PendingTransaction[] {
    return Array.from(this.pendingTxs.values()).filter(tx => tx.status === 'PENDING_APPROVAL');
  }

  /**
   * Approves and executes a transaction using the provided password or active session
   */
  public async executeTransaction(
    pendingTxId: string,
    password?: string
  ): Promise<BroadcastResult> {
    const pending = this.pendingTxs.get(pendingTxId);
    if (!pending) {
      throw new Error(`Pending transaction ${pendingTxId} not found.`);
    }

    if (pending.status !== 'PENDING_APPROVAL') {
      throw new Error(`Transaction ${pendingTxId} is already in status: ${pending.status}`);
    }

    let mnemonic: string | null = this.getSessionMnemonic();

    if (!mnemonic) {
      if (!password) {
        throw new Error(
          `Human approval required. Provide 'password' to authorize decryption and broadcast of ${pendingTxId}.`
        );
      }
      mnemonic = unlockVault(password);
    }

    // Derive private key for target chain
    const keys = deriveAllKeys(mnemonic);
    const privateKey =
      pending.chain === 'btc'
        ? keys.btc.privateKey
        : pending.chain === 'sol'
        ? keys.sol.privateKey
        : pending.chain === 'trx'
        ? keys.trx.privateKey
        : keys.eth.privateKey;

    const adapter = getChainAdapter(pending.chain);
    const result = await adapter.signAndSendTransaction(privateKey, pending.builtTx);

    pending.status = 'APPROVED';
    return result;
  }
}

export const approvalGate = new ApprovalGateManager();
