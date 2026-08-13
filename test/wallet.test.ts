import assert from 'assert';
import { generateMnemonic, validateMnemonic, deriveAllKeys } from '../src/crypto/keyDerivation.js';
import { encryptData, decryptData } from '../src/crypto/cipher.js';
import { setNetworkMode, getNetworkMode } from '../src/config/chains.js';
import { createMcpServer } from '../src/mcp/server.js';
import { getChainAdapter } from '../src/adapters/index.js';

async function runTests() {
  console.log('🧪 Starting MC-TWAF Test Suite...\n');

  // Test 1: Mnemonic generation and validation
  console.log('▶ Test 1: BIP-39 Mnemonic Generation & Validation');
  const mnemonic12 = generateMnemonic(128);
  const mnemonic24 = generateMnemonic(256);
  assert.strictEqual(mnemonic12.split(' ').length, 12, '12-word mnemonic should have 12 words');
  assert.strictEqual(mnemonic24.split(' ').length, 24, '24-word mnemonic should have 24 words');
  assert.strictEqual(validateMnemonic(mnemonic12), true, 'Generated 12-word mnemonic must be valid');
  assert.strictEqual(validateMnemonic(mnemonic24), true, 'Generated 24-word mnemonic must be valid');
  assert.strictEqual(validateMnemonic('invalid mnemonic test sequence random words'), false, 'Invalid mnemonic must fail');
  console.log('  ✅ BIP-39 mnemonic generation passed.');

  // Test 2: Multi-chain deterministic derivation (Testnet & Mainnet)
  console.log('\n▶ Test 2: Multi-Chain Key & Address Derivation (Testnet & Mainnet)');
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  
  // Testnet Derivations
  const testnetKeys = deriveAllKeys(testMnemonic, undefined, 'testnet');
  assert.ok(testnetKeys.btc.address.startsWith('tb1q'), `BTC Testnet address (${testnetKeys.btc.address}) should start with tb1q`);
  assert.strictEqual(testnetKeys.btc.derivationPath, "m/84'/1'/0'/0/0");
  assert.ok(testnetKeys.eth.address.startsWith('0x') && testnetKeys.eth.address.length === 42);
  assert.strictEqual(testnetKeys.eth.derivationPath, "m/44'/60'/0'/0/0");
  assert.ok(testnetKeys.sol.address.length >= 32);
  assert.strictEqual(testnetKeys.sol.derivationPath, "m/44'/501'/0'/0'");
  assert.ok(testnetKeys.trx.address.startsWith('T') && testnetKeys.trx.address.length === 34);

  // Mainnet Derivations
  const mainnetKeys = deriveAllKeys(testMnemonic, undefined, 'mainnet');
  assert.ok(mainnetKeys.btc.address.startsWith('bc1q'), `BTC Mainnet address (${mainnetKeys.btc.address}) should start with bc1q`);
  assert.strictEqual(mainnetKeys.btc.derivationPath, "m/84'/0'/0'/0/0");
  assert.strictEqual(mainnetKeys.eth.address, testnetKeys.eth.address);
  assert.strictEqual(mainnetKeys.sol.address, testnetKeys.sol.address);
  assert.strictEqual(mainnetKeys.trx.address, testnetKeys.trx.address);

  console.log('  ✅ BTC, ETH, SOL, and TRX derivation verified for both environments.');
  console.log(`     • BTC (Testnet3): ${testnetKeys.btc.address}`);
  console.log(`     • BTC (Mainnet):  ${mainnetKeys.btc.address}`);
  console.log(`     • ETH (Sepolia/Mainnet): ${testnetKeys.eth.address}`);
  console.log(`     • SOL (Devnet/Mainnet):  ${testnetKeys.sol.address}`);
  console.log(`     • TRX (Nile/Mainnet):    ${testnetKeys.trx.address}`);

  // Test 3: Network Mode Switching
  console.log('\n▶ Test 3: Network Mode Switching');
  setNetworkMode('mainnet');
  assert.strictEqual(getNetworkMode(), 'mainnet');
  setNetworkMode('testnet');
  assert.strictEqual(getNetworkMode(), 'testnet');
  console.log('  ✅ Network mode toggle verified.');

  // Test 4: AES-256-GCM Encryption & Decryption
  console.log('\n▶ Test 4: AES-256-GCM Vault Encryption & Decryption');
  const password = 'CorrectHorseBatteryStaple123!';
  const encrypted = encryptData(testMnemonic, password);
  assert.ok(encrypted.ciphertext && encrypted.authTag && encrypted.salt && encrypted.iv);
  
  const decrypted = decryptData(encrypted, password);
  assert.strictEqual(decrypted, testMnemonic, 'Decrypted mnemonic must match original plaintext');

  assert.throws(() => {
    decryptData(encrypted, 'WrongPassword123!');
  }, /Decryption failed/i, 'Wrong password must trigger decryption error');

  console.log('  ✅ AES-256-GCM encryption, decryption, and authentication tag validation passed.');

  // Test 5: MCP Server creation & Adapter resolution
  console.log('\n▶ Test 5: MCP Server & Adapter Factory');
  const mcpServer = createMcpServer();
  assert.ok(mcpServer, 'MCP server instance should be created');

  const ethAdapter = getChainAdapter('eth', 'testnet');
  const solAdapter = getChainAdapter('sol', 'testnet');
  const btcAdapter = getChainAdapter('btc', 'testnet');
  const trxAdapter = getChainAdapter('trx', 'testnet');
  assert.ok(ethAdapter && solAdapter && btcAdapter && trxAdapter, 'All adapters must resolve successfully');
  console.log('  ✅ MCP Server and all adapters created successfully.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
