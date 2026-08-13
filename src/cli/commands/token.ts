import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getNetworkMode, NetworkMode, getChainConfig, getAllChains } from '../../config/chains.js';
import {
  getAllTokens,
  saveCustomToken,
  removeCustomToken,
  findToken,
  TokenConfig,
  loadCustomTokens,
} from '../../config/tokens.js';
import { getChainAdapter, EthereumAdapter } from '../../adapters/index.js';
import { walletExists, getWalletAddress, unlockVault } from '../../crypto/storage.js';
import { deriveAllKeys } from '../../crypto/keyDerivation.js';
import { createSpinner } from '../ui.js';

export async function tokenCommand(
  action?: string,
  tokenArg?: string,
  amountArg?: string,
  toArg?: string
): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` (or `npx @deviykee/mcw init`) first.\n'));
    return;
  }

  // Shortcut: mcw token list
  if (action === 'list') {
    renderTokensTable();
    return;
  }

  // Shortcut: mcw token balance [token]
  if (action === 'balance') {
    await fetchTokenBalances(tokenArg);
    return;
  }

  // Shortcut: mcw token send <token> <amount> <to>
  if (action === 'send') {
    await sendToken(tokenArg, amountArg, toArg);
    return;
  }

  // Shortcut: mcw token remove <id>
  if (action === 'remove' && tokenArg) {
    const removed = removeCustomToken(tokenArg);
    if (removed) {
      console.log(chalk.green(`\n✅ Custom token '${tokenArg}' removed.\n`));
    } else {
      console.log(chalk.yellow(`\n⚠️  Custom token '${tokenArg}' not found.\n`));
    }
    return;
  }

  // Interactive Token Menu
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: '🪙 Token Management:',
      choices: [
        { name: '💰 View Token Balances (e.g. Sepolia USDC, LINK)', value: 'balance' },
        { name: '➕ Add Custom ERC-20 / SPL Token Contract', value: 'add' },
        { name: '📤 Send Tokens', value: 'send' },
        { name: '📋 List Tracked Tokens', value: 'list' },
        { name: '🗑️  Remove a Custom Token', value: 'remove' },
      ],
    },
  ]);

  if (choice === 'balance') {
    await fetchTokenBalances();
  } else if (choice === 'add') {
    await addTokenWizard();
  } else if (choice === 'send') {
    await sendToken();
  } else if (choice === 'list') {
    renderTokensTable();
  } else if (choice === 'remove') {
    const customTokens = Object.values(loadCustomTokens());
    if (customTokens.length === 0) {
      console.log(chalk.yellow('\nℹ️  No custom tokens configured.\n'));
      return;
    }
    const { idToDelete } = await inquirer.prompt([
      {
        type: 'list',
        name: 'idToDelete',
        message: 'Select token to remove:',
        choices: customTokens.map((t) => ({
          name: `${t.symbol} - ${t.name} (${t.chain.toUpperCase()}) [${t.contractAddress}]`,
          value: t.id,
        })),
      },
    ]);
    removeCustomToken(idToDelete);
    console.log(chalk.green(`\n✅ Removed token '${idToDelete}'.\n`));
  }
}

async function addTokenWizard(): Promise<void> {
  const mode = getNetworkMode();
  const availableChains = getAllChains(mode);

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'chain',
      message: `Select chain for the token (${mode.toUpperCase()}):`,
      choices: availableChains.map((c) => ({
        name: `${c.toUpperCase()} (${getChainConfig(c, mode).networkName})`,
        value: c,
      })),
    },
    {
      type: 'input',
      name: 'contractAddress',
      message: 'Enter Token Contract Address (or Mint Address):',
      validate: (input: string) => (input.trim().length >= 32 ? true : 'Invalid contract address.'),
    },
    {
      type: 'input',
      name: 'symbol',
      message: 'Enter Token Symbol (e.g. "USDC", "DAI", "LINK"):',
      validate: (input: string) => (input.trim() ? true : 'Symbol is required.'),
    },
    {
      type: 'input',
      name: 'name',
      message: 'Enter Token Name (e.g. "USD Coin", "ChainLink Token"):',
      default: (ans: any) => `${ans.symbol} Token`,
    },
    {
      type: 'input',
      name: 'decimals',
      message: 'Enter Decimals (usually 18 for ERC-20, 6 for USDC/USDT):',
      default: '18',
      validate: (input: string) => (!isNaN(parseInt(input, 10)) ? true : 'Must be an integer.'),
    },
  ]);

  const id = `${answers.symbol.toLowerCase()}-${answers.chain.toLowerCase()}`;
  saveCustomToken({
    id,
    symbol: answers.symbol.trim().toUpperCase(),
    name: answers.name.trim(),
    chain: answers.chain,
    networkMode: mode,
    contractAddress: answers.contractAddress.trim(),
    decimals: parseInt(answers.decimals, 10),
    standard: answers.chain === 'sol' ? 'spl' : answers.chain === 'trx' ? 'trc20' : 'erc20',
  });

  console.log(chalk.green(`\n✅ Custom Token '${chalk.bold(answers.symbol)}' added successfully to ${mode.toUpperCase()}!\n`));
}

async function fetchTokenBalances(specificToken?: string): Promise<void> {
  const mode = getNetworkMode();
  let tokens = getAllTokens(mode);

  if (specificToken) {
    const found = findToken(specificToken, mode);
    if (!found) {
      console.log(chalk.red(`\n❌ Token '${specificToken}' not found in active ${mode} network.\n`));
      return;
    }
    tokens = [found];
  }

  if (tokens.length === 0) {
    console.log(chalk.yellow(`\nℹ️  No tokens configured for ${mode.toUpperCase()}. Run \`mcw token add\` to add one.\n`));
    return;
  }

  console.log(chalk.bold.cyan(`\n🪙 Fetching Live ${mode.toUpperCase()} Token Balances...\n`));
  const spinner = createSpinner('Querying token smart contracts...').start();

  const results: Array<{
    symbol: string;
    name: string;
    chain: string;
    network: string;
    balance: string;
    contract: string;
  }> = [];

  for (const token of tokens) {
    try {
      const walletAddr = getWalletAddress(token.chain, mode);
      const adapter = getChainAdapter(token.chain, mode);

      if (adapter instanceof EthereumAdapter) {
        const bal = await adapter.getERC20Balance(token.contractAddress, walletAddr, token.decimals);
        results.push({
          symbol: token.symbol,
          name: token.name,
          chain: token.chain.toUpperCase(),
          network: getChainConfig(token.chain, mode).networkName,
          balance: `${bal.balanceFormatted} ${token.symbol}`,
          contract: token.contractAddress,
        });
      }
    } catch {
      results.push({
        symbol: token.symbol,
        name: token.name,
        chain: token.chain.toUpperCase(),
        network: getChainConfig(token.chain, mode).networkName,
        balance: `0.0000 ${token.symbol}`,
        contract: token.contractAddress,
      });
    }
  }

  spinner.stop();

  const table = new Table({
    head: [
      chalk.cyan.bold('Token'),
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Network'),
      chalk.cyan.bold('Balance'),
      chalk.cyan.bold('Contract Address'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const r of results) {
    table.push([
      chalk.bold.yellow(r.symbol),
      chalk.white(r.chain),
      chalk.white(r.network),
      chalk.green.bold(r.balance),
      chalk.gray(r.contract),
    ]);
  }

  console.log(table.toString());
  console.log('');
}

async function sendToken(tokenArg?: string, amountArg?: string, toArg?: string): Promise<void> {
  const mode = getNetworkMode();
  let token = tokenArg ? findToken(tokenArg, mode) : undefined;

  if (!token) {
    const tokens = getAllTokens(mode);
    if (tokens.length === 0) {
      console.log(chalk.yellow('\nℹ️  No tokens configured. Add one first using `mcw token add`.\n'));
      return;
    }

    const { selectedTokenId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTokenId',
        message: 'Select token to send:',
        choices: tokens.map((t) => ({
          name: `${t.symbol} (${t.name}) on ${t.chain.toUpperCase()}`,
          value: t.id,
        })),
      },
    ]);
    token = findToken(selectedTokenId, mode);
  }

  if (!token) {
    console.log(chalk.red('\n❌ Token not found.\n'));
    return;
  }

  let amount = amountArg;
  if (!amount) {
    const ans = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: `Enter amount of ${token.symbol} to send:`,
        validate: (v: string) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0 ? true : 'Enter valid amount.'),
      },
    ]);
    amount = ans.amount;
  }

  let to = toArg;
  if (!to) {
    const ans = await inquirer.prompt([
      {
        type: 'input',
        name: 'to',
        message: 'Enter recipient wallet address:',
        validate: (v: string) => (v.trim().startsWith('0x') && v.trim().length === 42 ? true : 'Must be valid 0x EVM address.'),
      },
    ]);
    to = ans.to;
  }

  const fromAddress = getWalletAddress(token.chain, mode);
  const adapter = getChainAdapter(token.chain, mode);

  if (!(adapter instanceof EthereumAdapter)) {
    console.log(chalk.red('\n❌ Token transfers currently supported on EVM chains.\n'));
    return;
  }

  const buildSpinner = createSpinner('Formulating ERC-20 transfer & estimating gas...').start();
  try {
    const builtTx = await adapter.buildERC20Transfer(fromAddress, token.contractAddress, to!, amount!, token.decimals);
    buildSpinner.succeed(chalk.green('Token transaction built successfully!'));

    console.log(chalk.bold.white('\n📋 Transaction Review:'));
    console.log(`  Token:         ${chalk.yellow.bold(token.symbol)} (${token.name})`);
    console.log(`  From:          ${chalk.cyan(fromAddress)}`);
    console.log(`  To:            ${chalk.cyan(to)}`);
    console.log(`  Amount:        ${chalk.yellow.bold(`${amount} ${token.symbol}`)}`);
    console.log(`  Estimated Gas: ${chalk.red.bold(builtTx.estimatedFee)}`);
    console.log(`  Contract:      ${chalk.gray(token.contractAddress)}\n`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to broadcast this ${token.symbol} transfer to ${mode.toUpperCase()}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n❌ Transfer canceled by user.\n'));
      return;
    }

    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: 'Enter your vault password to decrypt and sign:',
        mask: '*',
      },
    ]);

    const sendSpinner = createSpinner('Signing and broadcasting ERC-20 transaction...').start();
    try {
      const mnemonic = unlockVault(password);
      const keys = deriveAllKeys(mnemonic, undefined, mode);
      const privateKey = keys.eth.privateKey;

      const result = await adapter.signAndSendTransaction(privateKey, builtTx);
      sendSpinner.succeed(chalk.green(`Transaction broadcast successfully to ${mode}!`));

      console.log(chalk.bold.white('\n🎉 Broadcast Summary:'));
      console.log(`  Tx Hash:       ${chalk.cyan.bold(result.txHash)}`);
      console.log(`  Explorer Link: ${chalk.underline.blue(result.explorerUrl)}\n`);
    } catch (err: any) {
      sendSpinner.fail(chalk.red(`Failed to sign/send: ${err.message}`));
    }
  } catch (err: any) {
    buildSpinner.fail(chalk.red(`Failed to formulate transfer: ${err.message}`));
  }
}

function renderTokensTable(): void {
  const mode = getNetworkMode();
  const tokens = getAllTokens(mode);

  const table = new Table({
    head: [
      chalk.cyan.bold('Token'),
      chalk.cyan.bold('Name'),
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Decimals'),
      chalk.cyan.bold('Standard'),
      chalk.cyan.bold('Contract Address'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const t of tokens) {
    table.push([
      chalk.bold.yellow(t.symbol),
      chalk.white(t.name),
      chalk.white(t.chain.toUpperCase()),
      chalk.white(t.decimals.toString()),
      chalk.cyan(t.standard.toUpperCase()),
      chalk.gray(t.contractAddress),
    ]);
  }

  console.log(chalk.bold.white(`\n📋 Configured Tokens (${mode.toUpperCase()}):\n`));
  console.log(table.toString());
  console.log('');
}
