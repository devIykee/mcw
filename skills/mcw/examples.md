# MCW Agent Usage Examples & Prompt Templates

Real-world interaction patterns and prompts for CLI agents like Claude Code, Grok, Cursor, and Gemini.

---

## 🌟 Example 1: Automated Testnet Exploration & Funding

### User Prompt:
> *"Check my testnet balances across all chains. If my Solana devnet balance is zero, request a faucet airdrop for me."*

### Agent Action Sequence:
1. Run `mcw balance` to inspect balances.
2. If Solana Devnet shows `0.000000 SOL`, trigger `mcw faucet sol`.
3. Re-run `mcw balance sol` to confirm receipt of the 1.0 SOL airdrop.
4. Report back to the user with a formatted balance summary.

---

## 🌟 Example 2: Safe Transaction Formulation & Approval

### User Prompt:
> *"I want to send 0.05 SepoliaETH to 0x000000000000000000000000000000000000dEaD. Calculate the gas fee and prepare the transaction."*

### Agent Action Sequence:
1. Verify the network mode is `testnet` with `mcw network`.
2. Formulate the transaction using `mcw send eth 0.05 0x000000000000000000000000000000000000dEaD` (or via MCP `build_transaction`).
3. Present the estimated gas fee and summary to the human.
4. Request password from user to decrypt vault and broadcast.
5. Provide the transaction hash and block explorer link.

---

## 🌟 Example 3: Switching to Tron Shasta Testnet

### User Prompt:
> *"Switch my Tron environment to the Shasta testnet and check my Shasta TRX balance."*

### Agent Action Sequence:
1. Run `mcw config tron shasta`.
2. Run `mcw balance trx`.
3. Provide the user with their Shasta address and live balance.

---

## 🌟 Example 4: Configuring a Custom Alchemy / QuickNode RPC

### User Prompt:
> *"Configure my Ethereum Sepolia RPC to use my private Alchemy endpoint: https://eth-sepolia.g.alchemy.com/v2/my-secret-key"*

### Agent Action Sequence:
1. Run `mcw config set-rpc eth https://eth-sepolia.g.alchemy.com/v2/my-secret-key`.
2. Run `mcw config list` to verify the active override.
3. Query `mcw balance eth` through the new RPC to ensure connectivity.

---

## 🌟 Example 5: Mainnet Safeguard Verification

### User Prompt:
> *"Switch to mainnet and check my real Bitcoin and Ethereum balances."*

### Agent Action Sequence:
1. Run `mcw network mainnet`.
2. Run `mcw balance btc` and `mcw balance eth`.
3. Display the balances with prominent `⚠️ MAINNET (REAL ASSETS)` badges.
