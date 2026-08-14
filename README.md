# MCW (Multi-Chain CLI Wallet & Agentic Framework)

![License](https://img.shields.io/badge/License-CC--BY--4.0-blue.svg)
![npm](https://img.shields.io/npm/v/@deviykee/mcw.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)

> **A non-custodial multi-chain wallet, HD sub-account engine, multi-seed profile manager, DEX aggregator, and agentic framework for Bitcoin, Ethereum, Solana, and Tron. Built for humans via an interactive CLI and for AI agents via Model Context Protocol (MCP).**

---

## 🌟 Key Features

- **🔑 Single Seed, 4 Blockchains:** Deterministically derives Bitcoin (`tb1q`/`bc1q`), Ethereum (`0x...`), Solana (`Base58`), and Tron (`T...`) addresses from a single BIP-39 mnemonic phrase.
- **👤 BIP-44 HD Sub-Account Indexing (`mcw account`):** Derive infinite independent sub-accounts (Account #0, #1, #2...) from a single seed phrase without needing new backups.
- **💼 Multi-Seed Profile Vaults (`mcw wallet`):** Manage multiple completely separate seed phrases (e.g. `trading-bot`, `personal`, `client-vault`) with isolated encryption keys.
- **🛡️ Policy Guardrails & Spend Limits (`mcw policy`):** Protect against rogue agent actions with per-transaction limits, 24-hour rolling spend caps, and address whitelists/blacklists.
- **🔄 Built-in DEX Aggregator (`mcw swap`):** Automated testnet/mainnet swap routing across **Uniswap V3** (EVM) and **Jupiter Aggregator** (Solana).
- **🔬 Pre-Flight Transaction Simulation:** Dry-run transactions using `eth_call` and Solana `simulateTransaction` before broadcast to view gas consumption and asset deltas.
- **🪙 Multi-Chain Smart Contract Tokens:** Track, auto-detect, and transfer **ERC-20** (Ethereum/Sepolia/L2s), **SPL** (Solana Devnet/Mainnet), and **TRC-20** (Tron Shasta/Nile/Mainnet) tokens.
- **📜 Local Audit Memory (`mcw history`):** Persistent logging of all agent transactions, swaps, and memos for multi-session agent recall.
- **🔐 Gnosis Safe Multisig Integration (`mcw safe`):** Formulate multi-sig proposals and generate EIP-712 typed data for hardware wallet (Ledger/Trezor) approval.
- **🤖 Standard MCP Daemon (20+ Tools):** Exposes JSON-RPC tools for AI agents (Claude Code, Cursor, Grok, Gemini CLI).
- **📦 Programmatic TypeScript SDK (`@deviykee/mcw`):** Direct SDK for LangChain, Vercel AI SDK, and autonomous bot developers.

---

## 🚀 Quick Start (Zero-Install)

Run instantly using `npx`:

```bash
# Initialize a new wallet (or restore with existing seed phrase)
npx @deviykee/mcw init

# List or derive sub-accounts from your seed
npx @deviykee/mcw account list
npx @deviykee/mcw account create "Trading Bot Account"

# Manage multiple seed phrase profiles
npx @deviykee/mcw wallet list
npx @deviykee/mcw wallet create bot-profile

# Check live multi-chain balances
npx @deviykee/mcw balance

# Auto-detect and track any token contract on-chain
npx @deviykee/mcw token add 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# Swap tokens via DEX router
npx @deviykee/mcw swap 0.1 ETH USDC
```

---

## 📦 Global Installation

```bash
npm install -g @deviykee/mcw@latest
```

---

## 🛠️ CLI Commands & Usage

### 1. Initialize Wallet
```bash
mcw init
```

### 2. BIP-44 HD Sub-Account Indexing (`mcw account`)
Derive multiple independent accounts from your single master seed phrase:
```bash
mcw account list                  # View all derived sub-accounts and multi-chain addresses
mcw account create "Agent Bot"    # Derive Account #1 with dedicated keys
mcw account switch 1              # Set Account #1 as the active account
```

### 3. Multi-Seed Profile Vaults (`mcw wallet`)
Manage multiple independent seed phrases with isolated encrypted vaults:
```bash
mcw wallet list                   # List all wallet profiles
mcw wallet create trading-vault   # Generate fresh seed phrase in new profile
mcw wallet import personal-vault  # Import existing seed phrase into new profile
mcw wallet switch trading-vault   # Switch active profile
mcw wallet delete old-vault       # Delete a profile vault
```

### 4. View Balances
```bash
mcw balance         # Live table across BTC, ETH, SOL, TRX & Custom Chains
mcw balance eth     # Specific chain balance
```

### 5. Multi-Chain Token Management (ERC-20, SPL, TRC-20)
```bash
# 1. 1-Command Auto-Detection & Tracking (Auto-fetches symbol, name, decimals on-chain)
mcw token add 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238   # Sepolia USDC (ERC-20)
mcw token add TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs           # Shasta USDT (TRC-20)

# 2. Check token balances
mcw token balance
mcw token balance usdc-eth

# 3. Transfer tokens
mcw token send usdc-eth 10 0xRecipientAddress...
mcw token send usdt-trx 50 TRecipientAddress...

# 4. List all configured tokens
mcw token list
```

### 6. Built-in DEX Aggregation (`mcw swap`)
```bash
mcw swap 0.1 ETH USDC        # Uniswap V3 swap quote & execution
mcw swap 0.5 SOL USDC sol    # Jupiter DEX swap on Solana
```

### 7. Policy Guardrails & Spend Limits (`mcw policy`)
```bash
# View active policies
mcw policy list

# Set maximum spend per tx and 24h rolling limit
mcw policy set-limit eth 0.5 2.0

# Add trusted recipient to whitelist
mcw policy whitelist eth 0x1234567890123456789012345678901234567890

# Block malicious address
mcw policy blacklist eth 0xBadActorAddress...

# Enable/Disable guardrails
mcw policy toggle
```

### 8. Local Audit Logging (`mcw history`)
```bash
mcw history        # View recent transactions and agent memos
mcw history eth 10 # Filter by chain and limit
```

### 9. Gnosis Safe Multisig Proposal (`mcw safe`)
```bash
mcw safe propose 0xSafeAddress... 0xRecipientAddress... 0.1
```

### 10. Custom EVM Chains & RPC Overrides (`mcw config`)
```bash
# Toggle Tron testnet flavor
mcw config tron shasta
mcw config tron nile

# Custom RPC override
mcw config set-rpc eth https://your-alchemy-node.com
mcw config list
```

---

## 🤖 AI Agent MCP Server Integration

MCW implements the official `@modelcontextprotocol/sdk` JSON-RPC specification over `stdio`.

### MCP Configuration (`claude_desktop_config.json` / Cursor / Grok)

```json
{
  "mcpServers": {
    "mcw": {
      "command": "npx",
      "args": ["-y", "@deviykee/mcw", "mcp"]
    }
  }
}
```

### Available MCP Tools

| Tool Name | Type | Description |
| :--- | :--- | :--- |
| `list_accounts` | Read | Lists all HD sub-accounts derived under active seed |
| `create_account` | Action | Derives a new HD sub-account from current seed |
| `switch_account` | Action | Switches active account index for subsequent operations |
| `list_wallets` | Read | Lists all independent seed phrase wallet profiles |
| `create_wallet` | Action | Generates a new wallet profile with fresh seed |
| `switch_wallet` | Action | Switches active wallet profile |
| `get_addresses` | Read | Returns public addresses and derivation paths across all chains |
| `get_balance` | Read | Live native balances for BTC, ETH, SOL, TRX, and Custom Chains |
| `get_token_balance` | Read | Real-time smart contract balances (ERC-20, SPL, TRC-20) |
| `add_token` | Action | Auto-detects chain and metadata on-chain to track new tokens |
| `swap_tokens` | Action | DEX routing and quotation with human approval gate |
| `simulate_transaction` | Action | Pre-flight dry run simulation with asset delta tracking |
| `get_transaction_history`| Read | Local audit memory and past transaction logs |
| `get_policies` | Read | Spend limits and safety guardrails status |
| `propose_safe_transaction` | Action | Formulate Gnosis Safe multi-sig proposals with EIP-712 hash |
| `build_transaction` | Action | Validates policy, simulates call, and queues for approval |
| `sign_and_send_transaction`| Auth | Signs and broadcasts pending transaction with human password |

---

## 📦 Programmatic TypeScript SDK

Developers can import `McwWallet` directly into TypeScript / JavaScript applications:

```typescript
import { McwWallet, DexSwapper, PolicyEngine, listWallets } from '@deviykee/mcw';

// 1. Instantiate wallet with master seed
const wallet = new McwWallet('your twelve word mnemonic seed phrase...', 'testnet');

// Account #0 (Main Account)
const mainAddresses = wallet.getAddresses(0);
console.log('Account 0 ETH:', mainAddresses.eth);

// Account #1 (Sub-Account)
const botAddresses = wallet.getAddresses(1);
console.log('Account 1 ETH:', botAddresses.eth);

// Query balance for Account 1
const balance = await wallet.getBalance('eth', 1);

// Pre-flight transaction simulation
const sim = await wallet.simulate('eth', '0xRecipient...', '0.1');
console.log('Simulation Status:', sim.status, 'Gas:', sim.gasOrFeeEstimated);

// Get DEX swap quote
const quote = await DexSwapper.getQuote('eth', 'testnet', 'ETH', 'USDC', '0.5');
console.log(`Expected Output: ${quote.expectedAmountOut} USDC via ${quote.dexName}`);
```

---

## 📜 Attribution & License

- **Author:** deviykee (`eokorie1911@gmail.com`)
- **License:** Creative Commons Attribution 4.0 International (`CC-BY-4.0`)
