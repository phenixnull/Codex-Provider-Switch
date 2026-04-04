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

test('mergePresetsWithOverrides ignores legacy mojibake descriptions for built-in presets', () => {
  assert.equal(typeof overridesStore.mergePresetsWithOverrides, 'function');

  const merged = overridesStore.mergePresetsWithOverrides(
    [
      {
        id: 'openai',
        name: 'OpenAI Official',
        description: '官方 OpenAI 直连配置，使用内置 openai provider。',
        configText: 'base-config',
        authText: 'base-auth'
      }
    ],
    {
      overrides: {
        openai: {
          description:
            '\u7039\u6a3b\u67df\u0020\u004f\u0070\u0065\u006e\u0041\u0049\u0020\u9429\u78cb\u7e5b\u95b0\u5d87\u7586\u951b\u5c7c\u5a07\u9422\u3125\u5534\u7f03\u003f\u006f\u0070\u0065\u006e\u0061\u0069\u0020\u0070\u0072\u006f\u0076\u0069\u0064\u0065\u0072\u9286\u003f',
          configText: 'override-config',
          authText: 'override-auth'
        }
      },
      customPresets: []
    }
  );

  assert.equal(merged[0].description, '官方 OpenAI 直连配置，使用内置 openai provider。');
  assert.equal(merged[0].configText, 'override-config');
  assert.equal(merged[0].authText, 'override-auth');
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
      productId: 'codex',
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

test('saveCustomPreset keeps Claude custom presets scoped away from Codex preset merges', async () => {
  assert.equal(typeof overridesStore.saveCustomPreset, 'function');
  assert.equal(typeof overridesStore.readPresetStore, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-overrides-'));
  const storePath = path.join(tempDir, 'preset-overrides.json');

  await overridesStore.saveCustomPreset(
    {
      id: 'claude-custom',
      productId: 'claude',
      name: 'Claude Custom',
      description: 'user added Claude preset',
      configText: '{\n  "env": {}\n}\n',
      authText: '{\n  "hasCompletedOnboarding": true\n}\n'
    },
    storePath
  );

  const store = await overridesStore.readPresetStore(storePath);
  const mergedCodex = overridesStore.mergePresetsWithOverrides(
    [{ id: 'gmn', productId: 'codex', name: 'GMN', configText: 'a', authText: 'b', isBuiltIn: true }],
    store
  );
  const mergedClaude = overridesStore.mergePresetsWithOverrides(
    [
      {
        id: 'claude-glm-5-1',
        productId: 'claude',
        name: 'GLM-5.1',
        configText: '{\n  "env": {}\n}\n',
        authText: '{\n  "hasCompletedOnboarding": true\n}\n',
        isBuiltIn: true
      }
    ],
    store
  );

  assert.equal(mergedCodex.some((preset) => preset.id === 'claude-custom'), false);
  assert.equal(mergedClaude.some((preset) => preset.id === 'claude-custom'), true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('mergePresetsWithOverrides suppresses custom presets once the same product/id becomes built-in', () => {
  assert.equal(typeof overridesStore.mergePresetsWithOverrides, 'function');

  const merged = overridesStore.mergePresetsWithOverrides(
    [
      {
        id: 'claude-openrouter-qwen3-6-plus-free',
        productId: 'claude',
        name: 'OpenRouter Built-In',
        configText: '{\n  "env": {}\n}\n',
        authText: '{\n  "hasCompletedOnboarding": true\n}\n',
        isBuiltIn: true
      }
    ],
    {
      overrides: {},
      customPresets: [
        {
          id: 'claude-openrouter-qwen3-6-plus-free',
          productId: 'claude',
          name: 'OpenRouter Custom Legacy',
          configText: '{\n  "env": {}\n}\n',
          authText: '{\n  "hasCompletedOnboarding": true\n}\n'
        },
        {
          id: 'claude-custom',
          productId: 'claude',
          name: 'Claude Custom',
          configText: '{\n  "env": {}\n}\n',
          authText: '{\n  "hasCompletedOnboarding": true\n}\n'
        }
      ]
    }
  );

  assert.deepEqual(
    merged.map((preset) => preset.id),
    ['claude-openrouter-qwen3-6-plus-free', 'claude-custom']
  );
});

test('createCustomPresetId slugifies names and avoids collisions with existing ids', () => {
  assert.equal(typeof overridesStore.createCustomPresetId, 'function');

  const id = overridesStore.createCustomPresetId('My New Provider', [
    { id: '92scw' },
    { id: 'my-new-provider' }
  ]);

  assert.equal(id, 'my-new-provider-2');
});

test('savePresetOverride strips ChatGPT sign-in tokens before writing preset overrides', async () => {
  assert.equal(typeof overridesStore.savePresetOverride, 'function');
  assert.equal(typeof overridesStore.readPresetOverrides, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-overrides-'));
  const storePath = path.join(tempDir, 'preset-overrides.json');

  await overridesStore.savePresetOverride(
    {
      id: 'openai',
      configText: 'model_provider = "openai"\nmodel = "gpt-5.4"\n',
      authText: `{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "access_token": "access-123",
    "refresh_token": "refresh-456"
  }
}
`
    },
    storePath
  );

  const saved = await overridesStore.readPresetOverrides(storePath);

  assert.equal(saved.openai.authText, '{\n  "OPENAI_API_KEY": "sk-your-openai-api-key"\n}\n');

  fs.rmSync(tempDir, { recursive: true, force: true });
});
