# 🚀 Multi-Chain CLI Wallet (MCW) & Agentic Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Standard%20Server-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-@deviykee/mc--twaf-red.svg)](https://www.npmjs.com/package/@deviykee/mc-twaf)

A robust, enterprise-grade multi-chain wallet and AI agent framework serving two primary consumers seamlessly:
1. **Humans:** Via a rich, interactive, and beautiful Command Line Interface (**`mcw`**).
2. **AI Agents:** Via a standard **Model Context Protocol (MCP)** server interface, exposing wallet capabilities as MCP Tools to agents (Claude Desktop, Cursor, Gemini CLI, LangChain, AutoGPT).

---

## 🌐 Supported Networks & Derivation Standards

| Blockchain | Testnet Networks | Mainnet Network | Derivation Standard | Derivation Path | Address Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bitcoin (BTC)** | Testnet3 / Signet | Mainnet | BIP-84 / BIP-44 | `m/84'/(1'\|0')/0'/0/0` | Native SegWit (`tb1q...` / `bc1q...`) |
| **Ethereum (ETH)**| Sepolia / Holesky | Mainnet | BIP-44 | `m/44'/60'/0'/0/0` | Checksummed (`0x...`) |
| **Solana (SOL)**  | Devnet | Mainnet-Beta | SLIP-0010 / BIP-44 | `m/44'/501'/0'/0'` | Base58 (`...`) |
| **Tron (TRX)**    | **Nile / Shasta** | Mainnet | BIP-44 | `m/44'/195'/0'/0/0`| Base58Check (`T...`) |

---

## ⚡ Quick Start (CLI: `mcw`)

You can run `mcw` globally on your machine (via `npm link` or `npm i -g @deviykee/mc-twaf`) or with **zero installation** via `npx @deviykee/mc-twaf`.

### 1. Initialize Wallet
Generates a fresh 12/24-word BIP-39 mnemonic phrase (or imports an existing one), encrypts the vault using **AES-256-GCM with Scrypt key derivation**, and displays derived addresses:

```bash
mcw init
# Or zero-install:
npx @deviykee/mc-twaf init
```

### 2. Switch Between Testnet & Mainnet
Toggle environments with safety guards and confirmation prompts:

```bash
# View active network mode
mcw network

# Switch to Testnet (risk-free)
mcw network testnet

# Switch to Mainnet (live assets)
mcw network mainnet
```

### 3. Check Live Balances
Queries live RPCs and displays formatted ASCII tables:

```bash
# Check all chains in active network
mcw balance

# Check a specific chain
mcw balance eth
mcw balance sol
mcw balance btc
mcw balance trx
```

### 4. Tron Nile vs Shasta Selection & Custom RPCs
Configure custom RPC endpoints or toggle between Tron testnet flavors:

```bash
# Switch Tron testnet to Shasta
mcw config tron shasta

# Switch Tron testnet to Nile
mcw config tron nile

# Set a custom RPC URL for any chain (e.g. Alchemy / QuickNode / local node)
mcw config set-rpc eth https://your-custom-eth-node.com
mcw config set-rpc sol https://your-custom-sol-node.com

# View active configurations and custom overrides
mcw config list

# Interactive configuration menu
mcw config
```

### 5. Request Testnet Faucet / Airdrop
Requests instant testnet tokens (with automated JSON-RPC airdrop on Solana Devnet and direct faucet links for other networks):

```bash
mcw faucet sol
mcw faucet eth
mcw faucet trx
mcw faucet btc
```

### 6. Send Coins
Interactively estimates fees, asks for vault decryption password, signs, and broadcasts the transaction:

```bash
# Interactive mode:
mcw send

# Direct parameters:
mcw send sol 0.1 <RECIPIENT_SOL_ADDRESS>
mcw send eth 0.01 <RECIPIENT_ETH_ADDRESS>
```

---

## 🤖 AI Agent MCP Server Integration

MCW implements the official `@modelcontextprotocol/sdk` JSON-RPC specification over `stdio`.

### MCP Configuration for Claude Desktop / Cursor

Add the following to your `claude_desktop_config.json` (or Cursor/Gemini MCP config):

```json
{
  "mcpServers": {
    "mc-wallet": {
      "command": "npx",
      "args": ["-y", "@deviykee/mc-twaf", "mcp"]
    }
  }
}
```

### Available MCP Tools

#### 📖 Read-Only Tools (No password required)
1. **`get_network_mode`**: Returns whether the wallet is in `testnet` or `mainnet`.
2. **`switch_network_mode`**: Toggles between `"testnet"` and `"mainnet"`.
3. **`get_addresses`**: Returns public addresses and derivation paths for Bitcoin, Ethereum, Solana, and Tron.
4. **`get_balance`**: Fetches real-time balances for a specific chain or all chains in the active network.
5. **`get_transaction_status`**: Queries transaction status and confirmation count.
6. **`request_faucet`**: Triggers automated airdrop or returns faucet claim instructions (testnet mode).

#### 🔐 Action Tools (Safety Protected)
7. **`build_transaction`**: Formulates raw transaction, calculates network gas/fees, and queues transaction in the approval gate with status `PENDING_HUMAN_APPROVAL`. Returns a `pendingTxId`.
8. **`sign_and_send_transaction`**: Unlocks vault using human password (or session auth) and broadcasts to the network.
9. **`list_pending_transactions`**: Lists all pending transactions waiting for human approval.

---

## 🔒 Cryptography & Security Model

- **BIP-39:** Mnemonic seed generation with PBKDF2 HMAC-SHA512.
- **BIP-84 / BIP-44 / SLIP-0010:** Native SegWit ECDSA (BTC), Keccak256 ECDSA (ETH & TRX), and Ed25519 (SOL).
- **AES-256-GCM:** Authenticated symmetric encryption with random 96-bit IV and 128-bit authentication tag.
- **Scrypt KDF:** High-iteration, memory-hard key derivation (`N=16384, r=8, p=1, maxmem=64MB`) to guard against brute-force attacks.
- **File System Permissions:** Storage directory (`~/.mcw/`) created with `0700` permissions and encrypted vault (`vault.dat`) saved with `0600` permissions (Unix).

---

## 📜 License
MIT License. Built for multi-chain testnet/mainnet operations and autonomous agent integration.
