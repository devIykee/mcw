#!/usr/bin/env node

/**
 * Multi-Chain CLI Wallet (MCW) & Agentic Framework
 *
 * Entry Point & Exportable SDK:
 * Automatically branches into either Human CLI mode or Agentic MCP Server mode,
 * and exports programmatic TypeScript/JavaScript SDK for developer bot integration.
 */

import { setupCli } from './cli/index.js';
import { startMcpServer } from './mcp/server.js';

export * from './sdk/index.js';

async function main() {
  const args = process.argv.slice(2);

  // Check if invoked in MCP server mode (stdio transport)
  if (args.includes('mcp') || args.includes('--mcp') || process.env.MCP_MODE === 'true') {
    // When running as an MCP server, stdout is dedicated to JSON-RPC messages.
    // Human logs/debug messages should only be piped to stderr.
    try {
      await startMcpServer();
    } catch (error: any) {
      console.error('[MCW] MCP Server fatal error:', error.message);
      process.exit(1);
    }
  } else {
    // Interactive Human CLI mode
    const program = setupCli();
    await program.parseAsync(process.argv);
  }
}

// Only execute CLI runner if running as a direct script/binary
if (process.argv[1] && (process.argv[1].endsWith('mcw') || process.argv[1].endsWith('index.js') || process.argv[1].includes('bin'))) {
  main().catch((err) => {
    console.error('[MCW] Fatal error:', err);
    process.exit(1);
  });
}
