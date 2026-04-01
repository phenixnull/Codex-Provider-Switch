const test = require('node:test');
const assert = require('node:assert/strict');

let presetsModule = {};

try {
  presetsModule = require('../src/shared/presets');
} catch {
  presetsModule = {};
}

test('preset registry exposes the four expected provider presets', () => {
  assert.equal(typeof presetsModule.listPresets, 'function');

  const presets = presetsModule.listPresets();
  const ids = presets.map((preset) => preset.id).sort();

  assert.deepEqual(ids, ['92scw', 'gmn', 'gwen', 'openai']);
});

test('GMN preset carries a sanitized placeholder auth key', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const preset = presetsModule.getPresetById('gmn');

  assert.match(preset.authText, /sk-demo-gmn-provider-key-0001/);
  assert.match(preset.configText, /https:\/\/gmn\.chuangzuoli\.com/);
});

test('official OpenAI preset uses the official openai provider id', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const preset = presetsModule.getPresetById('openai');

  assert.match(preset.configText, /model_provider = "openai"/);
  assert.match(preset.configText, /model = "gpt-5\.4"/);
  assert.match(preset.authText, /OPENAI_API_KEY/);
});

test('built-in preset descriptions stay human-readable', () => {
  assert.equal(typeof presetsModule.listPresets, 'function');

  const descriptions = Object.fromEntries(
    presetsModule.listPresets().map((preset) => [preset.id, preset.description])
  );

  assert.equal(
    descriptions['92scw'],
    '92scw 代理，使用 codex provider 和 sk 开头的默认密钥。'
  );
  assert.equal(
    descriptions.gmn,
    'GMN 代理，使用 codex provider 和后台生成的 sk 密钥。'
  );
  assert.equal(
    descriptions.gwen,
    'Gwen 代理，provider 为 gwen，默认使用 cr_ 开头密钥。'
  );
  assert.equal(
    descriptions.openai,
    '官方 OpenAI 直连配置，使用内置 openai provider。'
  );
});

test('darwin presets omit Windows-specific config fields', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const scwPreset = presetsModule.getPresetById('92scw', 'darwin');
  const gmnPreset = presetsModule.getPresetById('gmn', 'darwin');
  const openAiPreset = presetsModule.getPresetById('openai', 'darwin');

  assert.equal(scwPreset.configText.includes('windows_wsl_setup_acknowledged'), false);
  assert.equal(scwPreset.configText.includes('[windows]'), false);
  assert.equal(gmnPreset.configText.includes('windows_wsl_setup_acknowledged'), false);
  assert.equal(gmnPreset.configText.includes('elevated_windows_sandbox'), false);
  assert.equal(openAiPreset.configText.includes('windows_wsl_setup_acknowledged'), false);
});

test('win32 presets keep Windows-specific config fields', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const scwPreset = presetsModule.getPresetById('92scw', 'win32');
  const gmnPreset = presetsModule.getPresetById('gmn', 'win32');
  const openAiPreset = presetsModule.getPresetById('openai', 'win32');

  assert.equal(scwPreset.configText.includes('windows_wsl_setup_acknowledged = true'), true);
  assert.equal(scwPreset.configText.includes('[windows]'), true);
  assert.equal(gmnPreset.configText.includes('elevated_windows_sandbox = true'), true);
  assert.equal(openAiPreset.configText.includes('windows_wsl_setup_acknowledged = true'), true);
});
