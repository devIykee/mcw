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
  addCustomChain,
  removeCustomChain,
  loadCustomChains,
  getAllChains,
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

  // Shortcut: mcw config remove-chain <id>
  if (action === 'remove-chain' && chainArg) {
    const deleted = removeCustomChain(chainArg);
    if (deleted) {
      console.log(chalk.green(`\n✅ Removed custom chain '${chainArg}'.\n`));
    } else {
      console.log(chalk.yellow(`\n⚠️  Custom chain '${chainArg}' not found.\n`));
    }
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
        { name: '🌐 Set Custom RPC Endpoint for Existing Chain', value: 'custom_rpc' },
        { name: '➕ Add New Custom EVM Chain / L2 / Local Node', value: 'add_custom_chain' },
        { name: '🗑️  Remove a Custom Chain', value: 'remove_custom_chain' },
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
    const availableChains = getAllChains(mode);
    const { chain, rpcUrl } = await inquirer.prompt([
      {
        type: 'list',
        name: 'chain',
        message: `Select chain to configure (${mode.toUpperCase()}):`,
        choices: availableChains.map((c) => ({
          name: `${c.toUpperCase()} (${getChainConfig(c, mode).networkName})`,
          value: c,
        })),
      },
      {
        type: 'input',
        name: 'rpcUrl',
        message: 'Enter custom RPC endpoint URL (e.g. your Alchemy, QuickNode, or local node):',
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
  } else if (choice === 'add_custom_chain') {
    const mode = getNetworkMode();
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter Network Name (e.g. "Base Sepolia", "Polygon Amoy", "Local Anvil"):',
        validate: (input) => (input.trim() ? true : 'Network name is required.'),
      },
      {
        type: 'input',
        name: 'id',
        message: 'Enter Chain Identifier / Shorthand (e.g. "base", "polygon", "anvil"):',
        validate: (input) => (input.trim() ? true : 'Chain ID shorthand is required.'),
      },
      {
        type: 'input',
        name: 'rpcUrl',
        message: 'Enter RPC Endpoint URL (e.g. "https://sepolia.base.org" or "http://127.0.0.1:8545"):',
        validate: (input) =>
          input.startsWith('http://') || input.startsWith('https://') ? true : 'Must be valid HTTP/HTTPS URL.',
      },
      {
        type: 'input',
        name: 'chainId',
        message: 'Enter EVM Chain ID (e.g. 84532 for Base Sepolia, 80002 for Polygon Amoy, 31337 for Anvil):',
        validate: (input) => (!isNaN(parseInt(input, 10)) ? true : 'Must be a valid integer.'),
      },
      {
        type: 'input',
        name: 'symbol',
        message: 'Enter Native Currency Symbol (e.g. "ETH", "POL", "BNB", "AVAX"):',
        default: 'ETH',
      },
      {
        type: 'input',
        name: 'explorerTxUrl',
        message: 'Enter Explorer Tx URL format (optional, e.g. "https://sepolia.basescan.org/tx/"):',
        default: '',
      },
    ]);

    addCustomChain({
      id: answers.id.toLowerCase().trim(),
      name: answers.name.trim(),
      networkMode: mode,
      networkName: answers.name.trim(),
      symbol: answers.symbol.trim(),
      decimals: 18,
      rpcUrl: answers.rpcUrl.trim(),
      chainId: parseInt(answers.chainId, 10),
      explorerTxUrl: answers.explorerTxUrl.trim(),
      explorerAddressUrl: '',
    });

    console.log(chalk.green(`\n✅ Custom EVM Chain '${chalk.bold(answers.name)}' added successfully to ${mode.toUpperCase()}!`));
    console.log(chalk.gray(`▶ You can now run \`mcw balance ${answers.id}\` or check all balances with \`mcw balance\`.\n`));
  } else if (choice === 'remove_custom_chain') {
    const customChains = Object.values(loadCustomChains());
    if (customChains.length === 0) {
      console.log(chalk.yellow('\nℹ️  No custom chains currently configured.\n'));
      return;
    }
    const { idToDelete } = await inquirer.prompt([
      {
        type: 'list',
        name: 'idToDelete',
        message: 'Select custom chain to remove:',
        choices: customChains.map((c) => ({
          name: `${c.name} (${c.id}) [${c.networkMode.toUpperCase()}]`,
          value: c.id,
        })),
      },
    ]);
    removeCustomChain(idToDelete);
    console.log(chalk.green(`\n✅ Custom chain '${idToDelete}' removed.\n`));
  } else if (choice === 'list_configs') {
    renderConfigTable();
  } else if (choice === 'reset_defaults') {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const file1 = path.join(os.homedir(), '.mcw', 'custom_networks.json');
    const file2 = path.join(os.homedir(), '.mcw', 'custom_chains.json');
    if (fs.existsSync(file1)) fs.unlinkSync(file1);
    if (fs.existsSync(file2)) fs.unlinkSync(file2);
    console.log(chalk.green('\n✅ All network configurations reset to factory defaults.\n'));
  }
}

function renderConfigTable(): void {
  const mode = getNetworkMode();
  const chains = getAllChains(mode);

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
