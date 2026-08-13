import { z } from 'zod';

export const SupportedChainSchema = z.enum(['btc', 'eth', 'sol', 'trx']);

export const GetAddressesInputSchema = z.object({}).describe('Fetch all derived public testnet addresses for Bitcoin, Ethereum, Solana, and Tron.');

export const GetBalanceInputSchema = z.object({
  chain: SupportedChainSchema.optional().describe('Specific chain to query (btc, eth, sol, trx). If omitted, returns balances for all chains.')
});

export const GetTransactionStatusInputSchema = z.object({
  chain: SupportedChainSchema.describe('The target blockchain (btc, eth, sol, trx)'),
  txHash: z.string().describe('The transaction hash / signature to query')
});

export const RequestFaucetInputSchema = z.object({
  chain: SupportedChainSchema.describe('The target blockchain to request testnet tokens for (btc, eth, sol, trx)')
});

export const BuildTransactionInputSchema = z.object({
  chain: SupportedChainSchema.describe('Target testnet blockchain (btc, eth, sol, trx)'),
  to: z.string().describe('Recipient address on the target testnet'),
  amount: z.string().describe('Amount of testnet coins to send (e.g. "0.01")'),
  data: z.string().optional().describe('Optional transaction data (e.g. hex data for EVM or memo for Solana)')
});

export const SignAndSendTransactionInputSchema = z.object({
  pendingTxId: z.string().optional().describe('ID of a previously built transaction awaiting approval'),
  chain: SupportedChainSchema.optional().describe('Target blockchain (if creating and sending directly with session auth)'),
  to: z.string().optional().describe('Recipient address (if creating and sending directly with session auth)'),
  amount: z.string().optional().describe('Amount to send (if creating and sending directly with session auth)'),
  approvalPassword: z.string().optional().describe('User password to decrypt vault and authorize immediate broadcast')
});

export const ApproveTransactionInputSchema = z.object({
  pendingTxId: z.string().describe('ID of the pending transaction to approve'),
  password: z.string().describe('User password to authorize decryption and broadcast')
});
