---
name: mcw
description: Multi-Chain Wallet (MCW) agent skill for performing blockchain operations across Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and Tron (TRX) in Testnet and Mainnet environments. Enables autonomous and interactive AI agents (Claude Code, Grok, Cursor, Gemini, OpenHands) to fetch addresses, inspect live balances, request testnet faucets, configure custom RPCs, and build/broadcast transactions with Human-in-the-Loop approval gates.
---

# Multi-Chain Wallet (MCW) Agent Skill

This skill empowers AI agents to seamlessly interact with multi-chain blockchain networks using the **`mcw`** CLI tool and the **`@deviykee/mcw`** Model Context Protocol (MCP) server.

---

## 🎯 Supported Blockchains & Ecosystems

| Chain | Symbol | Testnet Networks | Mainnet Network | Derivation Path | Address Prefix / Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bitcoin** | `BTC` / `tBTC` | Testnet3 / Signet | Mainnet | `m/84'/(1'\|0')/0'/0/0` | `tb1q...` (Testnet) / `bc1q...` (Mainnet) |
| **Ethereum** | `ETH` / `SepoliaETH` | Sepolia / Holesky | Mainnet | `m/44'/60'/0'/0/0` | `0x...` (42-char checksummed hex) |
| **Solana** | `SOL` | Devnet | Mainnet-Beta | `m/44'/501'/0'/0'` | Base58 public key |
| **Tron** | `TRX` | Nile / Shasta | Mainnet | `m/44'/195'/0'/0/0`| `T...` (34-char Base58Check) |

---

## 🤖 How the Agent Should Execute Operations

The agent has two seamless modes of operation:
1. **Via Direct CLI Execution:** Run `mcw <command>` or `npx @deviykee/mcw <command>` via shell tool.
2. **Via Model Context Protocol (MCP):** Invoke MCP tools provided by the `mcw` MCP server.

---

## 🛡️ Critical Safety Protocols for Agents

1. **Default to Testnet:** Always verify the active network mode (`mcw network` or `get_network_mode`). Default to `testnet` unless the user explicitly commands mainnet execution.
2. **Human-in-the-Loop for Transactions:** Never attempt to bypass the password decryption or approval gate. Always formulate the transaction payload first, present the details and estimated fee to the human user, and wait for human confirmation.
3. **Address Validation:** Always ensure recipient addresses match the destination chain's format before proposing a transaction.

---

## 📋 Common Agent Workflows & Commands

### 1. Check Wallet Addresses & Sub-Accounts
Fetch public addresses for the active account:
```bash
# Query active account addresses
mcw balance

# List all HD sub-accounts derived from seed (Account #0, #1, #2)
mcw account list

# Derive a new sub-account with custom label
mcw account create "Trading Agent"

# Switch active account index
mcw account switch 1
```
*Or via MCP:* `get_addresses(accountIndex?)`, `list_accounts`, `create_account`, `switch_account`

---

### 2. Multi-Seed Profile Vaults
Manage multiple independent seed phrases:
```bash
# List all wallet profiles
mcw wallet list

# Create a new isolated wallet profile
mcw wallet create bot-profile

# Switch active wallet profile
mcw wallet switch bot-profile
```
*Or via MCP:* `list_wallets`, `create_wallet`, `switch_wallet`

---

### 3. Query Live Balances
Check balances across all 4 chains or a specific target chain:
```bash
# Query all chains
mcw balance

# Query specific chain (btc | eth | sol | trx)
mcw balance eth
mcw balance sol
mcw balance btc
mcw balance trx
```
*Or via MCP:* `get_balance(chain?: "btc" | "eth" | "sol" | "trx", accountIndex?: number)`

---

### 3. Request Testnet Funds / Airdrops
Automatically airdrop Devnet SOL or retrieve faucet portal links:
```bash
# Automated instant Devnet airdrop (1.0 SOL)
mcw faucet sol

# Sepolia / Shasta / Nile / Bitcoin Testnet faucets
mcw faucet eth
mcw faucet trx
mcw faucet btc
```
*Or via MCP:* `request_faucet(chain: "sol" | "eth" | "trx" | "btc")`

---

### 4. Switch Between Testnet & Mainnet
```bash
# Inspect current network mode
mcw network

# Switch to Testnet (Safe mode)
mcw network testnet

# Switch to Mainnet (Live assets)
mcw network mainnet
```
*Or via MCP:* `switch_network_mode(mode: "testnet" | "mainnet")`

---

### 5. Switch Tron Testnet (Nile vs Shasta)
```bash
mcw config tron shasta
mcw config tron nile
```

---

### 6. Multi-Chain Token Management (ERC-20, SPL, TRC-20)
Agents can auto-detect and track tokens on-chain with 0 manual inputs:
```bash
# 1. Auto-detect & track any token contract (Auto-fetches symbol, name, decimals on-chain)
mcw token add 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238   # Sepolia USDC (ERC-20)
mcw token add TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs           # Shasta USDT (TRC-20)

# 2. Query live token balances
mcw token balance
mcw token balance usdc-eth
mcw token balance usdt-trx

# 3. Transfer tokens
mcw token send usdc-eth 10 0xRecipient...
mcw token send usdt-trx 50 TRecipient...
```
*Or via MCP:*
- `add_token(contractAddress: "0x...")` (Auto-detects chain & metadata)
- `get_token_balance(token: "USDC" | "0x...")`

---

### 7. Configure Custom RPC Endpoints
Configure custom RPC endpoints (e.g. Alchemy, QuickNode, local validator):
```bash
mcw config set-rpc eth https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
mcw config set-rpc sol https://api.devnet.solana.com
mcw config list
```

---

### 8. Formulate and Propose a Transaction
To send funds safely, the agent builds the transaction and presents the summary for human approval:
```bash
mcw send <chain> <amount> <recipient_address>
```
*Example:*
```bash
mcw send sol 0.1 4HVvPDMzVPx4XhBhwMu5YAz6EQh3otyhJ8JQdTjPJJm6
```

---

## 🔌 MCP Configuration for Agents

Add this to your agent's MCP settings (e.g., Claude Desktop `claude_desktop_config.json`, Cursor MCP, or Grok/Gemini CLI):

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

---

## 💡 Troubleshooting & Agent Hints

- If `mcw` reports `Wallet not initialized`, prompt the user to initialize via `mcw init`.
- For Solana devnet airdrops, if a `429 Too Many Requests` error occurs, direct the user to the web faucet link provided in the output.
- All secrets (seed phrases, private keys) are encrypted locally using **AES-256-GCM + Scrypt** in `~/.mcw/vault.dat` with `0600` file permissions.
