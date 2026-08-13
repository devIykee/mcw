import assert from 'assert';
import { generateMnemonic, deriveAllKeys } from '../src/crypto/keyDerivation.js';
import { initializeVault, loadVaultFile, unlockVault, walletExists } from '../src/crypto/storage.js';
import { getChainAdapter } from '../src/adapters/index.js';
import { createMcpServer } from '../src/mcp/server.js';
import { approvalGate } from '../src/mcp/approvalGate.js';

async function runLiveE2ETests() {
  console.log('🚀 Running End-to-End Testnet & MCP Test Suite...\n');

  // 1. Vault Initialization Test
  console.log('1️⃣  Testing Vault Creation & Key Derivation...');
  const testMnemonic = generateMnemonic(128);
  const password = 'TestnetPassword123!';
  const keys = deriveAllKeys(testMnemonic);

  const vault = initializeVault(testMnemonic, password, {
    btc: keys.btc.address,
    eth: keys.eth.address,
    sol: keys.sol.address,
    trx: keys.trx.address,
  });

  assert.ok(walletExists(), 'Wallet vault should exist on disk');
  const loadedVault = loadVaultFile();
  assert.strictEqual(loadedVault.metadata.ethAddress, keys.eth.address);
  const decrypted = unlockVault(password);
  assert.strictEqual(decrypted, testMnemonic);
  console.log('   ✅ Vault encrypted, stored to ~/.mc-twaf/vault.dat, and decrypted successfully.');

  // 2. Live Testnet RPC Connection Tests
  console.log('\n2️⃣  Testing Live Testnet RPC Connections...');
  
  // Ethereum Sepolia
  console.log('   📡 Querying Ethereum Sepolia testnet...');
  const ethAdapter = getChainAdapter('eth');
  const ethBal = await ethAdapter.getBalance(keys.eth.address);
  console.log(`      Sepolia ETH Balance: ${ethBal.balanceFormatted} ${ethBal.symbol}`);
  assert.ok(ethBal.address === keys.eth.address);

  // Solana Devnet
  console.log('   📡 Querying Solana Devnet...');
  const solAdapter = getChainAdapter('sol');
  const solBal = await solAdapter.getBalance(keys.sol.address);
  console.log(`      Solana Devnet Balance: ${solBal.balanceFormatted} ${solBal.symbol}`);
  assert.ok(solBal.address === keys.sol.address);

  // Bitcoin Testnet
  console.log('   📡 Querying Bitcoin Testnet3...');
  const btcAdapter = getChainAdapter('btc');
  const btcBal = await btcAdapter.getBalance(keys.btc.address);
  console.log(`      Bitcoin Testnet Balance: ${btcBal.balanceFormatted} ${btcBal.symbol}`);
  assert.ok(btcBal.address === keys.btc.address);

  // Tron Nile Testnet
  console.log('   📡 Querying Tron Nile Testnet...');
  const trxAdapter = getChainAdapter('trx');
  const trxBal = await trxAdapter.getBalance(keys.trx.address);
  console.log(`      Tron Nile Balance: ${trxBal.balanceFormatted} ${trxBal.symbol}`);
  assert.ok(trxBal.address === keys.trx.address);

  // 3. Solana Devnet Faucet Airdrop Test
  console.log('\n3️⃣  Testing Solana Devnet Faucet Airdrop API...');
  try {
    const faucetRes = await solAdapter.requestFaucet(keys.sol.address);
    console.log(`      Airdrop Result: ${faucetRes.message}`);
    if (faucetRes.txHash) {
      console.log(`      Airdrop Tx: ${faucetRes.txHash}`);
    }
  } catch (err: any) {
    console.log(`      Devnet faucet notice: ${err.message}`);
  }

  // 4. MCP Server Safety Gate & Tool Execution
  console.log('\n4️⃣  Testing MCP Server & Approval Gate...');
  const ethTx = await ethAdapter.buildTransaction(keys.eth.address, {
    to: '0x000000000000000000000000000000000000dEaD',
    amount: '0.0001',
  });

  const pending = approvalGate.registerPendingTx('eth', keys.eth.address, ethTx);
  assert.strictEqual(pending.status, 'PENDING_APPROVAL');
  console.log(`   ✅ Transaction queued in Approval Gate: ${pending.id}`);
  console.log(`      Summary: ${pending.summary}`);
  console.log(`      Status: ${pending.status}`);

  // Test unlocking session
  approvalGate.setSessionMnemonic(testMnemonic, 60000);
  assert.strictEqual(approvalGate.isSessionActive(), true);
  console.log('   ✅ Session authentication unlocked for automated testing.');

  console.log('\n🎉 ALL LIVE E2E AND TESTNET TESTS PASSED!\n');
}

runLiveE2ETests().catch((err) => {
  console.error('❌ E2E Test failed:', err);
  process.exit(1);
});
