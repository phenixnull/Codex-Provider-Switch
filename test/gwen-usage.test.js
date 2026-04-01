const test = require('node:test');
const assert = require('node:assert/strict');

const DEMO_GWEN_KEY = 'cr-demo-gwen-provider-key-0001';

let gwenUsage = {};

try {
  gwenUsage = require('../src/main/gwen-usage');
} catch {
  gwenUsage = {};
}

test('buildGwenKeyOverview converts used quota into remaining quota for the current key', () => {
  assert.equal(typeof gwenUsage.buildGwenKeyOverview, 'function');

  const overview = gwenUsage.buildGwenKeyOverview(
    {
      isValid: true,
      mode: 'quota_limited',
      status: 'active',
      quota: {
        limit: 4600,
        remaining: 1571.8808068500002,
        used: 3028.11919315,
        unit: 'USD'
      },
      remaining: 1571.8808068500002,
      expires_at: '2026-04-18T15:22:00+08:00',
      days_until_expiry: 20
    },
    DEMO_GWEN_KEY
  );

  assert.equal(overview.maskedKey, 'cr-demo...0001');
  assert.equal(overview.status, 'active');
  assert.equal(overview.totalQuota, 4600);
  assert.equal(overview.usedQuota, 3028.12);
  assert.equal(overview.remainingQuota, 1571.88);
  assert.equal(overview.progressPercent, 34.17);
  assert.equal(overview.mode, 'quota_limited');
  assert.equal(overview.unit, 'USD');
  assert.equal(overview.expiresAt, '2026-04-18T15:22:00+08:00');
});

test('fetchGwenKeyOverview queries the usage endpoint with the bearer key', async () => {
  assert.equal(typeof gwenUsage.fetchGwenKeyOverview, 'function');

  const calls = [];
  const overview = await gwenUsage.fetchGwenKeyOverview(
    DEMO_GWEN_KEY,
    {
      fetchImpl: async (url, options = {}) => {
        calls.push({
          url,
          auth: options.headers?.Authorization || ''
        });

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              isValid: true,
              mode: 'quota_limited',
              status: 'active',
              quota: {
                limit: 4600,
                used: 3028.11919315
              },
              remaining: 1571.8808068500002,
              expires_at: '2026-04-18T15:22:00+08:00'
            };
          }
        };
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://ai.love-gwen.top/v1/usage');
  assert.equal(
    calls[0].auth,
    `Bearer ${DEMO_GWEN_KEY}`
  );
  assert.equal(overview.remainingQuota, 1571.88);
  assert.equal(overview.totalQuota, 4600);
  assert.equal(overview.progressPercent, 34.17);
});
