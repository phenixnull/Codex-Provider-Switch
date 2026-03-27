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

test('GMN preset carries the supplied default auth key', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const preset = presetsModule.getPresetById('gmn');

  assert.match(preset.authText, /sk-be6fc1ae92f750b317088587bd4e19adc215fba5fa6d81ffe5e4c0a1ff508d23/);
  assert.match(preset.configText, /https:\/\/gmn\.chuangzuoli\.com/);
});

test('official OpenAI preset uses the official openai provider id', () => {
  assert.equal(typeof presetsModule.getPresetById, 'function');

  const preset = presetsModule.getPresetById('openai');

  assert.match(preset.configText, /model_provider = "openai"/);
  assert.match(preset.configText, /model = "gpt-5\.4"/);
  assert.match(preset.authText, /OPENAI_API_KEY/);
});
