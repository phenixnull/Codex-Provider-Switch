const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let authStore = {};

try {
  authStore = require('../src/main/bigmodel-auth-store');
} catch {
  authStore = {};
}

test('getBigModelAuthStorePath stores BigModel credentials under the app userData directory', () => {
  assert.equal(typeof authStore.getBigModelAuthStorePath, 'function');
  assert.equal(
    authStore.getBigModelAuthStorePath('C:\\Users\\Administrator\\AppData\\Roaming\\codex-provider-switch'),
    'C:\\Users\\Administrator\\AppData\\Roaming\\codex-provider-switch\\bigmodel-auth.json'
  );
});

test('readBigModelAuth returns an empty normalized auth object when the local file is missing', async () => {
  assert.equal(typeof authStore.readBigModelAuth, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-bigmodel-auth-'));
  const storePath = path.join(tempDir, 'bigmodel-auth.json');
  const saved = await authStore.readBigModelAuth(storePath);

  assert.deepEqual(saved, {
    username: '',
    password: '',
    apiKey: '',
    organizationId: '',
    projectId: ''
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('readBigModelAuth tolerates a UTF-8 BOM at the start of the local file', async () => {
  assert.equal(typeof authStore.readBigModelAuth, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-bigmodel-auth-'));
  const storePath = path.join(tempDir, 'bigmodel-auth.json');

  fs.writeFileSync(
    storePath,
    '\uFEFF{\n  "username": "demo@example.com",\n  "password": "",\n  "apiKey": "sk-demo",\n  "organizationId": "",\n  "projectId": ""\n}\n',
    'utf8'
  );

  const saved = await authStore.readBigModelAuth(storePath);

  assert.deepEqual(saved, {
    username: 'demo@example.com',
    password: '',
    apiKey: 'sk-demo',
    organizationId: '',
    projectId: ''
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('saveBigModelAuth preserves existing password and apiKey when the incoming patch leaves them blank', async () => {
  assert.equal(typeof authStore.saveBigModelAuth, 'function');
  assert.equal(typeof authStore.readBigModelAuth, 'function');
  assert.equal(typeof authStore.summarizeBigModelAuth, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-bigmodel-auth-'));
  const storePath = path.join(tempDir, 'bigmodel-auth.json');

  await authStore.saveBigModelAuth(
    {
      username: 'demo@example.com',
      password: 'secret-password-123',
      apiKey: 'sk-bigmodel-demo-key-1234567890',
      organizationId: 'org-1',
      projectId: 'proj-1'
    },
    storePath
  );

  await authStore.saveBigModelAuth(
    {
      username: 'demo-updated@example.com',
      password: '',
      apiKey: '',
      organizationId: 'org-2',
      projectId: 'proj-2'
    },
    storePath
  );

  const saved = await authStore.readBigModelAuth(storePath);
  const summary = authStore.summarizeBigModelAuth(saved);

  assert.deepEqual(saved, {
    username: 'demo-updated@example.com',
    password: 'secret-password-123',
    apiKey: 'sk-bigmodel-demo-key-1234567890',
    organizationId: 'org-2',
    projectId: 'proj-2'
  });
  assert.deepEqual(summary, {
    username: 'demo-updated@example.com',
    hasPassword: true,
    maskedApiKey: 'sk-bigm...7890',
    organizationId: 'org-2',
    projectId: 'proj-2'
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});
