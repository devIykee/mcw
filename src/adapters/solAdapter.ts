import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import {
  BaseChainAdapter,
  BalanceResult,
  TransactionPayload,
  BuiltTransaction,
  BroadcastResult,
  FaucetResult
} from './base.js';
import { getChainConfig, NetworkMode } from '../config/chains.js';

export interface SolTokenBalanceResult {
  symbol: string;
  name?: string;
  contractAddress: string;
  walletAddress: string;
  balanceFormatted: string;
  balanceRaw: string;
  decimals: number;
  network: string;
}

export class SolanaAdapter extends BaseChainAdapter {
  private connection: Connection;

  constructor(mode?: NetworkMode) {
    const config = getChainConfig('sol', mode);
    super(config);
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  async getBalance(address: string): Promise<BalanceResult> {
    const pubkey = new PublicKey(address);
    const lamports = await this.connection.getBalance(pubkey);
    const sol = lamports / LAMPORTS_PER_SOL;

    return {
      chain: 'sol',
      chainName: this.config.name,
      address,
      balanceFormatted: sol.toFixed(6),
      balanceRaw: lamports.toString(),
      symbol: this.config.symbol,
      network: this.config.networkName
    };
  }

  /**
   * Query SPL Token Balance (e.g. USDC on Solana Devnet/Mainnet)
   */
  async getSPLBalance(mintAddress: string, walletAddress: string, explicitDecimals: number = 6): Promise<SolTokenBalanceResult> {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(mintAddress);

      const accounts = await this.connection.getParsedTokenAccountsByOwner(walletPubkey, {
        mint: mintPubkey,
      });

      let totalAmount = 0;
      let rawAmount = '0';
      let decimals = explicitDecimals;

      for (const acc of accounts.value) {
        const tokenAmount = acc.account.data.parsed.info.tokenAmount;
        totalAmount += tokenAmount.uiAmount || 0;
        rawAmount = (BigInt(rawAmount) + BigInt(tokenAmount.amount)).toString();
        decimals = tokenAmount.decimals;
      }

      return {
        symbol: 'USDC',
        name: 'SPL Token',
        contractAddress: mintAddress,
        walletAddress,
        balanceFormatted: totalAmount.toFixed(4),
        balanceRaw: rawAmount,
        decimals,
        network: this.config.networkName,
      };
    } catch (err: any) {
      return {
        symbol: 'SPL',
        name: 'SPL Token',
        contractAddress: mintAddress,
        walletAddress,
        balanceFormatted: '0.0000',
        balanceRaw: '0',
        decimals: explicitDecimals,
        network: this.config.networkName,
      };
    }
  }

  async buildTransaction(fromAddress: string, payload: TransactionPayload): Promise<BuiltTransaction> {
    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = new PublicKey(payload.to);
    const lamports = Math.round(parseFloat(payload.amount) * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    const latestBlockhash = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = fromPubkey;

    const estimatedFee = '0.000005 SOL';

    return {
      chain: 'sol',
      to: payload.to,
      amount: payload.amount,
      estimatedFee,
      rawPayload: {
        serializedTx: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      summary: `Send ${payload.amount} ${this.config.symbol} to ${payload.to} on ${this.config.networkName} (Est. Fee: ${estimatedFee})`
    };
  }

  async signAndSendTransaction(privateKey: string, builtTx: BuiltTransaction): Promise<BroadcastResult> {
    const secretKey = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(secretKey);

    const txBuffer = Buffer.from(builtTx.rawPayload.serializedTx, 'base64');
    const transaction = Transaction.from(txBuffer);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );

    return {
      chain: 'sol',
      txHash: signature,
      explorerUrl: `${this.config.explorerTxUrl.replace('/tx/', `/tx/${signature}`)}`,
      status: 'confirmed',
      amount: builtTx.amount,
      recipient: builtTx.to
    };
  }

  async requestFaucet(address: string): Promise<FaucetResult> {
    if (this.config.networkMode === 'mainnet') {
      return {
        chain: 'sol',
        success: false,
        message: 'Faucets are not available for Solana Mainnet (Real Assets).'
      };
    }

    try {
      const pubkey = new PublicKey(address);
      const airdropSignature = await this.connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
      const latestBlockhash = await this.connection.getLatestBlockhash();
      
      await this.connection.confirmTransaction({
        signature: airdropSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });

      return {
        chain: 'sol',
        success: true,
        message: 'Successfully airdropped 1.0 Devnet SOL!',
        txHash: airdropSignature,
        instructionsUrl: `${this.config.explorerTxUrl.replace('/tx/', `/tx/${airdropSignature}`)}`
      };
    } catch (error: any) {
      return {
        chain: 'sol',
        success: false,
        message: `Devnet airdrop rate limit reached. Use official web faucet: ${this.config.faucetUrl}`,
        instructionsUrl: this.config.faucetUrl
      };
    }
  }

  async getTransactionStatus(txHash: string): Promise<{ status: string; confirmations?: number; details?: any }> {
    const status = await this.connection.getSignatureStatus(txHash, { searchTransactionHistory: true });
    if (!status || !status.value) {
      return { status: 'not_found' };
    }
    return {
      status: status.value.err ? 'failed' : (status.value.confirmationStatus || 'confirmed'),
      confirmations: status.value.confirmations ?? undefined,
      details: status.value
    };
  }
}
