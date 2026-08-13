import chalk from 'chalk';
import { startMcpServer } from '../../mcp/server.js';
import { walletExists } from '../../crypto/storage.js';

export async function mcpDaemonCommand(): Promise<void> {
  if (!walletExists()) {
    console.error(chalk.red('[MCW] Error: Cannot start MCP server without an initialized wallet.'));
    console.error(chalk.yellow('[MCW] Run `mcw init` (or `npx @deviykee/mcw init`) first in CLI mode to generate or import your encrypted vault.'));
    process.exit(1);
  }

  await startMcpServer();
}
