import inquirer from 'inquirer';
import chalk from 'chalk';
import { walletExists, getWalletAddress } from '../../crypto/storage.js';
import { getChainAdapter } from '../../adapters/index.js';
import { SupportedChain, getChainConfig, getNetworkMode } from '../../config/chains.js';
import { createSpinner } from '../ui.js';

export async function faucetCommand(chainArg?: string): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mc-twaf init` (or `npx @deviykee/mc-twaf init`) first.\n'));
    return;
  }

  const mode = getNetworkMode();
  if (mode === 'mainnet') {
    console.log(chalk.yellow('\nℹ️  Faucets are only available on Testnet. Switch to testnet with: `mc-twaf network testnet`\n'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'chain',
      message: 'Select target blockchain for testnet faucet:',
      choices: [
        { name: 'Solana Devnet (⚡ Instant Auto-Airdrop)', value: 'sol' },
        { name: 'Ethereum Sepolia (Web Faucet)', value: 'eth' },
        { name: 'Bitcoin Testnet3 (Web Faucet)', value: 'btc' },
        { name: 'Tron Nile Testnet (Web Faucet)', value: 'trx' },
      ],
      when: !chainArg,
      default: chainArg,
    },
  ]);

  const chain: SupportedChain = (chainArg || answers.chain) as SupportedChain;
  const address = getWalletAddress(chain, mode);
  const chainConfig = getChainConfig(chain, mode);
  const adapter = getChainAdapter(chain, mode);

  console.log(chalk.cyan(`\nRequesting testnet faucet for ${chainConfig.name}...`));
  const spinner = createSpinner('Contacting faucet provider...').start();

  try {
    const result = await adapter.requestFaucet(address);

    if (result.success && result.txHash) {
      spinner.succeed(chalk.green(`\n✅ ${result.message}`));
      console.log(`  Tx Hash:       ${chalk.cyan(result.txHash)}`);
      console.log(`  Explorer Link: ${chalk.underline.blue(result.instructionsUrl)}\n`);
    } else {
      spinner.info(chalk.yellow(`\nℹ️  ${result.message}`));
      console.log(`  Your Address:  ${chalk.bold.green(address)}`);
      if (result.instructionsUrl) {
        console.log(`  Faucet URL:    ${chalk.underline.cyan(result.instructionsUrl)}`);
      }
      console.log('');
    }
  } catch (error: any) {
    spinner.fail(chalk.red(`Faucet request failed: ${error.message}`));
  }
}
