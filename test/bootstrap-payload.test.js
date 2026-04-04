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
    },
    quan2go: {
      keyOverview: null
    }
  });
});

test('createInitialProviderUsage returns no usage cards for Claude', () => {
  const usage = createInitialProviderUsage('claude');

  assert.deepEqual(usage, {});
});

test('buildBootstrapPayload returns local bootstrap data without remote quota fetches', async () => {
  let readMergedPresetsCalls = 0;
  let readLiveFilesCalls = 0;
  let getCodexPathsCalls = 0;

  const payload = await buildBootstrapPayload({
    productId: 'codex',
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
  assert.equal(payload.productId, 'codex');
  assert.deepEqual(payload.presets, [{ id: 'gmn', name: 'GMN' }]);
  assert.deepEqual(payload.presetOrder, ['gmn']);
  assert.equal(payload.live.summary.providerId, 'gmn');
  assert.deepEqual(payload.providerUsage, createInitialProviderUsage());
});

test('buildBootstrapPayload includes local BigModel auth summary for Claude without exposing secrets', async () => {
  const payload = await buildBootstrapPayload({
    productId: 'claude',
    readMergedPresets: async () => {
      return {
        presets: [{ id: 'claude-glm-5-1', name: 'GLM-5.1 (Claude Code)' }],
        presetStore: {
          presetOrder: ['claude-glm-5-1']
        }
      };
    },
    readLiveFiles: async () => {
      return {
        summary: {
          providerId: 'claude-glm-5-1'
        },
        configText: '{\n  "env": {}\n}\n',
        authText: '{\n  "hasCompletedOnboarding": true\n}\n'
      };
    },
    getCodexPaths: () => {
      return {
        claudeDir: 'C:/Users/example/.claude'
      };
    },
    readBigModelAuthSummary: async () => {
      return {
        username: 'demo@example.com',
        hasPassword: true,
        maskedApiKey: 'sk-demo...1234',
        organizationId: 'org-1',
        projectId: 'proj-9'
      };
    }
  });

  assert.equal(payload.productId, 'claude');
  assert.deepEqual(payload.providerUsage, {});
  assert.deepEqual(payload.bigmodelAuth, {
    username: 'demo@example.com',
    hasPassword: true,
    maskedApiKey: 'sk-demo...1234',
    organizationId: 'org-1',
    projectId: 'proj-9'
  });
});
