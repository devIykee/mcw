import { spawn } from 'child_process';
import path from 'path';

async function testMcpProcess() {
  console.log('🤖 Testing MCP Server daemon over Stdio JSON-RPC transport...');

  const serverProcess = spawn('node', [path.join(process.cwd(), 'dist/index.js'), 'mcp'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  let responseBuffer = '';

  serverProcess.stdout.on('data', (chunk) => {
    responseBuffer += chunk.toString();
  });

  const sendJsonRpc = (msg: any) => {
    const payload = JSON.stringify(msg) + '\n';
    serverProcess.stdin.write(payload);
  };

  // Wait a moment for server to start
  await new Promise((r) => setTimeout(r, 500));

  // 1. Send initialize
  sendJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'agent-tester', version: '1.0.0' },
    },
  });

  await new Promise((r) => setTimeout(r, 500));

  // 2. Send tools/list
  sendJsonRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });

  await new Promise((r) => setTimeout(r, 500));

  // 3. Send tools/call for get_addresses
  sendJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_addresses',
      arguments: {},
    },
  });

  await new Promise((r) => setTimeout(r, 1000));

  serverProcess.kill();

  console.log('--- Received JSON-RPC Messages from MCP Server ---');
  console.log(responseBuffer);
  console.log('--------------------------------------------------');

  if (responseBuffer.includes('get_addresses') && responseBuffer.includes('bitcoin_testnet')) {
    console.log('✅ MCP Server responded correctly with standard JSON-RPC tools and wallet data!');
  } else {
    throw new Error('MCP server failed to respond with expected JSON-RPC data.');
  }
}

testMcpProcess().catch((err) => {
  console.error('❌ MCP Process test failed:', err);
  process.exit(1);
});
