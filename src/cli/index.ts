import { Command } from 'commander';
import { printBanner } from './ui.js';
import { initCommand } from './commands/init.js';
import { balanceCommand } from './commands/balance.js';
import { sendCommand } from './commands/send.js';
import { faucetCommand } from './commands/faucet.js';
import { networkCommand } from './commands/network.js';
import { configCommand } from './commands/config.js';
import { tokenCommand } from './commands/token.js';
import { mcpDaemonCommand } from './commands/mcpDaemon.js';

export function setupCli(): Command {
  const program = new Command();

  program
    .name('mcw')
    .description('Multi-Chain CLI Wallet (MCW) & Agentic Framework for Humans & AI Agents')
    .version('1.0.2');

  program
    .command('init')
    .description('Generate or import a BIP-39 mnemonic, encrypt with AES-256-GCM, and derive multi-chain addresses')
    .action(async () => {
      printBanner();
      await initCommand();
    });

  program
    .command('balance')
    .description('Fetch balances across Bitcoin, Ethereum, Solana, and Tron in active network mode')
    .argument('[chain]', 'Specific chain (btc, eth, sol, trx)')
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
    .description('Manage and query ERC-20 / SPL tokens (USDC, USDT, LINK, custom contracts)')
    .argument('[action]', 'Action (balance | add | send | list | remove)')
    .argument('[token]', 'Token symbol or ID (e.g. usdc-sepolia, link-sepolia)')
    .argument('[amount]', 'Amount to send')
    .argument('[to]', 'Recipient address')
    .action(async (action, token, amount, to) => {
      printBanner();
      await tokenCommand(action, token, amount, to);
    });

  program
    .command('config')
    .description('Configure custom networks, RPC endpoints, and select Tron flavor (Nile vs Shasta)')
    .argument('[action]', 'Action (tron | set-rpc | list | add-chain | remove-chain)')
    .argument('[chain]', 'Chain or Tron flavor (nile | shasta | eth | sol | btc | trx)')
    .argument('[value]', 'RPC URL value')
    .action(async (action, chain, value) => {
      printBanner();
      await configCommand(action, chain, value);
    });

  program
    .command('send')
    .description('Sign and broadcast a transaction with password decryption')
    .argument('[chain]', 'Target chain (btc, eth, sol, trx)')
    .argument('[amount]', 'Amount to send')
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
