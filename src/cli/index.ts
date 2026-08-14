import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { printBanner } from './ui.js';
import { initCommand } from './commands/init.js';
import { balanceCommand } from './commands/balance.js';
import { sendCommand } from './commands/send.js';
import { faucetCommand } from './commands/faucet.js';
import { networkCommand } from './commands/network.js';
import { configCommand } from './commands/config.js';
import { tokenCommand } from './commands/token.js';
import { swapCommand } from './commands/swap.js';
import { policyCommand } from './commands/policy.js';
import { historyCommand } from './commands/history.js';
import { safeCommand } from './commands/safe.js';
import { mcpDaemonCommand } from './commands/mcpDaemon.js';

function getPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '1.1.0';
    }
  } catch {}
  return '1.1.0';
}

export function setupCli(): Command {
  const program = new Command();

  program
    .name('mcw')
    .description('Multi-Chain CLI Wallet (MCW) & Agentic Framework for Humans & AI Agents')
    .version(getPackageVersion())
    .addHelpText(
      'after',
      `
Examples:
  $ mcw init                     Initialize or restore a multi-chain wallet
  $ mcw balance                  View native balances across BTC, ETH, SOL, TRX & Custom Chains
  $ mcw token balance            View balances for all tracked tokens (USDC, USDT, LINK, etc.)
  $ mcw token add <contract>     Auto-detect and track any token from smart contract on-chain
  $ mcw swap 0.1 ETH USDC        Find optimal DEX route (Uniswap / Jupiter) and execute swap
  $ mcw policy                   Configure spend limits, whitelists, and agent safety guardrails
  $ mcw history                  View local audit log and agent transaction memory
  $ mcw safe propose <safe> <to> Propose a multi-sig transaction for Gnosis Safe
  $ mcw mcp                      Start JSON-RPC Model Context Protocol (MCP) server for AI agents
`
    );

  program
    .command('init')
    .description('Generate or import a BIP-39 mnemonic, encrypt with AES-256-GCM, and derive multi-chain addresses')
    .action(async () => {
      printBanner();
      await initCommand();
    });

  program
    .command('balance')
    .description('Fetch live balances across Bitcoin, Ethereum, Solana, Tron, and registered Custom EVM Chains')
    .argument('[chain]', 'Specific chain (btc, eth, sol, trx, or custom chain id)')
    .action(async (chain) => {
      printBanner();
      await balanceCommand(chain);
    });

  program
    .command('network')
    .description('View or switch active network mode (testnet or mainnet)')
    .argument('[mode]', 'Target mode (testnet | mainnet)')
    .action(async (mode) => {
      printBanner();
      await networkCommand(mode);
    });

  program
    .command('token')
    .description('Manage and query smart contract tokens across ERC-20 (EVM), SPL (Solana), and TRC-20 (Tron)')
    .argument('[action]', 'Action to perform (balance | add | send | list | remove)')
    .argument('[token]', 'Token symbol, ID, or contract address')
    .argument('[amount]', 'Amount of tokens to send')
    .argument('[to]', 'Recipient wallet address')
    .action(async (action, token, amount, to) => {
      printBanner();
      await tokenCommand(action, token, amount, to);
    });

  program
    .command('swap')
    .description('DEX Aggregator: Get quotes and swap tokens via Uniswap V3 (EVM) or Jupiter (Solana)')
    .argument('[amount]', 'Amount to sell')
    .argument('[fromToken]', 'Token to sell (e.g. ETH, SOL, USDC)')
    .argument('[toToken]', 'Token to buy (e.g. USDC, LINK, USDT)')
    .argument('[chain]', 'Target chain (eth, sol)')
    .addHelpText(
      'after',
      `
Examples:
  $ mcw swap                     Launch interactive DEX swap wizard
  $ mcw swap 0.1 ETH USDC        Swap 0.1 ETH for USDC on Ethereum / Sepolia (Uniswap V3)
  $ mcw swap 0.5 SOL USDC sol    Swap 0.5 SOL for USDC on Solana (Jupiter Aggregator)
`
    )
    .action(async (amount, fromToken, toToken, chain) => {
      printBanner();
      await swapCommand(amount, fromToken, toToken, chain);
    });

  program
    .command('policy')
    .description('Configure spend limits, 24h rolling caps, address whitelists/blacklists, and agent guardrails')
    .argument('[action]', 'Action (list | set-limit | whitelist | blacklist | toggle)')
    .argument('[chain]', 'Chain (eth, sol, btc, trx)')
    .argument('[val1]', 'Max spend per tx, or address')
    .argument('[val2]', 'Daily rolling spend limit')
    .addHelpText(
      'after',
      `
Examples:
  $ mcw policy                   Interactive policy guardrails menu
  $ mcw policy list              View all spend limits, whitelists, and blacklists
  $ mcw policy set-limit eth 0.5 2.0  Set ETH limits: max 0.5/tx, max 2.0 daily
  $ mcw policy whitelist eth 0x123... Add trusted address to Whitelist
  $ mcw policy blacklist eth 0xScam.. Add malicious address to Blacklist
  $ mcw policy toggle            Enable or disable policy enforcement
`
    )
    .action(async (action, chain, val1, val2) => {
      printBanner();
      await policyCommand(action, chain, val1, val2);
    });

  program
    .command('history')
    .description('View local audit logs, agent transaction memory, and past broadcasts')
    .argument('[chain]', 'Optional chain filter (eth, sol, btc, trx)')
    .argument('[limit]', 'Maximum entries to display (default: 15)')
    .addHelpText(
      'after',
      `
Examples:
  $ mcw history                  View recent transaction audit logs
  $ mcw history eth              View Ethereum transaction history
  $ mcw history 5                Show last 5 transactions
`
    )
    .action(async (chain, limit) => {
      printBanner();
      await historyCommand(chain, limit);
    });

  program
    .command('safe')
    .description('Gnosis Safe multisig transaction proposal and EIP-712 typed data generator')
    .argument('[action]', 'Action (propose)')
    .argument('[safeAddress]', 'Safe multisig contract address (0x...)')
    .argument('[to]', 'Destination recipient address')
    .argument('[amount]', 'Amount in ETH')
    .argument('[data]', 'Optional calldata hex')
    .addHelpText(
      'after',
      `
Examples:
  $ mcw safe                     Interactive Safe multisig proposal wizard
  $ mcw safe propose 0xSafe... 0xRecipient... 0.1  Propose 0.1 ETH transfer for multisig approval
`
    )
    .action(async (action, safeAddress, to, amount, data) => {
      printBanner();
      await safeCommand(action, safeAddress, to, amount, data);
    });

  program
    .command('config')
    .description('Configure custom networks, RPC endpoints, add Custom EVM chains, and select Tron flavor')
    .argument('[action]', 'Action (tron | set-rpc | list | add-chain | remove-chain)')
    .argument('[chain]', 'Chain or Tron flavor (nile | shasta | eth | sol | btc | trx)')
    .argument('[value]', 'RPC URL value')
    .action(async (action, chain, value) => {
      printBanner();
      await configCommand(action, chain, value);
    });

  program
    .command('send')
    .description('Sign and broadcast native coin transactions (BTC, ETH, SOL, TRX) with password decryption')
    .argument('[chain]', 'Target chain (btc, eth, sol, trx, or custom chain id)')
    .argument('[amount]', 'Amount in human units (e.g. 0.01)')
    .argument('[to]', 'Recipient address')
    .action(async (chain, amount, to) => {
      printBanner();
      await sendCommand(chain, amount, to);
    });

  program
    .command('faucet')
    .description('Request testnet funds/airdrop from faucets (Testnet mode only)')
    .argument('[chain]', 'Target chain (btc, eth, sol, trx)')
    .action(async (chain) => {
      printBanner();
      await faucetCommand(chain);
    });

  program
    .command('mcp')
    .description('Start the Model Context Protocol (MCP) server daemon on stdio for AI agent pairing')
    .action(async () => {
      await mcpDaemonCommand();
    });

  return program;
}
