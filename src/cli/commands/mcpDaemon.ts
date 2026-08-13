import chalk from 'chalk';
import { startMcpServer } from '../../mcp/server.js';
import { walletExists } from '../../crypto/storage.js';

export async function mcpDaemonCommand(): Promise<void> {
  if (!walletExists()) {
    console.error(chalk.red('[MC-TWAF] Error: Cannot start MCP server without an initialized wallet.'));
    console.error(chalk.yellow('[MC-TWAF] Run `mc-twaf init` (or `npx @deviykee/mc-twaf init`) first in CLI mode to generate or import your encrypted vault.'));
    process.exit(1);
  }

  await startMcpServer();
}
