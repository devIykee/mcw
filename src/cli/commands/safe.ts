import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getNetworkMode } from '../../config/chains.js';
import { SafeManager } from '../../safe/safeManager.js';
import { HistoryManager } from '../../history/historyManager.js';
import { walletExists } from '../../crypto/storage.js';

export async function safeCommand(
  action?: string,
  safeAddressArg?: string,
  toArg?: string,
  amountArg?: string,
  dataArg?: string
): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` first.\n'));
    return;
  }

  const mode = getNetworkMode();

  let safeAddress = safeAddressArg;
  let to = toArg;
  let amount = amountArg;
  let data = dataArg || '0x';

  if (action === 'propose' && safeAddress && to && amount) {
    await runSafeProposal('eth', mode, safeAddress, to, amount, data);
    return;
  }

  // Interactive Safe Proposal Wizard
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'safeAddress',
      message: 'Enter Gnosis Safe Multisig Address (0x...):',
      default: safeAddress,
      validate: (v: string) => (v.trim().startsWith('0x') && v.trim().length === 42 ? true : 'Must be valid 0x Safe address.'),
    },
    {
      type: 'input',
      name: 'to',
      message: 'Enter Destination Recipient Address:',
      default: to,
      validate: (v: string) => (v.trim().startsWith('0x') && v.trim().length === 42 ? true : 'Must be valid 0x address.'),
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Enter Amount in ETH to propose:',
      default: amount || '0.01',
      validate: (v: string) => (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 ? true : 'Enter valid amount.'),
    },
    {
      type: 'input',
      name: 'data',
      message: 'Enter optional hex calldata (default: 0x):',
      default: '0x',
    },
  ]);

  await runSafeProposal('eth', mode, answers.safeAddress, answers.to, answers.amount, answers.data);
}

async function runSafeProposal(
  chain: string,
  mode: any,
  safeAddress: string,
  to: string,
  amount: string,
  data: string
): Promise<void> {
  try {
    const proposal = await SafeManager.proposeTransaction(safeAddress, chain, mode, to, amount, data);

    const table = new Table({
      head: [chalk.cyan.bold('Safe Proposal Property'), chalk.cyan.bold('Value')],
      style: { head: [], border: ['gray'] },
    });

    table.push(
      [chalk.bold('Safe Multisig'), chalk.white(proposal.safeAddress)],
      [chalk.bold('Destination (To)'), chalk.cyan(proposal.to)],
      [chalk.bold('Value'), chalk.yellow.bold(`${proposal.value} ETH`)],
      [chalk.bold('Nonce'), chalk.white(proposal.nonce.toString())],
      [chalk.bold('SafeTxHash (EIP-712)'), chalk.green.bold(proposal.safeTxHash)],
      [chalk.bold('Operation'), chalk.white(proposal.operation === 0 ? 'CALL (0)' : 'DELEGATECALL (1)')]
    );

    console.log(chalk.bold.green(`\n✅ Gnosis Safe Multisig Proposal Formulated Successfully:\n`));
    console.log(table.toString());

    HistoryManager.logTransaction({
      type: 'safe_proposal',
      chain,
      networkMode: mode,
      fromAddress: safeAddress,
      toAddress: to,
      amount,
      symbol: 'ETH',
      status: 'submitted',
      agentMemo: `Proposed Safe multisig transfer of ${amount} ETH to ${to} (SafeTxHash: ${proposal.safeTxHash})`,
    });

    console.log(chalk.bold.white('\n📋 EIP-712 Signing Instructions:'));
    console.log(chalk.gray('  1. Owners can now sign this proposal using Ledger/Trezor hardware wallet or Safe{Core} SDK.'));
    console.log(chalk.gray(`  2. SafeTxHash: ${proposal.safeTxHash}\n`));
  } catch (err: any) {
    console.log(chalk.red(`\n❌ Failed to formulate Safe proposal: ${err.message}\n`));
  }
}
