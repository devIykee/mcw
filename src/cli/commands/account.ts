import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  walletExists,
  listAccounts,
  createAccount,
  getActiveAccountIndex,
  setActiveAccountIndex,
  getActiveWalletName,
} from '../../crypto/storage.js';
import { getNetworkMode } from '../../config/chains.js';

export async function accountCommand(action?: string, arg1?: string): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` first.\n'));
    return;
  }

  const activeWallet = getActiveWalletName();

  if (action === 'list' || (!action && !arg1)) {
    renderAccountTable();
    return;
  }

  if (action === 'switch' && arg1 !== undefined) {
    const targetIndex = parseInt(arg1, 10);
    const accounts = listAccounts();
    const found = accounts.find((a) => a.index === targetIndex);
    if (!found) {
      console.log(chalk.red(`\n❌ Account index #${targetIndex} does not exist in wallet '${activeWallet}'.\n`));
      return;
    }
    setActiveAccountIndex(targetIndex);
    console.log(chalk.green(`\n✅ Switched active account to #${targetIndex} (${found.label}) in wallet '${activeWallet}'.\n`));
    return;
  }

  if (action === 'create') {
    await handleCreateAccount(arg1);
    return;
  }

  // Interactive Menu
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: `👤 Account Management (Wallet: ${chalk.cyan(activeWallet)}):`,
      choices: [
        { name: '📋 List all derived Accounts', value: 'list' },
        { name: '➕ Derive New Sub-Account from Seed (Account #N)', value: 'create' },
        { name: '🔄 Switch Active Account Index', value: 'switch' },
      ],
    },
  ]);

  if (choice === 'list') {
    renderAccountTable();
  } else if (choice === 'create') {
    await handleCreateAccount();
  } else if (choice === 'switch') {
    const accounts = listAccounts();
    const activeIndex = getActiveAccountIndex();
    const { selectedIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedIndex',
        message: 'Select account to set as active:',
        choices: accounts.map((a) => ({
          name: `${a.index === activeIndex ? '🟢 ' : '⚪ '}[#${a.index}] ${a.label} (${a.addresses.eth.substring(0, 10)}...)`,
          value: a.index,
        })),
      },
    ]);
    setActiveAccountIndex(selectedIndex);
    console.log(chalk.green(`\n✅ Switched active account to #${selectedIndex}!\n`));
  }
}

async function handleCreateAccount(labelArg?: string): Promise<void> {
  let label = labelArg;
  if (!label) {
    const nextIdx = listAccounts().length;
    const ans = await inquirer.prompt([
      {
        type: 'input',
        name: 'label',
        message: 'Enter label / description for the new account:',
        default: `Account #${nextIdx}`,
      },
    ]);
    label = ans.label;
  }

  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Enter vault password to derive new sub-account keypair:',
      mask: '*',
    },
  ]);

  try {
    const newAcc = createAccount(password, label);
    setActiveAccountIndex(newAcc.index);
    console.log(chalk.green(`\n🎉 New HD Sub-Account #${newAcc.index} derived successfully and set to ACTIVE:\n`));

    const table = new Table({
      head: [chalk.cyan.bold('Chain'), chalk.cyan.bold('Derived Address')],
      style: { head: [], border: ['gray'] },
    });

    table.push(
      [chalk.bold('Bitcoin'), chalk.yellow(newAcc.addresses.btc)],
      [chalk.bold('Ethereum / EVM'), chalk.cyan(newAcc.addresses.eth)],
      [chalk.bold('Solana'), chalk.magenta(newAcc.addresses.sol)],
      [chalk.bold('Tron'), chalk.red(newAcc.addresses.trx)]
    );

    console.log(table.toString());
    console.log('');
  } catch (err: any) {
    console.log(chalk.red(`\n❌ Failed to create account: ${err.message}\n`));
  }
}

function renderAccountTable(): void {
  const activeWallet = getActiveWalletName();
  const accounts = listAccounts();
  const activeIndex = getActiveAccountIndex();
  const mode = getNetworkMode();

  console.log(
    chalk.bold.white(
      `\n👤 HD Accounts for Wallet: ${chalk.cyan.bold(activeWallet)} (${mode.toUpperCase()}):\n`
    )
  );

  const table = new Table({
    head: [
      chalk.cyan.bold('Active'),
      chalk.cyan.bold('Index'),
      chalk.cyan.bold('Label'),
      chalk.cyan.bold('ETH Address'),
      chalk.cyan.bold('SOL Address'),
      chalk.cyan.bold('BTC Address'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const acc of accounts) {
    const isActive = acc.index === activeIndex;
    const marker = isActive ? chalk.green.bold('● ACTIVE') : chalk.gray('○');
    table.push([
      marker,
      chalk.bold(`#${acc.index}`),
      chalk.white(acc.label),
      chalk.cyan(acc.addresses.eth.substring(0, 14) + '...'),
      chalk.magenta(acc.addresses.sol.substring(0, 14) + '...'),
      chalk.yellow(acc.addresses.btc.substring(0, 14) + '...'),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.gray(`Tip: Switch active account with \`mcw account switch <index>\`\n`));
}
