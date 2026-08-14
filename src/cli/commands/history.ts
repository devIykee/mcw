import chalk from 'chalk';
import Table from 'cli-table3';
import { HistoryManager } from '../../history/historyManager.js';
import { getNetworkMode } from '../../config/chains.js';

export async function historyCommand(chainArg?: string, limitArg?: string): Promise<void> {
  const mode = getNetworkMode();
  let limit = limitArg ? parseInt(limitArg, 10) : 15;
  let chain = chainArg;

  if (chainArg && !isNaN(parseInt(chainArg, 10)) && !limitArg) {
    limit = parseInt(chainArg, 10);
    chain = undefined;
  }

  const entries = HistoryManager.getHistory({
    chain,
    networkMode: mode,
    limit,
  });

  if (entries.length === 0) {
    console.log(chalk.yellow(`\nℹ️  No transaction history logged for ${mode.toUpperCase()}.\n`));
    return;
  }

  console.log(chalk.bold.cyan(`\n📜 Audit Logging & Transaction History (${mode.toUpperCase()}):\n`));

  const table = new Table({
    head: [
      chalk.cyan.bold('Timestamp'),
      chalk.cyan.bold('Type'),
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Amount / Asset'),
      chalk.cyan.bold('Status'),
      chalk.cyan.bold('Memo / Tx Hash'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const h of entries) {
    const timeStr = new Date(h.timestamp).toLocaleString();
    const typeLabel =
      h.type === 'swap'
        ? chalk.magenta.bold('SWAP')
        : h.type === 'token_send'
        ? chalk.blue.bold('TOKEN')
        : h.type === 'safe_proposal'
        ? chalk.yellow.bold('SAFE')
        : chalk.green.bold('SEND');

    const statusLabel =
      h.status === 'confirmed' || h.status === 'submitted'
        ? chalk.green(h.status)
        : h.status === 'simulated'
        ? chalk.cyan('simulated')
        : chalk.red(h.status);

    const desc = h.txHash
      ? `${h.txHash.substring(0, 16)}...`
      : h.agentMemo || h.toAddress || 'Direct Operation';

    table.push([
      chalk.gray(timeStr),
      typeLabel,
      chalk.white(h.chain.toUpperCase()),
      chalk.yellow.bold(`${h.amount || ''} ${h.symbol || ''}`),
      statusLabel,
      chalk.white(desc),
    ]);
  }

  console.log(table.toString());
  console.log('');
}
