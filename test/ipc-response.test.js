const test = require('node:test');
const assert = require('node:assert/strict');

let ipcResponse = {};

try {
  ipcResponse = require('../src/main/ipc-response');
} catch {
  ipcResponse = {};
}

test('runIpcTask wraps successful results as ok=true payloads', async () => {
  assert.equal(typeof ipcResponse.runIpcTask, 'function');

  const result = await ipcResponse.runIpcTask(async () => ({ value: 42 }));

  assert.deepEqual(result, {
    ok: true,
    data: {
      value: 42
    }
  });
});

test('runIpcTask captures thrown errors as ok=false payloads without rejecting', async () => {
  assert.equal(typeof ipcResponse.runIpcTask, 'function');

  const result = await ipcResponse.runIpcTask(async () => {
    const error = new Error('provider test failed');
    error.status = 403;
    error.endpoint = 'https://example.com/v1/responses';
    throw error;
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'provider test failed');
  assert.equal(result.error.status, 403);
  assert.equal(result.error.endpoint, 'https://example.com/v1/responses');
});
