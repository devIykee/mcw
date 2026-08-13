import inquirer from 'inquirer';
import chalk from 'chalk';
import { walletExists, unlockVault, getWalletAddress } from '../../crypto/storage.js';
import { deriveAllKeys } from '../../crypto/keyDerivation.js';
import { getChainAdapter } from '../../adapters/index.js';
import { SupportedChain, getChainConfig, getNetworkMode } from '../../config/chains.js';
import { createSpinner } from '../ui.js';

export async function sendCommand(
  chainArg?: string,
  amountArg?: string,
  toArg?: string
): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` (or `npx @deviykee/mcw init`) first.\n'));
    return;
  }

  const mode = getNetworkMode();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'chain',
      message: `Select target blockchain (${mode.toUpperCase()}):`,
      choices: [
        { name: `Ethereum (${mode === 'mainnet' ? 'Mainnet' : 'Sepolia'})`, value: 'eth' },
        { name: `Solana (${mode === 'mainnet' ? 'Mainnet-Beta' : 'Devnet'})`, value: 'sol' },
        { name: `Bitcoin (${mode === 'mainnet' ? 'Mainnet' : 'Testnet3'})`, value: 'btc' },
        { name: `Tron (${mode === 'mainnet' ? 'Mainnet' : 'Nile'})`, value: 'trx' },
      ],
      when: !chainArg,
      default: chainArg,
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Enter amount to send:',
      when: !amountArg,
      default: amountArg,
      validate: (input: string) => {
        const val = parseFloat(input);
        if (isNaN(val) || val <= 0) {
          return 'Please enter a valid positive number.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'to',
      message: `Enter recipient ${mode} address:`,
      when: !toArg,
      default: toArg,
      validate: (input: string) => {
        if (!input || input.trim().length < 10) {
          return 'Please enter a valid address.';
        }
        return true;
      },
    },
  ]);

  const chain: SupportedChain = (chainArg || answers.chain) as SupportedChain;
  const amount: string = amountArg || answers.amount;
  const to: string = (toArg || answers.to).trim();

  const fromAddress = getWalletAddress(chain, mode);
  const chainConfig = getChainConfig(chain, mode);
  const adapter = getChainAdapter(chain, mode);

  console.log(chalk.cyan(`\nBuilding ${chainConfig.name} transaction...`));
  const buildSpinner = createSpinner('Estimating network fees and assembling payload...').start();

  try {
    const builtTx = await adapter.buildTransaction(fromAddress, { to, amount });
    buildSpinner.succeed(chalk.green('Transaction constructed successfully.'));

    console.log(chalk.bold.white('\n📋 Transaction Details:'));
    console.log(`  Environment:   ${mode === 'mainnet' ? chalk.bgRed.white.bold(' MAINNET (REAL ASSETS) ') : chalk.bgGreen.black(' TESTNET ')}`);
    console.log(`  Network:       ${chainConfig.name}`);
    console.log(`  From:          ${chalk.gray(fromAddress)}`);
    console.log(`  To:            ${chalk.yellow(to)}`);
    console.log(`  Amount:        ${chalk.bold.green(amount)} ${chainConfig.symbol}`);
    console.log(`  Est. Fee:      ${chalk.bold.yellow(builtTx.estimatedFee)}`);
    console.log('');

    if (mode === 'mainnet') {
      const { confirmMainnetRisk } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmMainnetRisk',
          message: chalk.red.bold('⚠️  MAINNET GUARD: You are broadcasting to PRODUCTION MAINNET with REAL FUNDS. Proceed?'),
          default: false,
        },
      ]);

      if (!confirmMainnetRisk) {
        console.log(chalk.gray('Transaction cancelled for safety.'));
        return;
      }
    }

    const { confirmSend } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmSend',
        message: `Do you want to sign and broadcast this ${mode} transaction?`,
        default: true,
      },
    ]);

    if (!confirmSend) {
      console.log(chalk.gray('Transaction cancelled.'));
      return;
    }

    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: 'Enter your vault password to decrypt private key:',
        mask: '*',
      },
    ]);

    const sendSpinner = createSpinner('Decrypting vault, signing transaction, and broadcasting...').start();

    try {
      const mnemonic = unlockVault(password);
      const keys = deriveAllKeys(mnemonic, undefined, mode);
      const privateKey =
        chain === 'btc'
          ? keys.btc.privateKey
          : chain === 'sol'
          ? keys.sol.privateKey
          : chain === 'trx'
          ? keys.trx.privateKey
          : keys.eth.privateKey;

      const result = await adapter.signAndSendTransaction(privateKey, builtTx);
      sendSpinner.succeed(chalk.green(`Transaction successfully broadcast to ${mode}!}`));

      console.log(chalk.bold.white('\n🎉 Broadcast Summary:'));
      console.log(`  Status:        ${chalk.green.bold(result.status.toUpperCase())}`);
      console.log(`  Tx Hash:       ${chalk.cyan.bold(result.txHash)}`);
      console.log(`  Explorer Link: ${chalk.underline.blue(result.explorerUrl)}\n`);
    } catch (err: any) {
      sendSpinner.fail(chalk.red(`Failed to sign/send: ${err.message}`));
    }
  } catch (error: any) {
    buildSpinner.fail(chalk.red(`Transaction construction error: ${error.message}`));
  }
}
