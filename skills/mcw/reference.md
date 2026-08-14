# MCW Agent Reference Manual

Complete technical reference for CLI commands and MCP JSON-RPC tools for AI agents.

---

## 🛠️ CLI Command Matrix

| CLI Command | Arguments / Flags | Description | Example |
| :--- | :--- | :--- | :--- |
| `mcw init` | Interactive | Generates or imports a BIP-39 mnemonic, encrypts with AES-256-GCM, derives 4 chain addresses | `mcw init` |
| `mcw balance` | `[chain]` | Fetches real-time balances for all chains or a specified chain | `mcw balance eth` |
| `mcw token balance` | `[token]` | Fetches live balances across ERC-20, SPL, and TRC-20 token contracts | `mcw token balance usdc-eth` |
| `mcw token add` | Interactive | Interactive wizard to register any ERC-20, SPL, or TRC-20 token contract | `mcw token add` |
| `mcw token send` | `[token] [amount] [to]` | Sends ERC-20 or TRC-20 tokens with fee estimation & password approval | `mcw token send usdt-trx 25 TQ7z...` |
| `mcw token list` | None | Displays formatted table of all configured tokens | `mcw token list` |
| `mcw network` | `[testnet \| mainnet]` | Inspects or toggles the active network environment | `mcw network mainnet` |
| `mcw config` | `[action] [chain] [value]` | Configures RPCs, Tron flavors, and custom networks | `mcw config tron shasta` |
| `mcw faucet` | `[chain]` | Requests automated testnet airdrops or outputs faucet portals | `mcw faucet sol` |
| `mcw send` | `[chain] [amount] [to]` | Constructs, confirms, and broadcasts a transaction with password | `mcw send sol 0.1 <addr>` |
| `mcw mcp` | None | Starts the Model Context Protocol stdio daemon for AI agent pairing | `mcw mcp` |

---

## 🤖 MCP JSON-RPC Tools Reference

### 1. `get_network_mode`
- **Type:** Read-Only
- **Description:** Returns the active network mode (`"testnet"` or `"mainnet"`).
- **Parameters:** None
- **Response:** `{ "activeNetworkMode": "testnet" }`

---

### 2. `switch_network_mode`
- **Type:** Action
- **Description:** Switches the active network environment between `"testnet"` and `"mainnet"`.
- **Parameters:**
  - `mode` (string, required): `"testnet"` | `"mainnet"`
- **Response:** `{ "success": true, "activeNetworkMode": "mainnet" }`

---

### 3. `get_addresses`
- **Type:** Read-Only
- **Description:** Returns public addresses, derivation paths, and network names for all 4 chains.
- **Parameters:** None
- **Response:**
```json
{
  "networkMode": "testnet",
  "bitcoin": { "address": "tb1q...", "network": "Bitcoin Testnet3", "derivationPath": "m/84'/1'/0'/0/0" },
  "ethereum": { "address": "0x...", "network": "Sepolia Testnet", "derivationPath": "m/44'/60'/0'/0/0" },
  "solana": { "address": "...", "network": "Solana Devnet", "derivationPath": "m/44'/501'/0'/0'" },
  "tron": { "address": "T...", "network": "Tron Nile Testnet", "derivationPath": "m/44'/195'/0'/0/0" }
}
```

---

### 4. `get_balance`
- **Type:** Read-Only
- **Description:** Fetches live balances from RPC endpoints.
- **Parameters:**
  - `chain` (string, optional): `"btc"` | `"eth"` | `"sol"` | `"trx"`. If omitted, queries all.
- **Response:** Array of balance objects with formatted amounts, symbols, and addresses.

---

### 5. `request_faucet`
- **Type:** Action (Testnet only)
- **Description:** Triggers automated airdrop (Solana) or returns direct pre-filled faucet claim URLs.
- **Parameters:**
  - `chain` (string, required): `"btc"` | `"eth"` | `"sol"` | `"trx"`

---

### 6. `build_transaction`
- **Type:** Action (Human-in-the-Loop Safe)
- **Description:** Formulates transaction, calculates gas/fees, and queues transaction in the approval gate.
- **Parameters:**
  - `chain` (string, required): Target blockchain.
  - `to` (string, required): Destination address.
  - `amount` (string, required): Human-readable amount (e.g. `"0.05"`).
  - `data` (string, optional): Hex data or memo.
- **Response:**
```json
{
  "status": "PENDING_HUMAN_APPROVAL",
  "pendingTxId": "tx_1786643920_e175",
  "chain": "sol",
  "from": "4HVv...",
  "to": "...",
  "amount": "0.1",
  "estimatedFee": "0.000005 SOL",
  "summary": "Send 0.1 SOL to ... on Solana Devnet (Est. Fee: 0.000005 SOL)"
}
```

---

### 7. `sign_and_send_transaction`
- **Type:** Action (Requires Password / Session)
- **Description:** Decrypts vault and broadcasts transaction to the blockchain.
- **Parameters:**
  - `pendingTxId` (string, required): The ID returned by `build_transaction`.
  - `approvalPassword` (string, optional): User's vault password to authorize decryption.
- **Response:** `{ "status": "BROADCAST_SUCCESS", "txHash": "...", "explorerUrl": "..." }`

---

### 8. `list_pending_transactions`
- **Type:** Read-Only
- **Description:** Lists all transactions currently queued in the Approval Gate awaiting human authorization.
