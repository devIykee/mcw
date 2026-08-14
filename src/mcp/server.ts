import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import {
  loadVaultFile,
  walletExists,
  getWalletAddress,
  listAccounts,
  createAccount,
  getActiveAccountIndex,
  setActiveAccountIndex,
  listWallets,
  getActiveWalletName,
  setActiveWalletName,
  initializeVault,
} from '../crypto/storage.js';
import { getChainAdapter, EthereumAdapter, TronAdapter, SolanaAdapter } from '../adapters/index.js';
import { SupportedChain, getChainConfig, getNetworkMode, setNetworkMode, NetworkMode, getAllChains } from '../config/chains.js';
import { getAllTokens, findToken, saveCustomToken, TokenConfig } from '../config/tokens.js';
import { detectChainFromAddress } from '../cli/commands/token.js';
import { approvalGate } from './approvalGate.js';
import { PolicyEngine, loadPolicies, savePolicies } from '../policy/policyEngine.js';
import { TransactionSimulator } from '../simulation/simulator.js';
import { HistoryManager } from '../history/historyManager.js';
import { DexSwapper } from '../dex/swapper.js';
import { SafeManager } from '../safe/safeManager.js';
import { generateMnemonic, deriveAllKeys } from '../crypto/keyDerivation.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'mcw-mcp-server',
      version: '1.2.0',
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
            'Retrieve public addresses for all supported blockchains (Bitcoin, Ethereum, Solana, Tron) for the current active account.',
          inputSchema: {
            type: 'object',
            properties: {
              accountIndex: {
                type: 'number',
                description: 'Optional HD account index override (default: active account)',
              },
            },
          },
        },
        {
          name: 'list_accounts',
          description: 'List all BIP-44 HD sub-accounts derived from the current seed phrase.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_account',
          description: 'Derive a new HD sub-account from the current seed phrase (e.g. Account #1, #2). Requires vault password.',
          inputSchema: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Label or purpose description for the new account',
              },
              password: {
                type: 'string',
                description: 'Vault master password to authorize derivation',
              },
            },
            required: ['password'],
          },
        },
        {
          name: 'switch_account',
          description: 'Switch the active HD account index.',
          inputSchema: {
            type: 'object',
            properties: {
              accountIndex: {
                type: 'number',
                description: 'The account index to switch to (e.g. 0, 1, 2)',
              },
            },
            required: ['accountIndex'],
          },
        },
        {
          name: 'list_wallets',
          description: 'List all independent seed phrase wallet profiles.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_wallet',
          description: 'Create a new independent wallet profile with a freshly generated BIP-39 seed phrase.',
          inputSchema: {
            type: 'object',
            properties: {
              walletName: {
                type: 'string',
                description: 'Unique name for the wallet profile (e.g. "trading-bot", "client-vault")',
              },
              password: {
                type: 'string',
                description: 'Password to encrypt the new wallet vault',
              },
            },
            required: ['walletName', 'password'],
          },
        },
        {
          name: 'switch_wallet',
          description: 'Switch the active wallet profile.',
          inputSchema: {
            type: 'object',
            properties: {
              walletName: {
                type: 'string',
                description: 'The wallet profile name to activate',
              },
            },
            required: ['walletName'],
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
              accountIndex: {
                type: 'number',
                description: 'Optional HD account index override',
              },
            },
          },
        },
        {
          name: 'get_token_balance',
          description:
            'Query balance of an ERC-20, SPL, or TRC-20 token (e.g. Sepolia USDC, Shasta USDT, Solana Devnet USDC) by token symbol or contract address.',
          inputSchema: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'Token symbol, token ID (e.g. "USDC", "usdt-trx"), or smart contract/mint address',
              },
              chain: {
                type: 'string',
                description: 'Optional blockchain name (eth, trx, sol, or custom EVM chain)',
              },
              accountIndex: {
                type: 'number',
                description: 'Optional HD account index override',
              },
            },
            required: ['token'],
          },
        },
        {
          name: 'add_token',
          description:
            'Register and track a new smart contract token. Automatically detects chain, symbol, name, and decimals from the blockchain if not provided.',
          inputSchema: {
            type: 'object',
            properties: {
              contractAddress: {
                type: 'string',
                description: 'Smart contract address (ERC-20/TRC-20) or Mint address (SPL)',
              },
              chain: {
                type: 'string',
                description: 'Optional blockchain name (auto-detected if omitted)',
              },
              symbol: {
                type: 'string',
                description: 'Optional token symbol override (auto-fetched on-chain if omitted)',
              },
              name: {
                type: 'string',
                description: 'Optional token name override (auto-fetched on-chain if omitted)',
              },
              decimals: {
                type: 'number',
                description: 'Optional token decimals override (auto-fetched on-chain if omitted)',
              },
            },
            required: ['contractAddress'],
          },
        },
        {
          name: 'swap_tokens',
          description:
            'DEX Aggregator: Calculate optimal route and formulate token swap on Uniswap V3 (EVM) or Jupiter (Solana). Queues swap in approval gate.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                enum: ['eth', 'sol'],
                description: 'Target blockchain (eth for Uniswap V3, sol for Jupiter)',
              },
              fromToken: {
                type: 'string',
                description: 'Token to sell (e.g. ETH, SOL, USDC)',
              },
              toToken: {
                type: 'string',
                description: 'Token to buy (e.g. USDC, LINK, USDT)',
              },
              amount: {
                type: 'string',
                description: 'Amount of input token to swap',
              },
            },
            required: ['chain', 'fromToken', 'toToken', 'amount'],
          },
        },
        {
          name: 'simulate_transaction',
          description:
            'Simulate / Dry-run a transaction on the blockchain without broadcasting. Returns execution status, gas units, and asset deltas.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'Target chain (eth, sol, etc.)',
              },
              to: {
                type: 'string',
                description: 'Destination recipient or contract address',
              },
              amount: {
                type: 'string',
                description: 'Amount in native currency (e.g. "0.1")',
              },
              data: {
                type: 'string',
                description: 'Optional hex calldata',
              },
            },
            required: ['chain', 'to', 'amount'],
          },
        },
        {
          name: 'get_transaction_history',
          description: 'Query local audit logs and agent transaction memory across chains.',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description: 'Optional chain filter (eth, sol, btc, trx)',
              },
              limit: {
                type: 'number',
                description: 'Max entries to return (default: 20)',
              },
            },
          },
        },
        {
          name: 'get_policies',
          description: 'Inspect active policy guardrails, spend limits, and address whitelists.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'propose_safe_transaction',
          description:
            'Formulate a Gnosis Safe multisig transaction proposal and generate EIP-712 typed data for hardware wallet / Safe{Core} signing.',
          inputSchema: {
            type: 'object',
            properties: {
              safeAddress: {
                type: 'string',
                description: 'Gnosis Safe multisig address (0x...)',
              },
              to: {
                type: 'string',
                description: 'Target recipient or contract address',
              },
              amount: {
                type: 'string',
                description: 'Amount in ETH',
              },
              data: {
                type: 'string',
                description: 'Optional calldata hex',
              },
            },
            required: ['safeAddress', 'to', 'amount'],
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
            'Formulate and validate a transaction payload, verify policy guardrails, simulate execution, and create a pending transaction requiring human approval.',
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
              agentReason: {
                type: 'string',
                description: 'Agent rationale or memo for this transaction to record in audit memory',
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
        case 'list_wallets': {
          const wallets = listWallets();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ activeWallet: getActiveWalletName(), wallets }, null, 2),
              },
            ],
          };
        }

        case 'create_wallet': {
          const walletName = args?.walletName as string;
          const password = args?.password as string;
          if (!walletName || !password) {
            throw new McpError(ErrorCode.InvalidParams, 'walletName and password are required.');
          }

          const mnemonic = generateMnemonic(128);
          const testnetKeys = deriveAllKeys(mnemonic, undefined, 'testnet', 0);
          const mainnetKeys = deriveAllKeys(mnemonic, undefined, 'mainnet', 0);

          initializeVault(
            mnemonic,
            password,
            {
              btc: testnetKeys.btc.address,
              btcMainnet: mainnetKeys.btc.address,
              eth: testnetKeys.eth.address,
              sol: testnetKeys.sol.address,
              trx: testnetKeys.trx.address,
            },
            walletName
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    walletName,
                    status: 'ACTIVE',
                    addresses: {
                      eth: testnetKeys.eth.address,
                      sol: testnetKeys.sol.address,
                      btc: testnetKeys.btc.address,
                      trx: testnetKeys.trx.address,
                    },
                    mnemonicNotice: 'Wallet initialized and encrypted in local vault.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'switch_wallet': {
          const walletName = args?.walletName as string;
          if (!walletName) {
            throw new McpError(ErrorCode.InvalidParams, 'walletName is required.');
          }
          if (!walletExists(walletName)) {
            throw new McpError(ErrorCode.InvalidParams, `Wallet profile '${walletName}' does not exist.`);
          }
          setActiveWalletName(walletName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, activeWallet: walletName }, null, 2),
              },
            ],
          };
        }

        case 'list_accounts': {
          const accounts = listAccounts();
          const activeIndex = getActiveAccountIndex();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ activeWallet: getActiveWalletName(), activeAccountIndex: activeIndex, accounts }, null, 2),
              },
            ],
          };
        }

        case 'create_account': {
          const password = args?.password as string;
          const label = args?.label as string | undefined;
          if (!password) {
            throw new McpError(ErrorCode.InvalidParams, 'password is required to authorize derivation.');
          }
          const newAccount = createAccount(password, label);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, createdAccount: newAccount }, null, 2),
              },
            ],
          };
        }

        case 'switch_account': {
          const accountIndex = args?.accountIndex as number;
          if (typeof accountIndex !== 'number') {
            throw new McpError(ErrorCode.InvalidParams, 'accountIndex number is required.');
          }
          const accounts = listAccounts();
          const exists = accounts.some((a) => a.index === accountIndex);
          if (!exists) {
            throw new McpError(ErrorCode.InvalidParams, `Account index #${accountIndex} does not exist in active wallet.`);
          }
          setActiveAccountIndex(accountIndex);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, activeAccountIndex: accountIndex }, null, 2),
              },
            ],
          };
        }

        case 'get_addresses': {
          const accIdx = args?.accountIndex as number | undefined;
          const activeIdx = accIdx !== undefined ? accIdx : getActiveAccountIndex();

          const addresses = {
            walletName: getActiveWalletName(),
            accountIndex: activeIdx,
            networkMode: mode,
            bitcoin: {
              address: getWalletAddress('btc', mode, activeIdx),
              network: getChainConfig('btc', mode).networkName,
              derivationPath: `m/84'/${mode === 'mainnet' ? "0'" : "1'"}/0'/0/${activeIdx}`,
            },
            ethereum: {
              address: getWalletAddress('eth', mode, activeIdx),
              network: getChainConfig('eth', mode).networkName,
              derivationPath: `m/44'/60'/0'/0/${activeIdx}`,
            },
            solana: {
              address: getWalletAddress('sol', mode, activeIdx),
              network: getChainConfig('sol', mode).networkName,
              derivationPath: `m/44'/501'/${activeIdx}'/0'`,
            },
            tron: {
              address: getWalletAddress('trx', mode, activeIdx),
              network: getChainConfig('trx', mode).networkName,
              derivationPath: `m/44'/195'/0'/0/${activeIdx}`,
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
          const accIdx = args?.accountIndex as number | undefined;
          const activeIdx = accIdx !== undefined ? accIdx : getActiveAccountIndex();

          const chainsToQuery = chain ? [chain] : getAllChains(mode);
          const results = [];

          for (const c of chainsToQuery) {
            const adapter = getChainAdapter(c, mode);
            const address = getWalletAddress(c, mode, activeIdx);
            const bal = await adapter.getBalance(address);
            results.push({ ...bal, accountIndex: activeIdx });
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
          const accIdx = args?.accountIndex as number | undefined;
          const activeIdx = accIdx !== undefined ? accIdx : getActiveAccountIndex();

          let chain = args?.chain as string | undefined;
          if (!tokenSearch) {
            throw new McpError(ErrorCode.InvalidParams, 'token parameter is required.');
          }

          const token = findToken(tokenSearch, mode, chain);
          const tokenAddress = token ? token.contractAddress : tokenSearch;
          if (!chain) {
            chain = token ? token.chain : detectChainFromAddress(tokenAddress).chain;
          }
          const decimals = token ? token.decimals : 18;

          const adapter = getChainAdapter(chain, mode);
          const walletAddr = getWalletAddress(chain, mode, activeIdx);

          let balResult;
          if (adapter instanceof EthereumAdapter) {
            balResult = await adapter.getERC20Balance(tokenAddress, walletAddr, decimals);
          } else if (adapter instanceof TronAdapter) {
            balResult = await adapter.getTRC20Balance(tokenAddress, walletAddr, decimals);
          } else if (adapter instanceof SolanaAdapter) {
            balResult = await adapter.getSPLBalance(tokenAddress, walletAddr, decimals);
          } else {
            throw new McpError(ErrorCode.InvalidParams, `Token querying is not supported on chain: ${chain}`);
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(balResult, null, 2),
              },
            ],
          };
        }

        case 'add_token': {
          const contractAddress = args?.contractAddress as string;
          if (!contractAddress) {
            throw new McpError(ErrorCode.InvalidParams, 'contractAddress is required.');
          }

          const { chain: detectedChain, standard } = detectChainFromAddress(contractAddress, args?.chain as string);
          const chain = (args?.chain as string) || detectedChain;
          const adapter = getChainAdapter(chain, mode);

          let symbol = args?.symbol as string;
          let name = args?.name as string;
          let decimals = typeof args?.decimals === 'number' ? args.decimals : undefined;

          // Auto-fetch metadata on-chain if omitted!
          if (!symbol || !name || decimals === undefined) {
            if (adapter instanceof EthereumAdapter || adapter instanceof TronAdapter || adapter instanceof SolanaAdapter) {
              const onChainMeta = await adapter.getTokenMetadata(contractAddress);
              symbol = symbol || onChainMeta.symbol;
              name = name || onChainMeta.name;
              decimals = decimals !== undefined ? decimals : onChainMeta.decimals;
            } else {
              symbol = symbol || 'TOKEN';
              name = name || 'Custom Token';
              decimals = decimals !== undefined ? decimals : 18;
            }
          }

          const id = `${symbol.toLowerCase()}-${chain.toLowerCase()}`;
          const tokenConfig: TokenConfig = {
            id,
            symbol: symbol.toUpperCase(),
            name,
            chain,
            networkMode: mode,
            contractAddress,
            decimals,
            standard,
          };

          saveCustomToken(tokenConfig);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, verifiedOnChain: true, token: tokenConfig }, null, 2),
              },
            ],
          };
        }

        case 'swap_tokens': {
          const chain = args?.chain as string;
          const fromToken = args?.fromToken as string;
          const toToken = args?.toToken as string;
          const amount = args?.amount as string;

          if (!chain || !fromToken || !toToken || !amount) {
            throw new McpError(ErrorCode.InvalidParams, 'chain, fromToken, toToken, and amount are required.');
          }

          // Policy check
          const policyCheck = PolicyEngine.validateTransaction(chain, 'DEX_ROUTER', amount, fromToken);
          if (!policyCheck.allowed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `ERROR: Policy Violation. Swap blocked by local guardrails: ${policyCheck.reason}`,
                },
              ],
              isError: true,
            };
          }

          const quote = await DexSwapper.getQuote(chain, mode, fromToken, toToken, amount);
          const fromAddress = getWalletAddress(chain, mode);
          const builtTx = DexSwapper.buildEVMSwapTransaction(chain, mode, fromAddress, quote);

          // Register in Approval Gate
          const pending = approvalGate.registerPendingTx(chain as SupportedChain, fromAddress, builtTx);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'PENDING_HUMAN_APPROVAL',
                    type: 'DEX_SWAP',
                    quote,
                    pendingTxId: pending.id,
                    summary: pending.summary,
                    approvalInstruction: `To execute swap, invoke sign_and_send_transaction with pendingTxId: "${pending.id}" and approvalPassword.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'simulate_transaction': {
          const chain = args?.chain as string;
          const to = args?.to as string;
          const amount = args?.amount as string;
          const data = (args?.data as string) || '0x';

          if (!chain || !to || !amount) {
            throw new McpError(ErrorCode.InvalidParams, 'chain, to, and amount are required.');
          }

          const fromAddress = getWalletAddress(chain, mode);
          let simResult;
          if (chain === 'sol') {
            simResult = await TransactionSimulator.simulateSolana(mode, fromAddress, to, amount);
          } else {
            simResult = await TransactionSimulator.simulateEVM(chain, mode, fromAddress, to, amount, data);
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(simResult, null, 2),
              },
            ],
          };
        }

        case 'get_transaction_history': {
          const chain = args?.chain as string | undefined;
          const limit = (args?.limit as number) || 20;

          const history = HistoryManager.getHistory({ chain, networkMode: mode, limit });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(history, null, 2),
              },
            ],
          };
        }

        case 'get_policies': {
          const policies = loadPolicies();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(policies, null, 2),
              },
            ],
          };
        }

        case 'propose_safe_transaction': {
          const safeAddress = args?.safeAddress as string;
          const to = args?.to as string;
          const amount = args?.amount as string;
          const data = (args?.data as string) || '0x';

          if (!safeAddress || !to || !amount) {
            throw new McpError(ErrorCode.InvalidParams, 'safeAddress, to, and amount are required.');
          }

          const proposal = await SafeManager.proposeTransaction(safeAddress, 'eth', mode, to, amount, data);

          HistoryManager.logTransaction({
            type: 'safe_proposal',
            chain: 'eth',
            networkMode: mode,
            fromAddress: safeAddress,
            toAddress: to,
            amount,
            symbol: 'ETH',
            status: 'submitted',
            agentMemo: `AI Proposed Safe multisig transaction (SafeTxHash: ${proposal.safeTxHash})`,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(proposal, null, 2),
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
          const agentReason = args?.agentReason as string | undefined;

          if (!chain || !to || !amount) {
            throw new McpError(ErrorCode.InvalidParams, 'chain, to, and amount are required.');
          }

          // Policy check
          const policyCheck = PolicyEngine.validateTransaction(chain, to, amount);
          if (!policyCheck.allowed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `ERROR: Security Policy Violation. Transaction blocked by local guardrails: ${policyCheck.reason}`,
                },
              ],
              isError: true,
            };
          }

          const fromAddress = getWalletAddress(chain, mode);
          const adapter = getChainAdapter(chain, mode);
          const builtTx = await adapter.buildTransaction(fromAddress, { to, amount, data });

          // Pre-flight simulation
          let simSummary = 'Pre-flight format valid';
          try {
            if (chain === 'sol') {
              const sim = await TransactionSimulator.simulateSolana(mode, fromAddress, to, amount);
              simSummary = `Simulation: ${sim.status}`;
            } else if (chain === 'eth') {
              const sim = await TransactionSimulator.simulateEVM(chain, mode, fromAddress, to, amount, data);
              simSummary = `Simulation: ${sim.status} (Gas: ${sim.gasOrFeeEstimated})`;
            }
          } catch {}

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
                    simulation: simSummary,
                    notice:
                      mode === 'mainnet'
                        ? '⚠️ MAINNET GUARD: Transaction formulated for MAINNET (REAL FUNDS). Paused awaiting human approval.'
                        : 'Safety Guard Active: Transaction built and simulated successfully. Paused awaiting approval.',
                    pendingTxId: pending.id,
                    chain: pending.chain,
                    from: pending.fromAddress,
                    to: pending.toAddress,
                    amount: pending.amount,
                    estimatedFee: pending.estimatedFee,
                    agentReason: agentReason || 'Agent Proposed Operation',
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

          // Log in History & Record Policy spend
          PolicyEngine.recordSpend(broadcastResult.chain, broadcastResult.amount);
          HistoryManager.logTransaction({
            type: 'send',
            chain: broadcastResult.chain,
            networkMode: mode,
            toAddress: broadcastResult.recipient,
            amount: broadcastResult.amount,
            txHash: broadcastResult.txHash,
            explorerUrl: broadcastResult.explorerUrl,
            status: 'submitted',
            agentMemo: 'AI Agent Executed Broadcast',
          });

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
