import inquirer from 'inquirer';
import chalk from 'chalk';
import { generateMnemonic, validateMnemonic, deriveAllKeys } from '../../crypto/keyDerivation.js';
import { initializeVault, walletExists } from '../../crypto/storage.js';
import { CHAIN_CONFIGS } from '../../config/chains.js';
import { renderAddressTable, createSpinner } from '../ui.js';

export async function initCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n⚙️  Wallet Initialization\n'));

  if (walletExists()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: chalk.yellow('A wallet vault already exists. Do you want to overwrite it? (WARNING: Back up your old seed first!)'),
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.gray('Wallet initialization cancelled.'));
      return;
    }
  }

  const { initChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'initChoice',
      message: 'Choose seed phrase setup method:',
      choices: [
        { name: '✨ Generate fresh 12-word mnemonic (Recommended)', value: 'new_12' },
        { name: '✨ Generate fresh 24-word mnemonic (High entropy)', value: 'new_24' },
        { name: '🔑 Import existing BIP-39 mnemonic phrase', value: 'import' },
      ],
    },
  ]);

  let mnemonic = '';

  if (initChoice === 'new_12') {
    mnemonic = generateMnemonic(128);
  } else if (initChoice === 'new_24') {
    mnemonic = generateMnemonic(256);
  } else {
    const { importedMnemonic } = await inquirer.prompt([
      {
        type: 'password',
        name: 'importedMnemonic',
        message: 'Enter your 12 or 24-word BIP-39 mnemonic:',
        mask: '*',
        validate: (input: string) => {
          if (!validateMnemonic(input)) {
            return 'Invalid BIP-39 mnemonic phrase. Please check your words and order.';
          }
          return true;
        },
      },
    ]);
    mnemonic = importedMnemonic.trim();
  }

  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Set a secure encryption password for your local vault:',
      mask: '*',
      validate: (input: string) => {
        if (input.length < 6) {
          return 'Password must be at least 6 characters long.';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: 'Confirm encryption password:',
      mask: '*',
      validate: (input: string, answers: any) => {
        if (input !== answers.password) {
          return 'Passwords do not match.';
        }
        return true;
      },
    },
  ]);

  const spinner = createSpinner('Deriving multi-chain keys and encrypting vault with AES-256-GCM...').start();

  try {
    const testnetKeys = deriveAllKeys(mnemonic, undefined, 'testnet');
    const mainnetKeys = deriveAllKeys(mnemonic, undefined, 'mainnet');

    initializeVault(mnemonic, password, {
      btc: testnetKeys.btc.address,
      btcMainnet: mainnetKeys.btc.address,
      eth: testnetKeys.eth.address,
      sol: testnetKeys.sol.address,
      trx: testnetKeys.trx.address,
    });

    spinner.succeed(chalk.green('Multi-Chain Wallet initialized and securely encrypted!'));

    if (initChoice !== 'import') {
      console.log('\n' + chalk.bgHex('#D97706').black.bold(' ⚠️  SECRET RECOVERY PHRASE (KEEP THIS SECURE) '));
      console.log(chalk.yellow('Write these words down in order. Never share them with anyone:'));
      console.log(chalk.bold.black.bgWhite(`\n  ${mnemonic}  \n`));
    }

    console.log(chalk.bold.white('\n📋 Derived Public Addresses (Testnet & Mainnet Ready):\n'));

    renderAddressTable([
      {
        chain: 'btc',
        network: 'Bitcoin (Testnet: tb1q... | Mainnet: bc1q...)',
        derivationPath: "m/84'/(1'|0')/0'/0/0",
        address: `${testnetKeys.btc.address} (Testnet)\n${mainnetKeys.btc.address} (Mainnet)`,
      },
      {
        chain: 'eth',
        network: 'Ethereum & EVM (Sepolia / Mainnet)',
        derivationPath: "m/44'/60'/0'/0/0",
        address: testnetKeys.eth.address,
      },
      {
        chain: 'sol',
        network: 'Solana (Devnet / Mainnet-Beta)',
        derivationPath: "m/44'/501'/0'/0'",
        address: testnetKeys.sol.address,
      },
      {
        chain: 'trx',
        network: 'Tron (Nile / Mainnet)',
        derivationPath: "m/44'/195'/0'/0/0",
        address: testnetKeys.trx.address,
      },
    ]);

    console.log(chalk.gray('\n▶ Run `mc-twaf balance` to view real-time balances.'));
    console.log(chalk.gray('▶ Run `mc-twaf network` to switch between Testnet and Mainnet.'));
  } catch (error: any) {
    spinner.fail(chalk.red(`Failed to initialize wallet: ${error.message}`));
  }
}
