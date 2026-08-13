import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { loadVaultFile, walletExists, getWalletAddress } from '../crypto/storage.js';
import { getChainAdapter, EthereumAdapter } from '../adapters/index.js';
import { SupportedChain, getChainConfig, getNetworkMode, setNetworkMode, NetworkMode, getAllChains } from '../config/chains.js';
import { getAllTokens, findToken, saveCustomToken, TokenConfig } from '../config/tokens.js';
import { approvalGate } from './approvalGate.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'mcw-mcp-server',
      version: '1.0.2',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * List Available Tools to AI Agent
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_network_mode',
          description: 'Get the currently active network environment (testnet or mainnet).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'switch_network_mode',
          description: 'Switch active network environment between "testnet" and "mainnet".',
          inputSchema: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                enum: ['testnet', 'mainnet'],
                description: 'Target network environment ("testnet" for risk-free testing, "mainnet" for live assets)',
              },
            },
            required: ['mode'],
          },
        },
        {
          name: 'get_addresses',
          description:
            'Retrieve public addresses for all supported blockchains (Bitcoin, Ethereum, Solana, Tron) for the current network mode.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_balance',
          description:
            'Fetch real-time balances for a specific blockchain or all chains in the active network environment.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'The target chain (e.g. btc, eth, sol, trx, or custom chain). If omitted, returns balances for all chains.',
              },
            },
          },
        },
        {
          name: 'get_token_balance',
          description:
            'Query balance of an ERC-20 / SPL token (e.g. Sepolia USDC, LINK) by token symbol or contract address.',
          inputSchema: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'Token symbol (e.g. "USDC", "LINK") or contract address',
              },
              chain: {
                type: 'string',
                description: 'Blockchain name (default: "eth")',
              },
            },
            required: ['token'],
          },
        },
        {
          name: 'add_token',
          description: 'Configure and track a new ERC-20 or SPL token contract.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'Target blockchain (e.g. "eth", "base-sepolia", "polygon")',
              },
              contractAddress: {
                type: 'string',
                description: 'Smart contract address for ERC-20 or Mint address for SPL',
              },
              symbol: {
                type: 'string',
                description: 'Token symbol (e.g. "USDC", "DAI")',
              },
              name: {
                type: 'string',
                description: 'Token full name (e.g. "USD Coin")',
              },
              decimals: {
                type: 'number',
                description: 'Token decimals (default: 18, 6 for USDC)',
              },
            },
            required: ['chain', 'contractAddress', 'symbol'],
          },
        },
        {
          name: 'get_transaction_status',
          description: 'Query confirmation status and receipt of a transaction.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'The target blockchain',
              },
              txHash: {
                type: 'string',
                description: 'The transaction hash or signature',
              },
            },
            required: ['chain', 'txHash'],
          },
        },
        {
          name: 'request_faucet',
          description: 'Request testnet funds/airdrop from faucets (Only works in testnet mode).',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'The target blockchain (btc, eth, sol, trx)',
              },
            },
            required: ['chain'],
          },
        },
        {
          name: 'build_transaction',
          description:
            'Formulate and validate a transaction payload, calculate gas/fees, and create a pending transaction requiring human approval.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'Target chain',
              },
              to: {
                type: 'string',
                description: 'Recipient public address',
              },
              amount: {
                type: 'string',
                description: 'Amount in human units (e.g. "0.01")',
              },
              data: {
                type: 'string',
                description: 'Optional transaction hex data or memo',
              },
            },
            required: ['chain', 'to', 'amount'],
          },
        },
        {
          name: 'sign_and_send_transaction',
          description:
            'Sign and broadcast a pending or new transaction. Requires user approval password or active session.',
          inputSchema: {
            type: 'object',
            properties: {
              pendingTxId: {
                type: 'string',
                description: 'The pending transaction ID returned by build_transaction',
              },
              chain: {
                type: 'string',
                description: 'Chain if executing direct send',
              },
              to: {
                type: 'string',
                description: 'Recipient if executing direct send',
              },
              amount: {
                type: 'string',
                description: 'Amount if executing direct send',
              },
              approvalPassword: {
                type: 'string',
                description: 'Vault decryption password for approval',
              },
            },
          },
        },
        {
          name: 'list_pending_transactions',
          description: 'List all transactions queued in the approval gate awaiting human confirmation.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  /**
   * Handle Tool Invocations
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const mode = getNetworkMode();

    if (name === 'get_network_mode') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ activeNetworkMode: mode }, null, 2),
          },
        ],
      };
    }

    if (name === 'switch_network_mode') {
      const targetMode = args?.mode as NetworkMode;
      if (targetMode !== 'testnet' && targetMode !== 'mainnet') {
        throw new McpError(ErrorCode.InvalidParams, 'mode must be "testnet" or "mainnet".');
      }
      setNetworkMode(targetMode);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, activeNetworkMode: targetMode }, null, 2),
          },
        ],
      };
    }

    if (!walletExists()) {
      return {
        content: [
          {
            type: 'text',
            text: 'ERROR: Wallet not initialized. Please run `mcw init` (or `npx @deviykee/mcw init`) in the CLI first.',
          },
        ],
        isError: true,
      };
    }

    try {
      switch (name) {
        case 'get_addresses': {
          const addresses = {
            networkMode: mode,
            bitcoin: {
              address: getWalletAddress('btc', mode),
              network: getChainConfig('btc', mode).networkName,
              derivationPath: getChainConfig('btc', mode).derivationPath,
            },
            ethereum: {
              address: getWalletAddress('eth', mode),
              network: getChainConfig('eth', mode).networkName,
              derivationPath: getChainConfig('eth', mode).derivationPath,
            },
            solana: {
              address: getWalletAddress('sol', mode),
              network: getChainConfig('sol', mode).networkName,
              derivationPath: getChainConfig('sol', mode).derivationPath,
            },
            tron: {
              address: getWalletAddress('trx', mode),
              network: getChainConfig('trx', mode).networkName,
              derivationPath: getChainConfig('trx', mode).derivationPath,
            },
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(addresses, null, 2),
              },
            ],
          };
        }

        case 'get_balance': {
          const chain = (args?.chain as string) || undefined;
          const chainsToQuery = chain ? [chain] : getAllChains(mode);
          const results = [];

          for (const c of chainsToQuery) {
            const adapter = getChainAdapter(c, mode);
            const address = getWalletAddress(c, mode);
            const bal = await adapter.getBalance(address);
            results.push(bal);
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case 'get_token_balance': {
          const tokenSearch = args?.token as string;
          const chain = (args?.chain as string) || 'eth';
          if (!tokenSearch) {
            throw new McpError(ErrorCode.InvalidParams, 'token parameter is required.');
          }

          const token = findToken(tokenSearch, mode, chain);
          const tokenAddress = token ? token.contractAddress : tokenSearch;
          const decimals = token ? token.decimals : 18;

          const adapter = getChainAdapter(chain, mode);
          const walletAddr = getWalletAddress(chain, mode);

          if (!(adapter instanceof EthereumAdapter)) {
            throw new McpError(ErrorCode.InvalidParams, 'Token querying is currently supported on EVM chains.');
          }

          const bal = await adapter.getERC20Balance(tokenAddress, walletAddr, decimals);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(bal, null, 2),
              },
            ],
          };
        }

        case 'add_token': {
          const chain = args?.chain as string;
          const contractAddress = args?.contractAddress as string;
          const symbol = (args?.symbol as string).toUpperCase();
          const name = (args?.name as string) || `${symbol} Token`;
          const decimals = typeof args?.decimals === 'number' ? args.decimals : 18;

          if (!chain || !contractAddress || !symbol) {
            throw new McpError(ErrorCode.InvalidParams, 'chain, contractAddress, and symbol are required.');
          }

          const id = `${symbol.toLowerCase()}-${chain.toLowerCase()}`;
          saveCustomToken({
            id,
            symbol,
            name,
            chain,
            networkMode: mode,
            contractAddress,
            decimals,
            standard: chain === 'sol' ? 'spl' : chain === 'trx' ? 'trc20' : 'erc20',
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, token: { id, symbol, name, chain, contractAddress, decimals } }, null, 2),
              },
            ],
          };
        }

        case 'get_transaction_status': {
          const chain = args?.chain as string;
          const txHash = args?.txHash as string;
          if (!chain || !txHash) {
            throw new McpError(ErrorCode.InvalidParams, 'chain and txHash are required.');
          }

          const adapter = getChainAdapter(chain, mode);
          const status = await adapter.getTransactionStatus(txHash);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ chain, networkMode: mode, txHash, ...status }, null, 2),
              },
            ],
          };
        }

        case 'request_faucet': {
          const chain = args?.chain as string;
          if (!chain) {
            throw new McpError(ErrorCode.InvalidParams, 'chain parameter is required.');
          }

          if (mode === 'mainnet') {
            return {
              content: [
                {
                  type: 'text',
                  text: 'ERROR: Faucets are only available on Testnet. Switch network mode to "testnet" using switch_network_mode.',
                },
              ],
              isError: true,
            };
          }

          const address = getWalletAddress(chain, mode);
          const adapter = getChainAdapter(chain, mode);
          const faucetRes = await adapter.requestFaucet(address);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(faucetRes, null, 2),
              },
            ],
          };
        }

        case 'build_transaction': {
          const chain = args?.chain as string;
          const to = args?.to as string;
          const amount = args?.amount as string;
          const data = args?.data as string | undefined;

          if (!chain || !to || !amount) {
            throw new McpError(ErrorCode.InvalidParams, 'chain, to, and amount are required.');
          }

          const fromAddress = getWalletAddress(chain, mode);
          const adapter = getChainAdapter(chain, mode);
          const builtTx = await adapter.buildTransaction(fromAddress, { to, amount, data });

          // Register in Approval Gate
          const pending = approvalGate.registerPendingTx(chain as SupportedChain, fromAddress, builtTx);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'PENDING_HUMAN_APPROVAL',
                    networkMode: mode,
                    notice:
                      mode === 'mainnet'
                        ? '⚠️ MAINNET GUARD: Transaction formulated for MAINNET (REAL FUNDS). Paused awaiting human approval.'
                        : 'Safety Guard Active: Transaction built successfully but paused awaiting approval.',
                    pendingTxId: pending.id,
                    chain: pending.chain,
                    from: pending.fromAddress,
                    to: pending.toAddress,
                    amount: pending.amount,
                    estimatedFee: pending.estimatedFee,
                    summary: pending.summary,
                    approvalInstruction: `To broadcast, invoke sign_and_send_transaction with pendingTxId: "${pending.id}" and approvalPassword.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'sign_and_send_transaction': {
          let pendingTxId = args?.pendingTxId as string | undefined;
          const password = args?.approvalPassword as string | undefined;

          if (!pendingTxId && args?.chain && args?.to && args?.amount) {
            const chain = args.chain as string;
            const fromAddress = getWalletAddress(chain, mode);
            const adapter = getChainAdapter(chain, mode);
            const builtTx = await adapter.buildTransaction(fromAddress, {
              to: args.to as string,
              amount: args.amount as string,
            });
            const pending = approvalGate.registerPendingTx(chain as SupportedChain, fromAddress, builtTx);
            pendingTxId = pending.id;
          }

          if (!pendingTxId) {
            throw new McpError(ErrorCode.InvalidParams, 'pendingTxId is required.');
          }

          const broadcastResult = await approvalGate.executeTransaction(pendingTxId, password);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    ...broadcastResult,
                    networkMode: mode,
                    pendingTxId,
                    status: 'BROADCAST_SUCCESS',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'list_pending_transactions': {
          const pending = approvalGate.listPendingTxs();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(pending, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${name}': ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCW] MCP Server connected via stdio transport. Listening for agent requests...');
}
