const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let overridesStore = {};

try {
  overridesStore = require('../src/main/preset-overrides');
} catch {
  overridesStore = {};
}

test('mergePresetsWithOverrides replaces preset texts only for saved overrides', () => {
  assert.equal(typeof overridesStore.mergePresetsWithOverrides, 'function');

  const presets = [
    { id: '92scw', name: '92scw', configText: 'a', authText: 'b' },
    { id: 'openai', name: 'OpenAI', configText: 'c', authText: 'd' }
  ];

  const merged = overridesStore.mergePresetsWithOverrides(presets, {
    openai: { configText: 'override-config', authText: 'override-auth' }
  });

  assert.equal(merged[0].configText, 'a');
  assert.equal(merged[1].configText, 'override-config');
  assert.equal(merged[1].authText, 'override-auth');
});

test('mergePresetsWithOverrides applies saved name and description overrides to built-in presets', () => {
  assert.equal(typeof overridesStore.mergePresetsWithOverrides, 'function');

  const merged = overridesStore.mergePresetsWithOverrides(
    [
      {
        id: 'gmn',
        name: 'GMN',
        description: 'original description',
        configText: 'a',
        authText: 'b'
      }
    ],
    {
      overrides: {
        gmn: {
          name: 'GMN Custom',
          description: 'edited description',
          configText: 'override-config',
          authText: 'override-auth'
        }
      },
      customPresets: []
    }
  );

  assert.equal(merged[0].name, 'GMN Custom');
  assert.equal(merged[0].description, 'edited description');
  assert.equal(merged[0].configText, 'override-config');
});

test('savePresetOverride persists the preset override payload on disk', async () => {
  assert.equal(typeof overridesStore.savePresetOverride, 'function');
  assert.equal(typeof overridesStore.readPresetOverrides, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-overrides-'));
  const storePath = path.join(tempDir, 'preset-overrides.json');

  await overridesStore.savePresetOverride(
    {
      id: 'gmn',
      configText: 'config-text',
      authText: 'auth-text'
    },
    storePath
  );

  const saved = await overridesStore.readPresetOverrides(storePath);

  assert.deepEqual(saved.gmn, {
    configText: 'config-text',
    authText: 'auth-text'
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('saveCustomPreset persists a custom preset and merge appends it to the preset list', async () => {
  assert.equal(typeof overridesStore.saveCustomPreset, 'function');
  assert.equal(typeof overridesStore.readPresetStore, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-overrides-'));
  const storePath = path.join(tempDir, 'preset-overrides.json');

  await overridesStore.saveCustomPreset(
    {
      id: 'custom-demo',
      name: 'Custom Demo',
      description: 'user added preset',
      configText: 'model_provider = "codex"\nmodel = "gpt-5.4"\n',
      authText: '{\n  "OPENAI_API_KEY": "sk-demo"\n}\n'
    },
    storePath
  );

  const store = await overridesStore.readPresetStore(storePath);
  const merged = overridesStore.mergePresetsWithOverrides(
    [{ id: '92scw', name: '92scw', configText: 'a', authText: 'b', isBuiltIn: true }],
    store
  );

  assert.equal(store.customPresets.length, 1);
  assert.equal(store.customPresets[0].name, 'Custom Demo');
  assert.equal(merged.length, 2);
  assert.equal(merged[1].id, 'custom-demo');
  assert.equal(merged[1].isBuiltIn, false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('createCustomPresetId slugifies names and avoids collisions with existing ids', () => {
  assert.equal(typeof overridesStore.createCustomPresetId, 'function');

  const id = overridesStore.createCustomPresetId('My New Provider', [
    { id: '92scw' },
    { id: 'my-new-provider' }
  ]);

  assert.equal(id, 'my-new-provider-2');
});
