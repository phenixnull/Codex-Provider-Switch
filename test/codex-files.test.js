const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let fileStore = {};

try {
  fileStore = require('../src/main/codex-files');
} catch {
  fileStore = {};
}

test('getCodexPaths builds the expected Windows-style codex file paths', () => {
  assert.equal(typeof fileStore.getCodexPaths, 'function');

  const paths = fileStore.getCodexPaths('C:\\Users\\Administrator');

  assert.equal(paths.codexDir, 'C:\\Users\\Administrator\\.codex');
  assert.equal(paths.configPath, 'C:\\Users\\Administrator\\.codex\\config.toml');
  assert.equal(paths.authPath, 'C:\\Users\\Administrator\\.codex\\auth.json');
});

test('saveCodexFiles creates the codex directory and writes both files', async () => {
  assert.equal(typeof fileStore.saveCodexFiles, 'function');
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-switch-'));

  await fileStore.saveCodexFiles(
    {
      configText: 'model_provider = "openai"\nmodel = "gpt-5.4"\n',
      authText: '{\n  "OPENAI_API_KEY": "sk-example"\n}\n'
    },
    tempHome
  );

  const configPath = path.join(tempHome, '.codex', 'config.toml');
  const authPath = path.join(tempHome, '.codex', 'auth.json');

  assert.equal(fs.existsSync(configPath), true);
  assert.equal(fs.existsSync(authPath), true);
  assert.equal(
    fs.readFileSync(configPath, 'utf8'),
    'model_provider = "openai"\nmodel = "gpt-5.4"\n'
  );
  assert.equal(
    fs.readFileSync(authPath, 'utf8'),
    '{\n  "OPENAI_API_KEY": "sk-example"\n}\n'
  );

  fs.rmSync(tempHome, { recursive: true, force: true });
});

test('saveCodexFiles rejects invalid TOML or invalid auth JSON', async () => {
  assert.equal(typeof fileStore.saveCodexFiles, 'function');
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-switch-'));

  await assert.rejects(
    fileStore.saveCodexFiles(
      {
        configText: 'model_provider = ',
        authText: '{\n  "OPENAI_API_KEY": "sk-example"\n}\n'
      },
      tempHome
    )
  );

  await assert.rejects(
    fileStore.saveCodexFiles(
      {
        configText: 'model_provider = "openai"\nmodel = "gpt-5.4"\n',
        authText: '{ not valid json }'
      },
      tempHome
    )
  );

  fs.rmSync(tempHome, { recursive: true, force: true });
});
