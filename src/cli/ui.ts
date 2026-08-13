import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { Ora } from 'ora';
import { getNetworkMode } from '../config/chains.js';

export function printBanner(): void {
  const mode = getNetworkMode();

  console.log(
    chalk.cyan.bold(`
  ███╗   ███╗ ██████╗       ████████╗██╗    ██╗ █████╗ ███████╗
  ████╗ ████║██╔════╝       ╚══██╔══╝██║    ██║██╔══██╗██╔════╝
  ██╔████╔██║██║               ██║   ██║ █╗ ██║███████║█████╗  
  ██║╚██╔╝██║██║               ██║   ██║███╗██║██╔══██║██╔══╝  
  ██║ ╚═╝ ██║╚██████╗          ██║   ╚███╔███╔╝██║  ██║██║     
  ╚═╝     ╚═╝ ╚═════╝          ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     
  `)
  );
  console.log(
    chalk.bold.hex('#F59E0B')('  ▶ Multi-Chain Testnet & Mainnet Wallet & Agentic Framework')
  );
  console.log(
    chalk.gray('  ▶ Built for Humans (Rich CLI) & AI Agents (Standard MCP Server)\n')
  );

  if (mode === 'mainnet') {
    console.log(
      chalk.bgRed.white.bold(' ⚠️  MAINNET MODE (REAL ASSETS) ') +
        chalk.red.bold(' Caution: Broadcasting to production mainnets.\n')
    );
  } else {
    console.log(
      chalk.bgGreen.black.bold(' 🟢 TESTNET MODE ') +
        chalk.gray(' Operating on risk-free test networks (Sepolia, Devnet, Nile, Testnet3).\n')
    );
  }
}

export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.white(text),
    color: 'cyan',
  });
}

export function formatChainBadge(chain: string): string {
  switch (chain.toLowerCase()) {
    case 'btc':
      return chalk.bgHex('#F7931A').black.bold(' BTC ');
    case 'eth':
      return chalk.bgHex('#627EEA').white.bold(' ETH ');
    case 'sol':
      return chalk.bgHex('#14F195').black.bold(' SOL ');
    case 'trx':
      return chalk.bgHex('#FF060A').white.bold(' TRX ');
    default:
      return chalk.bgGray.white(` ${chain.toUpperCase()} `);
  }
}

export function renderAddressTable(addresses: Array<{ chain: string; address: string; derivationPath: string; network: string }>): void {
  const table = new Table({
    head: [
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Network'),
      chalk.cyan.bold('Derivation Path'),
      chalk.cyan.bold('Public Address')
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const item of addresses) {
    table.push([
      formatChainBadge(item.chain),
      chalk.white(item.network),
      chalk.yellow(item.derivationPath),
      chalk.green.bold(item.address),
    ]);
  }

  console.log(table.toString());
}

export function renderBalanceTable(balances: Array<{ chain: string; symbol: string; balanceFormatted: string; network: string; address: string }>): void {
  const table = new Table({
    head: [
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Network'),
      chalk.cyan.bold('Balance'),
      chalk.cyan.bold('Address')
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const item of balances) {
    table.push([
      formatChainBadge(item.chain),
      chalk.white(item.network),
      chalk.bold.yellow(`${item.balanceFormatted} ${item.symbol}`),
      chalk.gray(item.address),
    ]);
  }

  console.log(table.toString());
}
