import chalk from 'chalk';
import { walletExists, getWalletAddress } from '../../crypto/storage.js';
import { getChainAdapter } from '../../adapters/index.js';
import { getNetworkMode, getAllChains } from '../../config/chains.js';
import { renderBalanceTable, createSpinner } from '../ui.js';

export async function balanceCommand(chainArg?: string): Promise<void> {
  if (!walletExists()) {
    console.log(chalk.red('\n❌ Wallet not initialized. Please run `mcw init` (or `npx @deviykee/mcw init`) first.\n'));
    return;
  }

  const mode = getNetworkMode();
  const validChains = getAllChains(mode);

  let chainsToFetch: string[] = validChains;
  if (chainArg) {
    const normalized = chainArg.toLowerCase();
    if (!validChains.includes(normalized)) {
      console.log(chalk.red(`\n❌ Unknown chain '${chainArg}'. Available in ${mode}: ${validChains.join(', ')}\n`));
      return;
    }
    chainsToFetch = [normalized];
  }

  console.log(chalk.bold.cyan(`\n💰 Fetching Live ${mode.toUpperCase()} Balances...\n`));
  const spinner = createSpinner(`Querying ${mode} RPC endpoints...`).start();

  try {
    const results = await Promise.all(
      chainsToFetch.map(async (chain) => {
        const adapter = getChainAdapter(chain, mode);
        const address = getWalletAddress(chain, mode);
        return adapter.getBalance(address);
      })
    );

    spinner.stop();

    renderBalanceTable(
      results.map((res) => ({
        chain: res.chain,
        network: res.network,
        symbol: res.symbol,
        balanceFormatted: res.balanceFormatted,
        address: res.address,
      }))
    );
    console.log('');
  } catch (error: any) {
    spinner.fail(chalk.red(`Failed to fetch balances: ${error.message}`));
  }
}
