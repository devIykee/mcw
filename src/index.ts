#!/usr/bin/env node

/**
 * Multi-Chain Testnet Wallet & Agentic Framework (MC-TWAF)
 *
 * Entry Point:
 * Automatically branches into either Human CLI mode or Agentic MCP Server mode.
 */

import { setupCli } from './cli/index.js';
import { startMcpServer } from './mcp/server.js';

async function main() {
  const args = process.argv.slice(2);

  // Check if invoked in MCP server mode (stdio transport)
  if (args.includes('mcp') || args.includes('--mcp') || process.env.MCP_MODE === 'true') {
    // When running as an MCP server, stdout is dedicated to JSON-RPC messages.
    // Human logs/debug messages should only be piped to stderr.
    try {
      await startMcpServer();
    } catch (error: any) {
      console.error('[MC-TWAF] MCP Server fatal error:', error.message);
      process.exit(1);
    }
  } else {
    // Interactive Human CLI mode
    const program = setupCli();
    await program.parseAsync(process.argv);
  }
}

main().catch((err) => {
  console.error('[MC-TWAF] Fatal error:', err);
  process.exit(1);
});
