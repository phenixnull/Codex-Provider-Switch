const test = require('node:test');
const assert = require('node:assert/strict');

let gmnDisplay = {};

try {
  gmnDisplay = require('../src/renderer/gmn-display');
} catch {
  gmnDisplay = {};
}

test('buildGmnQuotaCardModel renders current key remaining quota and progress', () => {
  assert.equal(typeof gmnDisplay.buildGmnQuotaCardModel, 'function');

  const model = gmnDisplay.buildGmnQuotaCardModel({
    name: 'codex',
    maskedKey: 'sk-demo...0001',
    totalQuota: 331,
    usedQuota: 12.9707977,
    remainingQuota: 318.0292023,
    progressPercent: 96.08
  });

  assert.equal(model.titleText, 'codex');
  assert.equal(model.subtitleText, 'sk-demo...0001');
  assert.equal(model.remainingText, '$318.03');
  assert.equal(model.totalText, '$331.00');
  assert.equal(model.progressPercent, 96.08);
  assert.equal(model.progressText, '96.08% left');
  assert.equal(model.progressDetailText, '$318.03 / $331.00');
  assert.match(model.progressGradient, /linear-gradient/);
});

test('buildGmnQuotaCardModel renders used and remaining from key quota totals', () => {
  assert.equal(typeof gmnDisplay.buildGmnQuotaCardModel, 'function');

  const model = gmnDisplay.buildGmnQuotaCardModel({
    name: 'codex',
    maskedKey: 'sk-example...cdef',
    totalQuota: 120,
    usedQuota: 30,
    remainingQuota: 90,
    progressPercent: 75
  });

  assert.equal(model.remainingText, '$90.00');
  assert.equal(model.totalText, '$120.00');
  assert.equal(model.progressText, '75.00% left');
  assert.equal(model.progressDetailText, '$90.00 / $120.00');
});

test('buildGmnQuotaCardModel handles missing key quota data safely', () => {
  assert.equal(typeof gmnDisplay.buildGmnQuotaCardModel, 'function');

  const model = gmnDisplay.buildGmnQuotaCardModel(null);

  assert.equal(model.titleText, 'Current Key');
  assert.equal(model.subtitleText, 'Unavailable');
  assert.equal(model.remainingText, '-');
  assert.equal(model.totalText, '-');
  assert.equal(model.progressPercent, 0);
  assert.equal(model.progressText, '-');
});

test('buildGmnPresetCardModel maps current key quota into preset-card content', () => {
  assert.equal(typeof gmnDisplay.buildGmnPresetCardModel, 'function');

  const model = gmnDisplay.buildGmnPresetCardModel(
    {
      name: 'codex',
      maskedKey: 'sk-demo...0001',
      status: 'active',
      totalQuota: 331,
      remainingQuota: 312.78,
      progressPercent: 94.5
    },
    'sk-demo...0001'
  );

  assert.equal(model.keyText, 'sk-demo...0001');
  assert.equal(model.remainingText, '$312.78');
  assert.equal(model.totalText, '$331.00');
  assert.equal(model.progressText, '94.50% left');
  assert.equal(model.progressDetailText, '$312.78 / $331.00');
  assert.equal(model.statusText, 'ACTIVE');
  assert.match(model.progressGradient, /linear-gradient/);
});

test('buildGmnPresetCardModel falls back to masked live key when quota is unavailable', () => {
  assert.equal(typeof gmnDisplay.buildGmnPresetCardModel, 'function');

  const model = gmnDisplay.buildGmnPresetCardModel(null, 'sk-demo...0001');

  assert.equal(model.keyText, 'sk-demo...0001');
  assert.equal(model.remainingText, '-');
  assert.equal(model.totalText, '-');
  assert.equal(model.progressText, '-');
  assert.equal(model.statusText, 'SYNCING');
});

test('buildUsagePresetCardModel formats remaining quota for GWEN cards', () => {
  assert.equal(typeof gmnDisplay.buildUsagePresetCardModel, 'function');

  const model = gmnDisplay.buildUsagePresetCardModel(
    {
      maskedKey: 'cr-demo...0001',
      status: 'active',
      totalQuota: 4600,
      remainingQuota: 1571.88,
      progressPercent: 34.17
    },
    'cr-demo...0001'
  );

  assert.equal(model.keyText, 'cr-demo...0001');
  assert.equal(model.remainingText, '$1571.88');
  assert.equal(model.totalText, '$4600.00');
  assert.equal(model.progressText, '34.17% left');
  assert.equal(model.progressDetailText, '$1571.88 / $4600.00');
  assert.equal(model.statusText, 'ACTIVE');
});

test('buildUsagePresetCardModel formats the official 5-hour ChatGPT window for OpenAI cards', () => {
  assert.equal(typeof gmnDisplay.buildUsagePresetCardModel, 'function');

  const model = gmnDisplay.buildUsagePresetCardModel(
    {
      usageKind: 'chatgpt_rate_limit',
      status: 'active',
      planType: 'plus',
      totalQuota: 100,
      usedQuota: 3,
      remainingQuota: 97,
      progressPercent: 97,
      limitWindowSeconds: 18000,
      resetAfterSeconds: 17735,
      secondaryWindow: {
        usedPercent: 1,
        remainingPercent: 99,
        limitWindowSeconds: 604800,
        resetAfterSeconds: 604535
      },
      codeReviewRateLimit: {
        primaryWindow: {
          usedPercent: 0,
          remainingPercent: 100,
          limitWindowSeconds: 604800,
          resetAfterSeconds: 604800
        }
      }
    },
    '',
    {
      providerId: 'openai'
    }
  );

  assert.equal(model.keyText, 'ChatGPT Plus');
  assert.equal(model.progressLabelText, '5h Window Left');
  assert.equal(model.progressText, '97.00% left');
  assert.equal(model.progressDetailText, '3.00% used · resets in 4h 55m');
  assert.equal(model.statusText, 'ACTIVE');
  assert.match(model.progressGradient, /linear-gradient/);
  assert.equal(Array.isArray(model.progressItems), true);
  assert.equal(model.progressItems.length, 3);
  assert.equal(model.progressItems[0].labelText, '5h Window Left');
  assert.equal(model.progressItems[1].labelText, '7d Window Left');
  assert.equal(model.progressItems[1].text, '99.00% left');
  assert.equal(model.progressItems[2].labelText, 'Review 7d Left');
  assert.equal(model.progressItems[2].text, '100.00% left');
});

test('buildUsagePresetCardModel formats daily used and total quota for Quan2Go cards', () => {
  assert.equal(typeof gmnDisplay.buildUsagePresetCardModel, 'function');

  const model = gmnDisplay.buildUsagePresetCardModel(
    {
      usageKind: 'daily_usage_quota',
      maskedKey: 'C54C7BA...F0A3',
      status: 'active',
      totalQuota: 90,
      usedQuota: 3.56,
      remainingQuota: 86.44,
      usedPercent: 3.96,
      dayScoreDate: '2026-04-03'
    },
    'C54C7BA...F0A3',
    {
      providerId: 'quan2go'
    }
  );

  assert.equal(model.keyText, 'C54C7BA...F0A3');
  assert.equal(model.progressLabelText, 'Today Used');
  assert.equal(model.progressText, '$3.56 / $90.00');
  assert.equal(model.progressDetailText, '3.96% used · 2026-04-03');
  assert.equal(model.statusText, 'ACTIVE');
  assert.equal(Array.isArray(model.progressItems), true);
  assert.equal(model.progressItems.length, 1);
  assert.equal(model.progressItems[0].percent, 3.96);
});

test('buildUsagePresetCardModel formats local OpenRouter free daily estimates', () => {
  assert.equal(typeof gmnDisplay.buildUsagePresetCardModel, 'function');

  const model = gmnDisplay.buildUsagePresetCardModel(
    {
      usageKind: 'openrouter_free_daily_estimate',
      maskedKey: 'sk-or-v...84b5',
      dailyLimit: 1000,
      estimatedUsedCount: 12,
      estimatedRemainingCount: 988,
      progressPercent: 98.8,
      totalCredits: 15,
      totalUsage: 14.1681566,
      todayModelTokens: 2048
    },
    'sk-or-v...84b5',
    {
      providerId: 'openrouter'
    }
  );

  assert.equal(model.keyText, 'sk-or-v...84b5');
  assert.equal(model.progressLabelText, 'Daily Free Left');
  assert.equal(model.progressText, '988 次剩余');
  assert.equal(
    model.progressDetailText,
    '本地今日 12 / 1,000 次 · credits 15 · usage 14.17 · tokens 2,048'
  );
  assert.equal(model.statusText, 'ESTIMATE');
  assert.equal(Array.isArray(model.progressItems), true);
  assert.equal(model.progressItems.length, 1);
  assert.equal(model.progressItems[0].percent, 98.8);
});
