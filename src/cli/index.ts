import { Command } from 'commander';
import { printBanner } from './ui.js';
import { initCommand } from './commands/init.js';
import { balanceCommand } from './commands/balance.js';
import { sendCommand } from './commands/send.js';
import { faucetCommand } from './commands/faucet.js';
import { networkCommand } from './commands/network.js';
import { mcpDaemonCommand } from './commands/mcpDaemon.js';

export function setupCli(): Command {
  const program = new Command();

  program
    .name('mc-twaf')
    .description('Multi-Chain Testnet & Mainnet Wallet & Agentic Framework for Humans & AI Agents')
    .version('1.1.0');

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
