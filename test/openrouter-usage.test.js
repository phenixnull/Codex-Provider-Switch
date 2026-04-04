const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let openRouterUsage = {};

try {
  openRouterUsage = require('../src/main/openrouter-usage');
} catch {
  openRouterUsage = {};
}

const preset = {
  id: 'claude-openrouter-qwen3-6-plus-free',
  productId: 'claude',
  configText: `{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
    "ANTHROPIC_AUTH_TOKEN": "sk-or-v1-1234567890abcdef",
    "ANTHROPIC_MODEL": "qwen/qwen3.6-plus:free",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "qwen/qwen3.6-plus:free"
  }
}
`
};

test('extractOpenRouterClaudeConfig reads key, base url, and model from Claude settings', () => {
  assert.equal(typeof openRouterUsage.extractOpenRouterClaudeConfig, 'function');

  const config = openRouterUsage.extractOpenRouterClaudeConfig(preset.configText);

  assert.equal(config.baseUrl, 'https://openrouter.ai/api');
  assert.equal(config.model, 'qwen/qwen3.6-plus:free');
  assert.equal(config.apiKey, 'sk-or-v1-1234567890abcdef');
  assert.equal(config.maskedKey, 'sk-or-v...cdef');
});

test('isOpenRouterFreeClaudePreset detects the saved OpenRouter free preset shape', () => {
  assert.equal(typeof openRouterUsage.isOpenRouterFreeClaudePreset, 'function');
  assert.equal(openRouterUsage.isOpenRouterFreeClaudePreset(preset), true);
  assert.equal(
    openRouterUsage.isOpenRouterFreeClaudePreset({
      configText: '{\n  "env": {\n    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",\n    "ANTHROPIC_MODEL": "anthropic/claude-sonnet-4"\n  }\n}\n'
    }),
    false
  );
});

test('resolveOpenRouterDailyLimit follows the official 50/day vs 1000/day credit threshold', () => {
  assert.equal(typeof openRouterUsage.resolveOpenRouterDailyLimit, 'function');

  assert.equal(openRouterUsage.resolveOpenRouterDailyLimit(0), 50);
  assert.equal(openRouterUsage.resolveOpenRouterDailyLimit(9.99), 50);
  assert.equal(openRouterUsage.resolveOpenRouterDailyLimit(10), 1000);
  assert.equal(openRouterUsage.resolveOpenRouterDailyLimit(15), 1000);
});

test('buildOpenRouterFreeUsageOverview derives the local daily estimate from stats-cache activity', () => {
  assert.equal(typeof openRouterUsage.buildOpenRouterFreeUsageOverview, 'function');

  const overview = openRouterUsage.buildOpenRouterFreeUsageOverview({
    configText: preset.configText,
    statsCacheText: `{
  "lastComputedDate": "2026-04-04",
  "dailyActivity": [
    {
      "date": "2026-04-04",
      "messageCount": 12,
      "sessionCount": 2,
      "toolCallCount": 5
    }
  ],
  "dailyModelTokens": [
    {
      "date": "2026-04-04",
      "tokensByModel": {
        "qwen/qwen3.6-plus:free": 2048
      }
    }
  ]
}
`,
    keyPayload: {
      data: {
        label: 'sk-or-v1-123...cdef',
        usage: 0,
        usage_daily: 0,
        usage_weekly: 0,
        usage_monthly: 0,
        limit_remaining: null,
        is_free_tier: false
      }
    },
    creditsPayload: {
      data: {
        total_credits: 15,
        total_usage: 14.1681566
      }
    },
    now: new Date('2026-04-04T13:00:00+08:00')
  });

  assert.equal(overview.usageKind, 'openrouter_free_daily_estimate');
  assert.equal(overview.model, 'qwen/qwen3.6-plus:free');
  assert.equal(overview.dailyLimit, 1000);
  assert.equal(overview.estimatedUsedCount, 12);
  assert.equal(overview.estimatedRemainingCount, 988);
  assert.equal(overview.progressPercent, 98.8);
  assert.equal(overview.totalCredits, 15);
  assert.equal(overview.totalUsage, 14.1681566);
  assert.equal(overview.todayModelTokens, 2048);
  assert.deepEqual(overview.localActivity, {
    date: '2026-04-04',
    messageCount: 12,
    sessionCount: 2,
    toolCallCount: 5
  });
});

test('fetchOpenRouterFreeUsageOverviewFromPreset reads stats-cache and fetches key plus credits', async () => {
  assert.equal(typeof openRouterUsage.fetchOpenRouterFreeUsageOverviewFromPreset, 'function');

  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-switch-openrouter-'));
  const claudeDir = path.join(tempHome, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, 'stats-cache.json'),
    `{
  "lastComputedDate": "2026-04-04",
  "dailyActivity": [
    {
      "date": "2026-04-04",
      "messageCount": 4,
      "sessionCount": 1,
      "toolCallCount": 1
    }
  ]
}
`,
    'utf8'
  );

  const calls = [];
  const overview = await openRouterUsage.fetchOpenRouterFreeUsageOverviewFromPreset(preset, {
    homeDir: tempHome,
    fetchImpl: async (url) => {
      calls.push(String(url));

      if (String(url) === 'https://openrouter.ai/api/v1/key') {
        return new Response(
          JSON.stringify({
            data: {
              label: 'sk-or-v1-123...cdef',
              usage: 0,
              usage_daily: 0,
              usage_weekly: 0,
              usage_monthly: 0,
              limit_remaining: null,
              is_free_tier: false
            }
          }),
          { status: 200 }
        );
      }

      if (String(url) === 'https://openrouter.ai/api/v1/credits') {
        return new Response(
          JSON.stringify({
            data: {
              total_credits: 15,
              total_usage: 14.1
            }
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    now: new Date('2026-04-04T13:00:00+08:00')
  });

  assert.deepEqual(calls, [
    'https://openrouter.ai/api/v1/key',
    'https://openrouter.ai/api/v1/credits'
  ]);
  assert.equal(overview.dailyLimit, 1000);
  assert.equal(overview.estimatedUsedCount, 4);
  assert.equal(overview.estimatedRemainingCount, 996);

  fs.rmSync(tempHome, { recursive: true, force: true });
});
