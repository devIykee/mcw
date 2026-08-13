# 🚀 Multi-Chain Testnet Wallet & Agentic Framework (MC-TWAF)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Standard%20Server-green.svg)](https://modelcontextprotocol.io/)
[![Testnet Only](https://img.shields.io/badge/Guard-Testnet%20Only-red.svg)](#-hardcoded-testnet-safety-guards)

A robust, enterprise-grade multi-chain testnet wallet framework serving two primary consumers seamlessly:
1. **Humans:** Via a rich, interactive, and beautiful Command Line Interface (CLI).
2. **AI Agents:** Via a standard **Model Context Protocol (MCP)** server interface, exposing all wallet capabilities as MCP Tools to agents (Claude Desktop, Cursor, Gemini CLI, LangChain, AutoGPT).

---

## 🌐 Supported Networks & Derivation Standards

| Blockchain | Testnet Network | Derivation Standard | Derivation Path | Curve & Alg | Address Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bitcoin (BTC)** | Testnet3 / Signet | BIP-84 / BIP-44 | `m/84'/1'/0'/0/0` | ECDSA (secp256k1) | Native SegWit (`tb1q...`) |
| **Ethereum (ETH)**| Sepolia / Holesky | BIP-44 | `m/44'/60'/0'/0/0` | ECDSA (secp256k1) | Checksummed (`0x...`) |
| **Solana (SOL)**  | Devnet | SLIP-0010 / BIP-44 | `m/44'/501'/0'/0'` | Ed25519 | Base58 (`...`) |
| **Tron (TRX)**    | Nile / Shasta | BIP-44 | `m/44'/195'/0'/0/0`| ECDSA (secp256k1) | Base58Check (`T...`) |

---

## 🛡️ Hardcoded Testnet Safety Guards

MC-TWAF is engineered with hardcoded guards to strictly prevent mainnet fund loss:
- **RPC Whitelisting & Blacklist Filtering:** Active regex guards block all known mainnet endpoints (`mainnet`, `api.mainnet-beta.solana.com`, `api.trongrid.io` without testnet path).
- **EVM Chain ID Checks:** Chain ID `1` (Ethereum Mainnet), `56` (BSC), `137` (Polygon), `42161` (Arbitrum) are blocked at the adapter layer, throwing a fatal `MainnetViolationError`.
- **Approval Gate for AI Agents:** Autonomous agents can assemble transaction payloads (`build_transaction`), but execution is held in a `PENDING_HUMAN_APPROVAL` queue until decrypted with the user's password.

---

## 📁 Project Architecture

```
mc-twaf/
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript NodeNext configuration
├── README.md                      # Complete system documentation
├── test/
│   └── wallet.test.ts             # Full cryptographic & integration test suite
└── src/
    ├── index.ts                   # Master entry point (routes to CLI or MCP)
    ├── config/
    │   ├── chains.ts              # Chain configs, RPCs, and Mainnet Guards
    │   └── security.ts            # AES-256-GCM, Scrypt parameters, paths
    ├── crypto/
    │   ├── cipher.ts              # AES-256-GCM Authenticated Encryption
    │   ├── keyDerivation.ts       # BIP-39 mnemonic + Multi-Chain Derivations
    │   └── storage.ts             # Secure vault persistence (vault.dat)
    ├── adapters/
    │   ├── base.ts                # Abstract Chain Adapter interface
    │   ├── btcAdapter.ts          # Bitcoin Testnet UTXO & PSBT Adapter
    │   ├── ethAdapter.ts          # Ethereum Sepolia EIP-1559 Adapter
    │   ├── solAdapter.ts          # Solana Devnet Connection & Airdrop Adapter
    │   ├── trxAdapter.ts          # Tron Nile Testnet HTTP/RPC Adapter
    │   └── index.ts               # Adapter Registry & Factory
    ├── mcp/
    │   ├── schemas.ts             # Zod input schemas for MCP tools
    │   ├── approvalGate.ts        # Human-in-the-loop Approval & Session Gate
    │   └── server.ts              # Standard MCP Server (@modelcontextprotocol/sdk)
    └── cli/
        ├── index.ts               # Commander.js CLI Program definition
        ├── ui.ts                  # Chalk banners, cli-table3 & ora spinners
        └── commands/
            ├── init.ts            # `wallet init` (New/Import Seed + Vault Encrypt)
            ├── balance.ts         # `wallet balance [chain]` (ASCII table)
            ├── send.ts            # `wallet send [chain] [amount] [to]`
            ├── faucet.ts          # `wallet faucet [chain]` (Auto airdrops)
            └── mcpDaemon.ts       # `wallet mcp` (Launch MCP server on stdio)
```

---

## ⚡ Quick Start

### 1. Installation

```bash
git clone <repo-url>
cd cli-wallet
npm install
npm run build
```

### 2. Run the Test Suite

```bash
npx tsx test/wallet.test.ts
```

---

## 🖥️ Human CLI Usage

### Initialize Wallet
Generates a fresh 12/24-word BIP-39 mnemonic phrase (or imports an existing one), encrypts the vault using **AES-256-GCM with Scrypt key derivation**, and displays derived addresses across all 4 chains:

```bash
# Global binary (after npm link or npm i -g @deviykee/mc-twaf)
mc-twaf init

# Or zero-install via npx:
npx @deviykee/mc-twaf init
```

### Check Testnet Balances
Queries live testnet RPCs and displays balances in a clean ASCII table:

```bash
# Query all chains
mc-twaf balance

# Query a specific chain
mc-twaf balance eth
mc-twaf balance sol
mc-twaf balance btc
mc-twaf balance trx

# Or zero-install via npx:
npx @deviykee/mc-twaf balance
```

### Request Testnet Faucet / Airdrop
Requests instant testnet tokens (with automated JSON-RPC airdrop on Solana Devnet and direct faucet links for other networks):

```bash
mc-twaf faucet sol
mc-twaf faucet eth

# Or zero-install via npx:
npx @deviykee/mc-twaf faucet sol
```

### Send Testnet Funds
Interactively estimates gas/fees, prompts for confirmation, asks for vault decryption password, signs, and broadcasts the transaction:

```bash
# Interactive mode:
mc-twaf send

# Direct parameters:
mc-twaf send sol 0.1 <RECIPIENT_SOL_ADDRESS>
mc-twaf send eth 0.01 <RECIPIENT_ETH_ADDRESS>

# Or zero-install via npx:
npx @deviykee/mc-twaf send
```

---

## 🤖 AI Agent MCP Server Integration

MC-TWAF implements the official `@modelcontextprotocol/sdk` JSON-RPC specification over `stdio`.

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
1. **`get_addresses`**: Returns public testnet addresses and derivation paths for Bitcoin, Sepolia, Solana, and Tron.
2. **`get_balance`**: Fetches real-time testnet balances for a specific chain or all chains.
3. **`get_transaction_status`**: Queries transaction status and confirmation count from testnet explorers.
4. **`request_faucet`**: Triggers automated airdrop or returns faucet claim instructions.

#### 🔐 Action Tools (Safety Protected)
5. **`build_transaction`**: Formulates raw transaction, calculates network gas/fees, and queues transaction in the approval gate with status `PENDING_HUMAN_APPROVAL`. Returns a `pendingTxId`.
6. **`sign_and_send_transaction`**: Unlocks vault using human password (or session auth) and broadcasts to the testnet.
7. **`list_pending_transactions`**: Lists all pending transactions waiting for human approval.

---

## 🔒 Cryptography & Security Model

- **BIP-39:** Mnemonic seed generation with PBKDF2 HMAC-SHA512.
- **AES-256-GCM:** Authenticated symmetric encryption with random 96-bit IV and 128-bit authentication tag.
- **Scrypt KDF:** High-iteration, memory-hard key derivation (`N=16384, r=8, p=1, maxmem=64MB`) to guard against brute-force attacks.
- **File System Permissions:** The storage directory (`~/.mc-twaf/`) is created with `0700` permissions and the encrypted vault (`vault.dat`) is saved with `0600` permissions (Unix).

---

## 📜 License
MIT License. Built for multi-chain testnet exploration and agentic development.
