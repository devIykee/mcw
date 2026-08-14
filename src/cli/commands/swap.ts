import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getNetworkMode } from '../../config/chains.js';
import { DexSwapper } from '../../dex/swapper.js';
import { PolicyEngine } from '../../policy/policyEngine.js';
import { TransactionSimulator } from '../../simulation/simulator.js';
import { HistoryManager } from '../../history/historyManager.js';
import { walletExists, getWalletAddress, unlockVault } from '../../crypto/storage.js';
import { deriveAllKeys } from '../../crypto/keyDerivation.js';
import { getChainAdapter } from '../../adapters/index.js';
import { createSpinner } from '../ui.js';

export async function swapCommand(
  amountArg?: string,
  fromTokenArg?: string,
  toTokenArg?: string,
  chainArg?: string
): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` first.\n'));
    return;
  }

  const mode = getNetworkMode();

  let chain = chainArg || 'eth';
  let fromToken = fromTokenArg;
  let toToken = toTokenArg;
  let amount = amountArg;

  if (!amount || !fromToken || !toToken) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'chain',
        message: `Select Chain for Swap (${mode.toUpperCase()}):`,
        default: 'eth',
        choices: [
          { name: 'Ethereum / Sepolia (Uniswap V3)', value: 'eth' },
          { name: 'Solana Devnet / Mainnet (Jupiter Aggregator)', value: 'sol' },
        ],
      },
      {
        type: 'input',
        name: 'fromToken',
        message: 'Enter token you want to SELL (e.g. ETH, SOL, USDC):',
        default: (ans: any) => (ans.chain === 'sol' ? 'SOL' : 'ETH'),
      },
      {
        type: 'input',
        name: 'toToken',
        message: 'Enter token you want to BUY (e.g. USDC, LINK, USDT):',
        default: 'USDC',
      },
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to swap:',
        default: '0.01',
        validate: (v: string) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0 ? true : 'Enter valid amount.'),
      },
    ]);

    chain = answers.chain;
    fromToken = answers.fromToken.toUpperCase();
    toToken = answers.toToken.toUpperCase();
    amount = answers.amount;
  }

  const spinner = createSpinner(`Routing best swap path on ${chain.toUpperCase()}...`).start();

  try {
    const quote = await DexSwapper.getQuote(chain, mode, fromToken!, toToken!, amount!);
    spinner.succeed(chalk.green(`Optimal route found via ${quote.dexName}!`));

    const fromAddress = getWalletAddress(chain, mode);

    // 1. Policy Guardrails Check
    const policyCheck = PolicyEngine.validateTransaction(chain, quote.dexName, amount!, quote.fromToken);
    if (!policyCheck.allowed) {
      console.log(chalk.red(`\n🚫 POLICY VIOLATION: Swap blocked by guardrails!`));
      console.log(chalk.yellow(`Reason: ${policyCheck.reason}\n`));
      return;
    }

    // 2. Display Quote Table
    const table = new Table({
      head: [chalk.cyan.bold('Swap Property'), chalk.cyan.bold('Details')],
      style: { head: [], border: ['gray'] },
    });

    table.push(
      [chalk.bold('DEX Engine'), chalk.white(quote.dexName)],
      [chalk.bold('You Sell'), chalk.yellow.bold(`${quote.amountIn} ${quote.fromToken}`)],
      [chalk.bold('Expected Output'), chalk.green.bold(`~${quote.expectedAmountOut} ${quote.toToken}`)],
      [chalk.bold('Minimum Received (Slippage: 0.5%)'), chalk.green(`${quote.minAmountOut} ${quote.toToken}`)],
      [chalk.bold('Price Impact'), chalk.white(`${quote.priceImpactPercent}%`)],
      [chalk.bold('Routing Path'), chalk.gray(quote.routeSummary)],
      [chalk.bold('Wallet Address'), chalk.gray(fromAddress)]
    );

    console.log(chalk.bold.white(`\n📊 DEX Swap Preview (${mode.toUpperCase()}):\n`));
    console.log(table.toString());

    // 3. Dry-run Simulation
    console.log(chalk.bold.cyan(`\n🔬 Running Pre-Flight Simulation (Dry Run)...`));
    const simSpinner = createSpinner('Simulating swap execution...').start();
    if (chain === 'sol') {
      const sim = await TransactionSimulator.simulateSolana(mode, fromAddress, fromAddress, amount!);
      simSpinner.succeed(chalk.green(`Simulation Result: ${sim.status}`));
    } else {
      const sim = await TransactionSimulator.simulateEVM(chain, mode, fromAddress, fromAddress, amount!);
      simSpinner.succeed(chalk.green(`Simulation Result: ${sim.status} (Estimated Gas: ${sim.gasOrFeeEstimated})`));
    }

    // 4. Confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Execute swap: ${quote.amountIn} ${quote.fromToken} ➔ ~${quote.expectedAmountOut} ${quote.toToken}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n❌ Swap canceled.\n'));
      return;
    }

    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: 'Enter vault password to sign swap transaction:',
        mask: '*',
      },
    ]);

    const execSpinner = createSpinner('Signing and executing swap...').start();
    try {
      const mnemonic = unlockVault(password);
      const keys = deriveAllKeys(mnemonic, undefined, mode);
      const privateKey = chain === 'sol' ? keys.sol.privateKey : keys.eth.privateKey;
      const adapter = getChainAdapter(chain, mode);

      const builtTx = DexSwapper.buildEVMSwapTransaction(chain, mode, fromAddress, quote);
      const result = await adapter.signAndSendTransaction(privateKey, builtTx);

      PolicyEngine.recordSpend(chain, amount!);
      HistoryManager.logTransaction({
        type: 'swap',
        chain,
        networkMode: mode,
        fromAddress,
        amount: quote.amountIn,
        symbol: `${quote.fromToken}->${quote.toToken}`,
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        status: 'submitted',
        agentMemo: `Swapped ${quote.amountIn} ${quote.fromToken} for ~${quote.expectedAmountOut} ${quote.toToken} on ${quote.dexName}`,
      });

      execSpinner.succeed(chalk.green('Swap broadcasted successfully!'));
      console.log(`\n🎉 Tx Hash: ${chalk.cyan.bold(result.txHash)}`);
      console.log(`🔗 Explorer: ${chalk.underline.blue(result.explorerUrl)}\n`);
    } catch (err: any) {
      execSpinner.fail(chalk.red(`Swap failed: ${err.message}`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed to get swap quote: ${err.message}`));
  }
}
