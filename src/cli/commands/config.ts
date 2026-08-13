import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  getNetworkMode,
  SupportedChain,
  NetworkMode,
  saveCustomNetwork,
  setTronTestnetFlavor,
  getChainConfig,
  loadCustomNetworks,
} from '../../config/chains.js';

export async function configCommand(action?: string, chainArg?: string, valueArg?: string): Promise<void> {
  // Shortcut: mcw config tron [nile|shasta]
  if (action === 'tron' && chainArg) {
    const flavor = chainArg.toLowerCase();
    if (flavor !== 'nile' && flavor !== 'shasta') {
      console.log(chalk.red("\n❌ Invalid Tron flavor. Choose 'nile' or 'shasta'.\n"));
      return;
    }
    setTronTestnetFlavor(flavor as 'nile' | 'shasta');
    console.log(chalk.green(`\n✅ Tron testnet network set to: ${chalk.bold(flavor.toUpperCase())}\n`));
    return;
  }

  // Shortcut: mcw config list
  if (action === 'list') {
    renderConfigTable();
    return;
  }

  // Shortcut: mcw config set-rpc <chain> <url>
  if (action === 'set-rpc' && chainArg && valueArg) {
    const mode = getNetworkMode();
    const chain = chainArg.toLowerCase() as SupportedChain;
    saveCustomNetwork(chain, mode, { rpcUrl: valueArg });
    console.log(chalk.green(`\n✅ Updated ${chain.toUpperCase()} (${mode}) RPC URL to: ${chalk.bold(valueArg)}\n`));
    return;
  }

  // Interactive Configuration Menu
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: '⚙️  Multi-Chain Wallet Configuration:',
      choices: [
        { name: '⚡ Select Tron Testnet (Nile vs Shasta)', value: 'tron_flavor' },
        { name: '🌐 Set Custom RPC Endpoint for a Chain', value: 'custom_rpc' },
        { name: '📋 View All Active Network Configs & Overrides', value: 'list_configs' },
        { name: '🔄 Reset All Overrides to Default', value: 'reset_defaults' },
      ],
    },
  ]);

  if (choice === 'tron_flavor') {
    const { flavor } = await inquirer.prompt([
      {
        type: 'list',
        name: 'flavor',
        message: 'Select preferred Tron testnet network:',
        choices: [
          { name: 'Tron Nile Testnet (https://nile.trongrid.io)', value: 'nile' },
          { name: 'Tron Shasta Testnet (https://api.shasta.trongrid.io)', value: 'shasta' },
        ],
      },
    ]);
    setTronTestnetFlavor(flavor);
    console.log(chalk.green(`\n✅ Tron testnet set to: ${chalk.bold(flavor.toUpperCase())}\n`));
  } else if (choice === 'custom_rpc') {
    const mode = getNetworkMode();
    const { chain, rpcUrl } = await inquirer.prompt([
      {
        type: 'list',
        name: 'chain',
        message: `Select chain to configure (${mode.toUpperCase()}):`,
        choices: [
          { name: 'Ethereum / EVM', value: 'eth' },
          { name: 'Solana', value: 'sol' },
          { name: 'Bitcoin', value: 'btc' },
          { name: 'Tron', value: 'trx' },
        ],
      },
      {
        type: 'input',
        name: 'rpcUrl',
        message: 'Enter custom RPC endpoint URL (e.g. your Alchemy, QuickNode, or custom node):',
        validate: (input: string) => {
          if (!input.startsWith('http://') && !input.startsWith('https://')) {
            return 'Please enter a valid HTTP/HTTPS URL.';
          }
          return true;
        },
      },
    ]);

    saveCustomNetwork(chain as SupportedChain, mode, { rpcUrl });
    console.log(chalk.green(`\n✅ Saved custom RPC for ${chain.toUpperCase()} (${mode}): ${chalk.bold(rpcUrl)}\n`));
  } else if (choice === 'list_configs') {
    renderConfigTable();
  } else if (choice === 'reset_defaults') {
    // Overwrite custom networks file
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const file = path.join(os.homedir(), '.mcw', 'custom_networks.json');
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    console.log(chalk.green('\n✅ All network configurations reset to factory defaults.\n'));
  }
}

function renderConfigTable(): void {
  const mode = getNetworkMode();
  const chains: SupportedChain[] = ['btc', 'eth', 'sol', 'trx'];

  const table = new Table({
    head: [
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Environment'),
      chalk.cyan.bold('Network Name'),
      chalk.cyan.bold('Active RPC Endpoint'),
      chalk.cyan.bold('Custom?'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const chain of chains) {
    const config = getChainConfig(chain, mode);
    table.push([
      chain.toUpperCase(),
      mode.toUpperCase(),
      config.networkName,
      chalk.yellow(config.rpcUrl),
      config.isCustom ? chalk.green.bold('YES (Custom)') : chalk.gray('Default'),
    ]);
  }

  console.log(chalk.bold.white(`\n📋 Active Network Configurations (${mode.toUpperCase()}):\n`));
  console.log(table.toString());
  console.log('');
}
