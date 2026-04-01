const test = require('node:test');
const assert = require('node:assert/strict');

const { buildBootstrapPayload, createInitialProviderUsage } = require('../src/main/bootstrap-payload');

test('createInitialProviderUsage returns empty quota placeholders for all providers', () => {
  const usage = createInitialProviderUsage();

  assert.deepEqual(usage, {
    '92scw': {
      keyOverview: null
    },
    gmn: {
      account: '',
      overview: null,
      keyOverview: null
    },
    gwen: {
      keyOverview: null
    },
    openai: {
      keyOverview: null
    }
  });
});

test('buildBootstrapPayload returns local bootstrap data without remote quota fetches', async () => {
  let readMergedPresetsCalls = 0;
  let readLiveFilesCalls = 0;
  let getCodexPathsCalls = 0;

  const payload = await buildBootstrapPayload({
    readMergedPresets: async () => {
      readMergedPresetsCalls += 1;
      return {
        presets: [{ id: 'gmn', name: 'GMN' }],
        presetStore: {
          presetOrder: ['gmn']
        }
      };
    },
    readLiveFiles: async () => {
      readLiveFilesCalls += 1;
      return {
        summary: {
          providerId: 'gmn'
        },
        configText: 'model_provider = "codex"\n',
        authText: '{\n  "OPENAI_API_KEY": "sk-demo"\n}\n'
      };
    },
    getCodexPaths: () => {
      getCodexPathsCalls += 1;
      return {
        codexDir: 'C:/Users/example/.codex'
      };
    }
  });

  assert.equal(readMergedPresetsCalls, 1);
  assert.equal(readLiveFilesCalls, 1);
  assert.equal(getCodexPathsCalls, 1);
  assert.deepEqual(payload.presets, [{ id: 'gmn', name: 'GMN' }]);
  assert.deepEqual(payload.presetOrder, ['gmn']);
  assert.equal(payload.live.summary.providerId, 'gmn');
  assert.deepEqual(payload.providerUsage, createInitialProviderUsage());
});
