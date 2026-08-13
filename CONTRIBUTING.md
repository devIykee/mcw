# Contributing to MCW (Multi-Chain CLI Wallet & Agentic Framework)

First off, thank you for considering contributing to **MCW**! 🎉

MCW is designed to be the foundational multi-chain wallet bridging human developers via an interactive CLI and AI agents via standard Model Context Protocol (MCP) servers.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Development Setup](#development-setup)
3. [Project Architecture](#project-architecture)
4. [How to Add a New Blockchain Adapter](#how-to-add-a-new-blockchain-adapter)
5. [Coding & Cryptography Standards](#coding--cryptography-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Submitting a Pull Request](#submitting-a-pull-request)
8. [Security & Responsible Disclosure](#security--responsible-disclosure)

---

## 🤝 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative in all discussions and code reviews.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**

### 1. Fork & Clone
```bash
git clone https://github.com/devIykee/mcw.git
cd mcw
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build & Local Link
```bash
npm run build
npm link
```

Now the `mcw` command is linked to your local development build!

### 4. Run in Development Watch Mode
```bash
npm run dev -- balance
npm run dev -- network
```

---

## 📁 Project Architecture

```
src/
├── index.ts                   # Master entry point (routes CLI vs MCP Daemon)
├── config/
│   ├── chains.ts              # Network configurations (Testnet / Mainnet / Custom)
│   └── security.ts            # AES-256-GCM, Scrypt KDF parameters & paths
├── crypto/
│   ├── cipher.ts              # Authenticated AES-256-GCM Encryption / Decryption
│   ├── keyDerivation.ts       # BIP-39 mnemonic + Multi-Chain Key Derivation
│   └── storage.ts             # Secure vault storage (~/.mcw/vault.dat)
├── adapters/
│   ├── base.ts                # Abstract BaseChainAdapter class
│   ├── btcAdapter.ts          # Bitcoin (Testnet3 & Mainnet SegWit)
│   ├── ethAdapter.ts          # EVM (Sepolia & Mainnet EIP-1559)
│   ├── solAdapter.ts          # Solana (Devnet & Mainnet Ed25519)
│   ├── trxAdapter.ts          # Tron (Nile, Shasta & Mainnet)
│   └── index.ts               # Adapter factory & registry
├── mcp/
│   ├── schemas.ts             # Zod validation schemas for AI agent tools
│   ├── approvalGate.ts        # Human-in-the-loop Safety Gate & Session Manager
│   └── server.ts              # Standard MCP Server (@modelcontextprotocol/sdk)
└── cli/
    ├── index.ts               # Commander.js CLI root
    ├── ui.ts                  # Chalk banners, tables, and spinners
    └── commands/
        ├── init.ts            # `mcw init`
        ├── balance.ts         # `mcw balance`
        ├── network.ts         # `mcw network`
        ├── config.ts          # `mcw config`
        ├── send.ts            # `mcw send`
        ├── faucet.ts          # `mcw faucet`
        └── mcpDaemon.ts       # `mcw mcp`
```

---

## 🔌 How to Add a New Blockchain Adapter

To add support for a new blockchain (e.g. Cosmos, Aptos, TON, Sui):

1. **Add Network Configurations** in `src/config/chains.ts`:
   - Define derivation path (BIP-44 coin type).
   - Define testnet and mainnet RPC URLs, explorer URLs, and faucet URLs.

2. **Implement Key Derivation** in `src/crypto/keyDerivation.ts`:
   - Derive the public/private keypair and address using appropriate curves (secp256k1, Ed25519, sr25519).

3. **Create Chain Adapter** in `src/adapters/<newChain>Adapter.ts`:
   - Extend `BaseChainAdapter` and implement:
     - `getBalance(address)`
     - `buildTransaction(fromAddress, payload)`
     - `signAndSendTransaction(privateKey, builtTx)`
     - `requestFaucet(address)`
     - `getTransactionStatus(txHash)`

4. **Register in Adapter Factory** (`src/adapters/index.ts`).

5. **Add Tests** in `test/wallet.test.ts`.

---

## 🔒 Coding & Cryptography Standards

- **Zero Plaintext Secrets:** Private keys and seed phrases must NEVER be logged to stdout, persisted unencrypted, or returned in read-only MCP queries.
- **Memory-Hard KDF:** Always use Scrypt with minimum `N=16384, r=8, p=1` for password-derived keys.
- **Authenticated Encryption:** Always use AES-256-GCM with a verified 16-byte authentication tag.
- **Human-in-the-Loop Safety:** Any AI agent tool that broadcasts transactions must route through `approvalGate.registerPendingTx` unless an explicit user session token is active.

---

## 🧪 Testing Guidelines

Before opening a pull request, ensure all tests pass:

```bash
# Run unit and integration tests
npm test

# Run TypeScript compilation check
npm run build
```

---

## 🚀 Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Commit your changes following conventional commit syntax:
   ```bash
   git commit -m "feat: add support for Avalanche C-Chain"
   ```
3. Push to your fork:
   ```bash
   git push origin feat/my-new-feature
   ```
4. Open a Pull Request against `main` on [https://github.com/devIykee/mcw](https://github.com/devIykee/mcw).

---

## 🛡️ Security & Responsible Disclosure

If you discover a security vulnerability within MCW, please do **NOT** open a public issue. Instead, report it directly via email to:
📧 **eokorie1911@gmail.com**

All security reports will be acknowledged within 24 hours.

---

Thank you for building the future of agentic and multi-chain tooling with MCW! 🚀
