import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  listWallets,
  getActiveWalletName,
  setActiveWalletName,
  initializeVault,
  deleteWallet,
  walletExists,
} from '../../crypto/storage.js';
import { generateMnemonic, validateMnemonic, deriveAllKeys } from '../../crypto/keyDerivation.js';

export async function walletCommand(
  action?: string,
  walletNameArg?: string
): Promise<void> {
  if (action === 'list' || (!action && !walletNameArg)) {
    renderWalletTable();
    return;
  }

  if (action === 'switch' && walletNameArg) {
    const wallets = listWallets();
    const found = wallets.find((w) => w.name.toLowerCase() === walletNameArg.toLowerCase());
    if (!found) {
      console.log(chalk.red(`\n❌ Wallet profile '${walletNameArg}' does not exist. Run \`mcw wallet list\` to view available profiles.\n`));
      return;
    }
    setActiveWalletName(found.name);
    console.log(chalk.green(`\n✅ Switched active wallet profile to '${found.name}'!\n`));
    return;
  }

  if (action === 'create') {
    await handleCreateWallet(walletNameArg);
    return;
  }

  if (action === 'import') {
    await handleImportWallet(walletNameArg);
    return;
  }

  if (action === 'delete' && walletNameArg) {
    if (walletNameArg === 'default' && listWallets().length === 1) {
      console.log(chalk.red(`\n❌ Cannot delete the only remaining wallet profile ('default').\n`));
      return;
    }
    const success = deleteWallet(walletNameArg);
    if (success) {
      console.log(chalk.green(`\n✅ Wallet profile '${walletNameArg}' deleted.\n`));
    } else {
      console.log(chalk.red(`\n❌ Wallet profile '${walletNameArg}' not found.\n`));
    }
    return;
  }

  // Interactive Menu
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: '💼 Multi-Wallet Profile Manager (Separate Seed Phrases):',
      choices: [
        { name: '📋 List all Wallet Profiles', value: 'list' },
        { name: '➕ Create New Wallet (Generate Fresh Seed Phrase)', value: 'create' },
        { name: '📥 Import Wallet from Existing Seed Phrase', value: 'import' },
        { name: '🔄 Switch Active Wallet Profile', value: 'switch' },
        { name: '🗑️ Delete a Wallet Profile', value: 'delete' },
      ],
    },
  ]);

  if (choice === 'list') {
    renderWalletTable();
  } else if (choice === 'create') {
    await handleCreateWallet();
  } else if (choice === 'import') {
    await handleImportWallet();
  } else if (choice === 'switch') {
    const wallets = listWallets();
    const active = getActiveWalletName();
    const { targetWallet } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetWallet',
        message: 'Select wallet profile to switch to:',
        choices: wallets.map((w) => ({
          name: `${w.isActive ? '🟢 ' : '⚪ '}${w.name} (${w.accountsCount} account(s))`,
          value: w.name,
        })),
      },
    ]);
    setActiveWalletName(targetWallet);
    console.log(chalk.green(`\n✅ Switched active wallet profile to '${targetWallet}'!\n`));
  } else if (choice === 'delete') {
    const wallets = listWallets();
    const { targetWallet, confirm } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetWallet',
        message: 'Select wallet profile to DELETE:',
        choices: wallets.map((w) => w.name),
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('⚠️ Are you sure you want to permanently delete this wallet vault?'),
        default: false,
      },
    ]);
    if (confirm) {
      deleteWallet(targetWallet);
      console.log(chalk.green(`\n✅ Wallet '${targetWallet}' deleted.\n`));
    }
  }
}

async function handleCreateWallet(nameArg?: string): Promise<void> {
  let name = nameArg;
  if (!name) {
    const ans = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter name for the new wallet profile (e.g. trading-bot, personal):',
        validate: (v: string) => (v.trim().length > 0 ? true : 'Name cannot be empty.'),
      },
    ]);
    name = ans.name.trim();
  }

  if (walletExists(name)) {
    console.log(chalk.red(`\n❌ Wallet profile '${name}' already exists.\n`));
    return;
  }

  const mnemonic = generateMnemonic(128);

  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: `Set master password for wallet '${name}':`,
      mask: '*',
      validate: (v: string) => (v.length >= 6 ? true : 'Password must be at least 6 characters.'),
    },
  ]);

  const testnetKeys = deriveAllKeys(mnemonic, undefined, 'testnet', 0);
  const mainnetKeys = deriveAllKeys(mnemonic, undefined, 'mainnet', 0);

  initializeVault(
    mnemonic,
    password,
    {
      btc: testnetKeys.btc.address,
      btcMainnet: mainnetKeys.btc.address,
      eth: testnetKeys.eth.address,
      sol: testnetKeys.sol.address,
      trx: testnetKeys.trx.address,
    },
    name
  );

  console.log(chalk.green(`\n🎉 Wallet profile '${name}' created and set to ACTIVE!\n`));
  console.log(chalk.yellow.bold('⚠️  WRITE DOWN YOUR BIP-39 SEED PHRASE:'));
  console.log(chalk.bgBlack.yellow.bold(`\n  ${mnemonic}\n`));
}

async function handleImportWallet(nameArg?: string): Promise<void> {
  let name = nameArg;
  if (!name) {
    const ans = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter name for the imported wallet profile:',
        validate: (v: string) => (v.trim().length > 0 ? true : 'Name cannot be empty.'),
      },
    ]);
    name = ans.name.trim();
  }

  if (walletExists(name)) {
    console.log(chalk.red(`\n❌ Wallet profile '${name}' already exists.\n`));
    return;
  }

  const { mnemonic, password } = await inquirer.prompt([
    {
      type: 'input',
      name: 'mnemonic',
      message: 'Enter 12 or 24-word BIP-39 seed phrase:',
      validate: (v: string) => (validateMnemonic(v.trim()) ? true : 'Invalid BIP-39 mnemonic phrase.'),
    },
    {
      type: 'password',
      name: 'password',
      message: `Set password for wallet '${name}':`,
      mask: '*',
      validate: (v: string) => (v.length >= 6 ? true : 'Password must be at least 6 characters.'),
    },
  ]);

  const testnetKeys = deriveAllKeys(mnemonic.trim(), undefined, 'testnet', 0);
  const mainnetKeys = deriveAllKeys(mnemonic.trim(), undefined, 'mainnet', 0);

  initializeVault(
    mnemonic.trim(),
    password,
    {
      btc: testnetKeys.btc.address,
      btcMainnet: mainnetKeys.btc.address,
      eth: testnetKeys.eth.address,
      sol: testnetKeys.sol.address,
      trx: testnetKeys.trx.address,
    },
    name
  );

  console.log(chalk.green(`\n🎉 Wallet profile '${name}' imported successfully and set to ACTIVE!\n`));
}

function renderWalletTable(): void {
  const wallets = listWallets();
  const activeName = getActiveWalletName();

  console.log(chalk.bold.white(`\n💼 Wallet Profiles (Multi-Seed Management):\n`));

  const table = new Table({
    head: [
      chalk.cyan.bold('Active'),
      chalk.cyan.bold('Wallet Profile'),
      chalk.cyan.bold('HD Accounts'),
      chalk.cyan.bold('Created At'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const w of wallets) {
    const marker = w.isActive ? chalk.green.bold('● ACTIVE') : chalk.gray('○');
    table.push([
      marker,
      chalk.bold.white(w.name),
      chalk.yellow(`${w.accountsCount} sub-account(s)`),
      chalk.gray(w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'N/A'),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.gray(`Tip: Switch active profile with \`mcw wallet switch <name>\`\n`));
}
