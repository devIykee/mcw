import inquirer from 'inquirer';
import chalk from 'chalk';
import { getNetworkMode, setNetworkMode, NetworkMode } from '../../config/chains.js';

export async function networkCommand(targetMode?: string): Promise<void> {
  const currentMode = getNetworkMode();

  if (targetMode) {
    const normalized = targetMode.toLowerCase() as NetworkMode;
    if (normalized !== 'testnet' && normalized !== 'mainnet') {
      console.log(chalk.red(`\n❌ Invalid network mode '${targetMode}'. Choose 'testnet' or 'mainnet'.\n`));
      return;
    }

    if (normalized === 'mainnet' && currentMode !== 'mainnet') {
      const { confirmMainnet } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmMainnet',
          message: chalk.red.bold('⚠️  WARNING: Switching to MAINNET uses REAL BLOCKCHAINS and REAL ASSETS. Proceed?'),
          default: false,
        },
      ]);

      if (!confirmMainnet) {
        console.log(chalk.gray('Cancelled network switch. Remaining in testnet mode.'));
        return;
      }
    }

    setNetworkMode(normalized);
    console.log(chalk.green(`\n✅ Network mode switched to: ${chalk.bold(normalized.toUpperCase())}\n`));
    return;
  }

  console.log(`\nCurrent active network mode: ${currentMode === 'mainnet' ? chalk.red.bold('MAINNET') : chalk.green.bold('TESTNET')}\n`);

  const { selectedMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedMode',
      message: 'Select active network environment:',
      choices: [
        { name: '🟢 Testnet (Risk-free: Sepolia, Devnet, Nile, Testnet3)', value: 'testnet' },
        { name: '🔴 Mainnet (⚠️ Real Assets: Ethereum, Solana, Bitcoin, Tron)', value: 'mainnet' },
      ],
      default: currentMode,
    },
  ]);

  if (selectedMode === 'mainnet' && currentMode !== 'mainnet') {
    const { confirmMainnet } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmMainnet',
        message: chalk.red.bold('⚠️  WARNING: Switching to MAINNET connects to LIVE BLOCKCHAINS with REAL FUNDS. Are you sure?'),
        default: false,
      },
    ]);

    if (!confirmMainnet) {
      console.log(chalk.gray('Network switch cancelled.'));
      return;
    }
  }

  setNetworkMode(selectedMode);
  console.log(chalk.green(`\n✅ Network successfully switched to: ${chalk.bold(selectedMode.toUpperCase())}\n`));
}
