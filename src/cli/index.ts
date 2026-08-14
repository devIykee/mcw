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
import { mcpDaemonCommand } from './commands/mcpDaemon.js';

function getPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '1.0.8';
    }
  } catch {}
  return '1.0.8';
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
  $ mcw token add                Launch interactive wizard to add any ERC-20, SPL, or TRC-20 token
  $ mcw token send               Interactively send tokens with fee estimation & password signing
  $ mcw config                   Add custom EVM chains / L2s, set custom RPCs, or toggle Tron flavor
  $ mcw network mainnet          Switch between testnet and mainnet
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
    .addHelpText(
      'after',
      `
Examples:
  $ mcw balance                  Query all native chains and custom EVM L2s
  $ mcw balance eth              Query Ethereum / Sepolia native balance
  $ mcw balance sol              Query Solana Devnet / Mainnet SOL balance
  $ mcw balance trx              Query Tron Nile / Shasta / Mainnet TRX balance
`
    )
    .action(async (chain) => {
      printBanner();
      await balanceCommand(chain);
    });

  program
    .command('network')
    .description('View or switch active network mode (testnet or mainnet)')
    .argument('[mode]', 'Target mode (testnet | mainnet)')
    .addHelpText(
      'after',
      `
Examples:
  $ mcw network                  Show active network mode
  $ mcw network testnet          Switch to risk-free testnets (Sepolia, Devnet, Nile/Shasta, Testnet3)
  $ mcw network mainnet          Switch to live Mainnet (Real Assets)
`
    )
    .action(async (mode) => {
      printBanner();
      await networkCommand(mode);
    });

  program
    .command('token')
    .description('Manage and query smart contract tokens across ERC-20 (EVM), SPL (Solana), and TRC-20 (Tron)')
    .argument('[action]', 'Action to perform (balance | add | send | list | remove)')
    .argument('[token]', 'Token symbol or ID (e.g. usdc-sepolia, usdt-trx, link-sepolia)')
    .argument('[amount]', 'Amount of tokens to send')
    .argument('[to]', 'Recipient wallet address')
    .addHelpText(
      'after',
      `
Available Actions:
  balance [token]                Fetch live token balances across all chains or for a specific token
  add                            Interactive wizard to register a new token contract
  send [token] [amount] [to]     Send tokens with password approval
  list                           List all configured tokens (Built-in and Custom)
  remove <tokenId>               Delete a custom token from tracking

Examples:
  $ mcw token                    Open interactive token management menu
  $ mcw token list               Display all tracked ERC-20, SPL, and TRC-20 tokens
  $ mcw token balance            Query live balances for all configured tokens
  $ mcw token balance usdc-eth   Query balance for a specific token
  $ mcw token add                Launch step-by-step wizard to track any token contract
  $ mcw token send               Interactively select a token, enter recipient & amount, and sign
  $ mcw token send usdc-eth 10 0x0f0B...   Transfer 10 Sepolia USDC to recipient
  $ mcw token send usdt-trx 50 TQ7zfy...   Transfer 50 Shasta/Nile USDT to Tron recipient
`
    )
    .action(async (action, token, amount, to) => {
      printBanner();
      await tokenCommand(action, token, amount, to);
    });

  program
    .command('config')
    .description('Configure custom networks, RPC endpoints, add Custom EVM chains, and select Tron flavor (Nile vs Shasta)')
    .argument('[action]', 'Action (tron | set-rpc | list | add-chain | remove-chain)')
    .argument('[chain]', 'Chain or Tron flavor (nile | shasta | eth | sol | btc | trx)')
    .argument('[value]', 'RPC URL value')
    .addHelpText(
      'after',
      `
Available Actions:
  tron <nile|shasta>             Switch Tron testnet between Nile and Shasta
  set-rpc <chain> <url>          Override RPC URL for a built-in chain
  list                           Display all active network configs, custom RPCs, and custom chains
  add-chain                      Interactive wizard to add custom EVM chains (Base, Polygon, Arbitrum, BSC, Localhost 8545)
  remove-chain <chainId>         Remove a registered custom chain

Examples:
  $ mcw config                   Open interactive network configuration menu
  $ mcw config tron shasta       Switch Tron testnet to Shasta (api.shasta.trongrid.io)
  $ mcw config tron nile         Switch Tron testnet to Nile (nile.trongrid.io)
  $ mcw config set-rpc eth https://your-alchemy-node.com
  $ mcw config list              View active network parameters
`
    )
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
    .addHelpText(
      'after',
      `
Examples:
  $ mcw send                     Launch interactive send wizard
  $ mcw send sol 0.5 4HVvPD...   Send 0.5 SOL
  $ mcw send eth 0.01 0x0f0B...  Send 0.01 ETH
  $ mcw send trx 50 TQ7zfy...    Send 50 TRX
`
    )
    .action(async (chain, amount, to) => {
      printBanner();
      await sendCommand(chain, amount, to);
    });

  program
    .command('faucet')
    .description('Request testnet funds/airdrop from faucets (Testnet mode only)')
    .argument('[chain]', 'Target chain (btc, eth, sol, trx)')
    .addHelpText(
      'after',
      `
Examples:
  $ mcw faucet sol               Request instant 1.0 SOL airdrop on Solana Devnet
  $ mcw faucet eth               Get Sepolia ETH faucet instructions & URL
  $ mcw faucet trx               Get Tron Nile/Shasta faucet portal URL
`
    )
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
