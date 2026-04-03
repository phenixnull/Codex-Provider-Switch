const test = require('node:test');
const assert = require('node:assert/strict');

let presetsModule = {};

try {
  presetsModule = require('../src/shared/presets');
} catch {
  presetsModule = {};
}

test('preset registry exposes the five expected provider presets', () => {
  assert.equal(typeof presetsModule.listPresets, 'function');

  const presets = presetsModule.listPresets();
  const ids = presets.map((preset) => preset.id).sort();

  assert.deepEqual(ids, ['92scw', 'gmn', 'gwen', 'openai', 'quan2go']);
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

test('Quan2Go preset uses the relay endpoint and activation-code auth field', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const preset = presetsModule.getPresetById('quan2go');

  assert.match(preset.configText, /model_provider = "quan2go"/);
  assert.match(preset.configText, /https:\/\/capi\.quan2go\.com\/openai/);
  assert.match(preset.authText, /OPENAI_API_KEY/);
});

test('built-in preset descriptions stay human-readable', () => {
  assert.equal(typeof presetsModule.listPresets, 'function');

  const descriptions = Object.fromEntries(
    presetsModule.listPresets().map((preset) => [preset.id, preset.description])
  );

  assert.equal(
    descriptions['92scw'],
    '92scw relay preset with codex provider and sk key auth.'
  );
  assert.equal(
    descriptions.gmn,
    'GMN relay preset with codex provider and GMN-issued sk keys.'
  );
  assert.equal(
    descriptions.gwen,
    'Gwen relay preset with the gwen provider and cr_ activation keys.'
  );
  assert.equal(
    descriptions.openai,
    'Official OpenAI direct preset using the built-in openai provider.'
  );
  assert.equal(
    descriptions.quan2go,
    'Quan2Go relay preset with activation-code auth.'
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
