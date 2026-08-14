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
import { getChainAdapter, EthereumAdapter, TronAdapter, SolanaAdapter } from '../../adapters/index.js';
import { walletExists, getWalletAddress, unlockVault } from '../../crypto/storage.js';
import { deriveAllKeys } from '../../crypto/keyDerivation.js';
import { createSpinner } from '../ui.js';

export function detectChainFromAddress(
  address: string,
  explicitChain?: string
): { chain: string; standard: 'erc20' | 'spl' | 'trc20' } {
  const addr = address.trim();
  if (explicitChain) {
    const std = explicitChain === 'sol' ? 'spl' : explicitChain === 'trx' ? 'trc20' : 'erc20';
    return { chain: explicitChain.toLowerCase(), standard: std };
  }
  if (addr.startsWith('0x') && addr.length === 42) {
    return { chain: 'eth', standard: 'erc20' };
  }
  if (addr.startsWith('T') && addr.length === 34) {
    return { chain: 'trx', standard: 'trc20' };
  }
  if (addr.length >= 32 && addr.length <= 44) {
    return { chain: 'sol', standard: 'spl' };
  }
  return { chain: 'eth', standard: 'erc20' };
}

export async function tokenCommand(
  actionArg?: string,
  tokenArg?: string,
  amountArg?: string,
  toArg?: string
): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` (or `npx @deviykee/mcw init`) first.\n'));
    return;
  }

  const mode = getNetworkMode();
  let action = actionArg;
  let token = tokenArg;

  // Direct Shortcut: `mcw token add <contractAddress> [chain]`
  if (action === 'add' && tokenArg) {
    await autoAddToken(tokenArg, amountArg);
    return;
  }

  // If user passes a contract address directly as first argument: `mcw token 0x1c7D...` or `mcw token TG3XX...`
  if (actionArg && (actionArg.startsWith('0x') || actionArg.startsWith('T') || actionArg.length >= 32)) {
    const existing = findToken(actionArg, mode);
    if (existing) {
      await fetchTokenBalances(actionArg);
    } else {
      await autoAddToken(actionArg, tokenArg);
    }
    return;
  }

  // Flexible argument handler: if first argument is a token name (e.g. `mcw token usdc-eth` or `mcw token usdt-trx`)
  if (actionArg && !['balance', 'add', 'send', 'list', 'remove'].includes(actionArg.toLowerCase())) {
    const found = findToken(actionArg, mode);
    if (found) {
      action = 'balance';
      token = actionArg;
    }
  }

  // Shortcut: mcw token list
  if (action === 'list') {
    renderTokensTable();
    return;
  }

  // Shortcut: mcw token balance [token]
  if (action === 'balance') {
    await fetchTokenBalances(token);
    return;
  }

  // Shortcut: mcw token send <token> <amount> <to>
  if (action === 'send') {
    await sendToken(token, amountArg, toArg);
    return;
  }

  // Shortcut: mcw token add (interactive)
  if (action === 'add') {
    await addTokenWizard();
    return;
  }

  // Shortcut: mcw token remove <id>
  if (action === 'remove' && token) {
    const removed = removeCustomToken(token);
    if (removed) {
      console.log(chalk.green(`\n✅ Custom token '${token}' removed.\n`));
    } else {
      console.log(chalk.yellow(`\n⚠️  Custom token '${token}' not found.\n`));
    }
    return;
  }

  // Interactive Token Menu
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: '🪙 Token Management (ERC-20, SPL, TRC-20):',
      choices: [
        { name: '💰 View Token Balances (USDC, USDT, LINK, etc.)', value: 'balance' },
        { name: '➕ Add Custom Token (Auto-detect from Contract / Mint)', value: 'add' },
        { name: '📤 Send / Transfer Tokens', value: 'send' },
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
          name: `${t.symbol} - ${t.name} (${t.chain.toUpperCase()} - ${t.standard.toUpperCase()}) [${t.contractAddress}]`,
          value: t.id,
        })),
      },
    ]);
    removeCustomToken(idToDelete);
    console.log(chalk.green(`\n✅ Removed token '${idToDelete}'.\n`));
  }
}

/**
 * Automatically fetch on-chain metadata and add token with 0 manual inputs!
 */
export async function autoAddToken(contractAddress: string, explicitChain?: string): Promise<TokenConfig | null> {
  const mode = getNetworkMode();
  const { chain, standard } = detectChainFromAddress(contractAddress, explicitChain);
  const chainConfig = getChainConfig(chain, mode);

  console.log(chalk.bold.cyan(`\n🔍 Auto-detecting Token Contract on ${chainConfig.networkName}...`));
  const spinner = createSpinner('Querying blockchain for on-chain symbol, name & decimals...').start();

  try {
    const adapter = getChainAdapter(chain, mode);
    let metadata = { symbol: 'TOKEN', name: 'Custom Token', decimals: 18 };

    if (adapter instanceof EthereumAdapter) {
      metadata = await adapter.getTokenMetadata(contractAddress);
    } else if (adapter instanceof TronAdapter) {
      metadata = await adapter.getTokenMetadata(contractAddress);
    } else if (adapter instanceof SolanaAdapter) {
      metadata = await adapter.getTokenMetadata(contractAddress);
    }

    spinner.succeed(chalk.green('On-chain token metadata verified!'));

    const id = `${metadata.symbol.toLowerCase()}-${chain.toLowerCase()}`;
    const tokenConfig: TokenConfig = {
      id,
      symbol: metadata.symbol.toUpperCase(),
      name: metadata.name,
      chain,
      networkMode: mode,
      contractAddress: contractAddress.trim(),
      decimals: metadata.decimals,
      standard,
    };

    saveCustomToken(tokenConfig);

    const table = new Table({
      head: [
        chalk.cyan.bold('Property'),
        chalk.cyan.bold('On-Chain Value'),
      ],
      style: { head: [], border: ['gray'] },
    });

    table.push(
      [chalk.bold('Token Symbol'), chalk.yellow.bold(tokenConfig.symbol)],
      [chalk.bold('Token Name'), chalk.white(tokenConfig.name)],
      [chalk.bold('Decimals'), chalk.white(tokenConfig.decimals.toString())],
      [chalk.bold('Standard'), chalk.cyan.bold(tokenConfig.standard.toUpperCase())],
      [chalk.bold('Chain / Network'), chalk.white(`${tokenConfig.chain.toUpperCase()} (${chainConfig.networkName})`)],
      [chalk.bold('Contract Address'), chalk.gray(tokenConfig.contractAddress)],
      [chalk.bold('Token ID'), chalk.green(tokenConfig.id)]
    );

    console.log(chalk.bold.green(`\n✅ Token successfully added & tracked in ${mode.toUpperCase()} configuration:\n`));
    console.log(table.toString());
    console.log(chalk.gray(`\nTip: You can now check your balance with \`mcw token balance ${tokenConfig.id}\`\n`));

    return tokenConfig;
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed to fetch on-chain metadata: ${err.message}`));
    return null;
  }
}

async function addTokenWizard(): Promise<void> {
  const mode = getNetworkMode();

  const { contractAddress } = await inquirer.prompt([
    {
      type: 'input',
      name: 'contractAddress',
      message: 'Enter Token Contract Address (ERC-20 / TRC-20) or Mint Address (SPL):',
      validate: (input: string) => (input.trim().length >= 32 ? true : 'Invalid contract or mint address.'),
    },
  ]);

  const { chain, standard } = detectChainFromAddress(contractAddress);
  const chainConfig = getChainConfig(chain, mode);

  const spinner = createSpinner(`Detecting on-chain details on ${chainConfig.networkName}...`).start();
  let metadata = { symbol: 'TOKEN', name: 'Custom Token', decimals: 18 };

  try {
    const adapter = getChainAdapter(chain, mode);
    if (adapter instanceof EthereumAdapter || adapter instanceof TronAdapter || adapter instanceof SolanaAdapter) {
      metadata = await adapter.getTokenMetadata(contractAddress);
      spinner.succeed(chalk.green(`Auto-detected: ${metadata.symbol} (${metadata.name}, ${metadata.decimals} decimals)`));
    } else {
      spinner.stop();
    }
  } catch {
    spinner.stop();
  }

  const { confirmAuto } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmAuto',
      message: `Save auto-detected token (${metadata.symbol} - ${metadata.name}, ${metadata.decimals} decimals on ${chain.toUpperCase()})?`,
      default: true,
    },
  ]);

  if (confirmAuto) {
    const id = `${metadata.symbol.toLowerCase()}-${chain.toLowerCase()}`;
    saveCustomToken({
      id,
      symbol: metadata.symbol.toUpperCase(),
      name: metadata.name,
      chain,
      networkMode: mode,
      contractAddress: contractAddress.trim(),
      decimals: metadata.decimals,
      standard,
    });
    console.log(chalk.green(`\n✅ Custom Token '${chalk.bold(metadata.symbol)}' added successfully to ${mode.toUpperCase()}!\n`));
    return;
  }

  // Fallback to manual entry if user wants to override
  const availableChains = getAllChains(mode);
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'chain',
      message: `Select chain for the token (${mode.toUpperCase()}):`,
      default: chain,
      choices: availableChains.map((c) => ({
        name: `${c.toUpperCase()} (${getChainConfig(c, mode).networkName})`,
        value: c,
      })),
    },
    {
      type: 'input',
      name: 'symbol',
      message: 'Enter Token Symbol (e.g. "USDC", "USDT", "LINK"):',
      default: metadata.symbol,
      validate: (input: string) => (input.trim() ? true : 'Symbol is required.'),
    },
    {
      type: 'input',
      name: 'name',
      message: 'Enter Token Name (e.g. "USD Coin", "Tether USD"):',
      default: metadata.name,
    },
    {
      type: 'input',
      name: 'decimals',
      message: 'Enter Decimals:',
      default: metadata.decimals.toString(),
      validate: (input: string) => (!isNaN(parseInt(input, 10)) ? true : 'Must be an integer.'),
    },
  ]);

  const customStandard = answers.chain === 'sol' ? 'spl' : answers.chain === 'trx' ? 'trc20' : 'erc20';
  const customId = `${answers.symbol.toLowerCase()}-${answers.chain.toLowerCase()}`;

  saveCustomToken({
    id: customId,
    symbol: answers.symbol.trim().toUpperCase(),
    name: answers.name.trim(),
    chain: answers.chain,
    networkMode: mode,
    contractAddress: contractAddress.trim(),
    decimals: parseInt(answers.decimals, 10),
    standard: customStandard,
  });

  console.log(
    chalk.green(
      `\n✅ Custom Token '${chalk.bold(answers.symbol)}' (${customStandard.toUpperCase()}) added successfully to ${mode.toUpperCase()}!\n`
    )
  );
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
  const spinner = createSpinner('Querying token smart contracts across chains...').start();

  const results: Array<{
    symbol: string;
    name: string;
    chain: string;
    network: string;
    standard: string;
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
          standard: 'ERC20',
          balance: `${bal.balanceFormatted} ${token.symbol}`,
          contract: token.contractAddress,
        });
      } else if (adapter instanceof TronAdapter) {
        const bal = await adapter.getTRC20Balance(token.contractAddress, walletAddr, token.decimals);
        results.push({
          symbol: token.symbol,
          name: token.name,
          chain: token.chain.toUpperCase(),
          network: getChainConfig(token.chain, mode).networkName,
          standard: 'TRC20',
          balance: `${bal.balanceFormatted} ${token.symbol}`,
          contract: token.contractAddress,
        });
      } else if (adapter instanceof SolanaAdapter) {
        const bal = await adapter.getSPLBalance(token.contractAddress, walletAddr, token.decimals);
        results.push({
          symbol: token.symbol,
          name: token.name,
          chain: token.chain.toUpperCase(),
          network: getChainConfig(token.chain, mode).networkName,
          standard: 'SPL',
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
        standard: token.standard.toUpperCase(),
        balance: `0.0000 ${token.symbol}`,
        contract: token.contractAddress,
      });
    }
  }

  spinner.stop();

  const table = new Table({
    head: [
      chalk.cyan.bold('Token'),
      chalk.cyan.bold('Standard'),
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
      chalk.cyan(r.standard),
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
          name: `${t.symbol} (${t.name}) on ${t.chain.toUpperCase()} [${t.standard.toUpperCase()}]`,
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
        message: `Enter recipient ${token.chain.toUpperCase()} wallet address:`,
        validate: (v: string) => {
          const val = v.trim();
          if (token!.chain === 'trx') {
            return val.startsWith('T') && val.length === 34 ? true : 'Must be valid 34-character Tron address (starting with T).';
          }
          if (token!.chain === 'sol') {
            return val.length >= 32 && val.length <= 44 ? true : 'Must be valid Solana Base58 public key.';
          }
          // EVM default
          return val.startsWith('0x') && val.length === 42 ? true : 'Must be valid 42-character 0x EVM address.';
        },
      },
    ]);
    to = ans.to;
  }

  const fromAddress = getWalletAddress(token.chain, mode);
  const adapter = getChainAdapter(token.chain, mode);

  const buildSpinner = createSpinner(`Formulating ${token.standard.toUpperCase()} token transfer & estimating fees...`).start();
  try {
    let builtTx;
    if (adapter instanceof EthereumAdapter) {
      builtTx = await adapter.buildERC20Transfer(fromAddress, token.contractAddress, to!, amount!, token.decimals);
    } else if (adapter instanceof TronAdapter) {
      builtTx = await adapter.buildTRC20Transfer(fromAddress, token.contractAddress, to!, amount!, token.decimals);
    } else {
      throw new Error(`Token transfers for ${token.standard.toUpperCase()} are not yet implemented.`);
    }

    buildSpinner.succeed(chalk.green('Token transaction built successfully!'));

    console.log(chalk.bold.white('\n📋 Transaction Review:'));
    console.log(`  Token:         ${chalk.yellow.bold(token.symbol)} (${token.name})`);
    console.log(`  Standard:      ${chalk.cyan.bold(token.standard.toUpperCase())}`);
    console.log(`  From:          ${chalk.cyan(fromAddress)}`);
    console.log(`  To:            ${chalk.cyan(to)}`);
    console.log(`  Amount:        ${chalk.yellow.bold(`${amount} ${token.symbol}`)}`);
    console.log(`  Estimated Fee: ${chalk.red.bold(builtTx.estimatedFee)}`);
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

    const sendSpinner = createSpinner(`Signing and broadcasting ${token.standard.toUpperCase()} transaction...`).start();
    try {
      const mnemonic = unlockVault(password);
      const keys = deriveAllKeys(mnemonic, undefined, mode);
      const privateKey =
        token.chain === 'trx'
          ? keys.trx.privateKey
          : token.chain === 'sol'
          ? keys.sol.privateKey
          : keys.eth.privateKey;

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
      chalk.cyan.bold('Standard'),
      chalk.cyan.bold('Name'),
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Decimals'),
      chalk.cyan.bold('Contract / Mint Address'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const t of tokens) {
    table.push([
      chalk.bold.yellow(t.symbol),
      chalk.cyan(t.standard.toUpperCase()),
      chalk.white(t.name),
      chalk.white(t.chain.toUpperCase()),
      chalk.white(t.decimals.toString()),
      chalk.gray(t.contractAddress),
    ]);
  }

  console.log(chalk.bold.white(`\n📋 Configured Tokens (${mode.toUpperCase()}):\n`));
  console.log(table.toString());
  console.log('');
}
