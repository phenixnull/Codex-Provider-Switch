const test = require('node:test');
const assert = require('node:assert/strict');

const DEMO_92SCW_KEY = 'sk-demo-92scw-provider-key-0001';

let newApiTokenUsage = {};

try {
  newApiTokenUsage = require('../src/main/newapi-token-usage');
} catch {
  newApiTokenUsage = {};
}

test('buildNewApiTokenOverview converts raw quota units into remaining and total USD values', () => {
  assert.equal(typeof newApiTokenUsage.buildNewApiTokenOverview, 'function');

  const overview = newApiTokenUsage.buildNewApiTokenOverview(
    {
      code: true,
      data: {
        expires_at: 0,
        name: 'codex',
        object: 'token_usage',
        total_available: 453816464,
        total_granted: 500000698,
        total_used: 46184234,
        unlimited_quota: false
      },
      message: 'ok'
    },
    {
      apiKey: DEMO_92SCW_KEY,
      quotaPerUnit: 500000,
      quotaDisplayType: 'USD'
    }
  );

  assert.equal(overview.maskedKey, 'sk-demo...0001');
  assert.equal(overview.name, 'codex');
  assert.equal(overview.status, 'active');
  assert.equal(overview.totalQuota, 1000);
  assert.equal(overview.usedQuota, 92.37);
  assert.equal(overview.remainingQuota, 907.63);
  assert.equal(overview.progressPercent, 90.76);
  assert.equal(overview.displayType, 'USD');
  assert.equal(overview.quotaPerUnit, 500000);
  assert.equal(overview.unlimitedQuota, false);
});

test('fetchNewApiTokenOverview reads status and usage endpoints with the bearer key', async () => {
  assert.equal(typeof newApiTokenUsage.fetchNewApiTokenOverview, 'function');

  const calls = [];
  const overview = await newApiTokenUsage.fetchNewApiTokenOverview(
    'http://92scw.cn',
    DEMO_92SCW_KEY,
    {
      fetchImpl: async (url, options = {}) => {
        calls.push({
          url,
          auth: options.headers?.Authorization || ''
        });

        if (url === 'http://92scw.cn/api/status') {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                data: {
                  quota_per_unit: 500000,
                  quota_display_type: 'USD'
                }
              };
            }
          };
        }

        if (url === 'http://92scw.cn/api/usage/token') {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                code: true,
                data: {
                  expires_at: 0,
                  name: 'codex',
                  object: 'token_usage',
                  total_available: 453816464,
                  total_granted: 500000698,
                  total_used: 46184234,
                  unlimited_quota: false
                },
                message: 'ok'
              };
            }
          };
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    }
  );

  assert.deepEqual(
    calls.map((item) => item.url),
    ['http://92scw.cn/api/status', 'http://92scw.cn/api/usage/token']
  );
  assert.equal(calls[0].auth, '');
  assert.equal(
    calls[1].auth,
    `Bearer ${DEMO_92SCW_KEY}`
  );
  assert.equal(overview.remainingQuota, 907.63);
  assert.equal(overview.totalQuota, 1000);
  assert.equal(overview.progressPercent, 90.76);
});
