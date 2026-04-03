const test = require('node:test');
const assert = require('node:assert/strict');

const DEMO_ACTIVATION_CODE = 'C54C7BA9-0BC8-43C2-A125-2351C95FF0A3';

let quan2goUsage = {};

try {
  quan2goUsage = require('../src/main/quan2go-usage');
} catch {
  quan2goUsage = {};
}

test('buildQuan2GoUsageOverview converts the card login payload into daily quota usage', () => {
  assert.equal(typeof quan2goUsage.buildQuan2GoUsageOverview, 'function');

  const overview = quan2goUsage.buildQuan2GoUsageOverview(
    {
      id: 70950,
      account: DEMO_ACTIVATION_CODE,
      status: 1,
      day_score_used: 3.5619175000000007,
      day_score_date: '2026-04-03',
      vip: {
        day_score: 90,
        expire_at: 4102444800000
      },
      token: 'user:70950/example-token'
    },
    DEMO_ACTIVATION_CODE
  );

  assert.equal(overview.maskedKey, 'C54C7BA...F0A3');
  assert.equal(overview.usageKind, 'daily_usage_quota');
  assert.equal(overview.status, 'active');
  assert.equal(overview.userId, 70950);
  assert.equal(overview.totalQuota, 90);
  assert.equal(overview.usedQuota, 3.56);
  assert.equal(overview.remainingQuota, 86.44);
  assert.equal(overview.usedPercent, 3.96);
  assert.equal(overview.dayScoreDate, '2026-04-03');
  assert.equal(overview.token, 'user:70950/example-token');
});

test('fetchQuan2GoUsageOverview logs in with the activation code and refreshes whoami data', async () => {
  assert.equal(typeof quan2goUsage.fetchQuan2GoUsageOverview, 'function');

  const calls = [];
  const overview = await quan2goUsage.fetchQuan2GoUsageOverview(DEMO_ACTIVATION_CODE, {
    fetchImpl: async (url, options = {}) => {
      calls.push({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || ''
      });

      if (url === 'https://deepl.micosoft.icu/api/users/card-login') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: {
                id: 70950,
                account: DEMO_ACTIVATION_CODE,
                status: 1,
                day_score_used: 3.5619175000000007,
                day_score_date: '2026-04-03',
                vip: {
                  day_score: 90,
                  expire_at: 4102444800000
                },
                token: 'user:70950/example-token'
              }
            };
          }
        };
      }

      if (url === 'https://deepl.micosoft.icu/api/users/whoami') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: {
                id: 70950,
                account: DEMO_ACTIVATION_CODE,
                status: 1,
                day_score_used: 4.125,
                day_score_date: '2026-04-03',
                vip: {
                  day_score: 90,
                  expire_at: 4102444800000
                },
                token: 'user:70950/example-token'
              }
            };
          }
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    }
  });

  assert.deepEqual(
    calls.map((item) => item.url),
    [
      'https://deepl.micosoft.icu/api/users/card-login',
      'https://deepl.micosoft.icu/api/users/whoami'
    ]
  );
  assert.equal(calls[0].method, 'POST');
  assert.match(calls[0].body, /"card":"C54C7BA9-0BC8-43C2-A125-2351C95FF0A3"/);
  assert.equal(calls[1].headers['x-auth-token'], 'user:70950/example-token');
  assert.equal(overview.usedQuota, 4.13);
  assert.equal(overview.totalQuota, 90);
  assert.equal(overview.usedPercent, 4.59);
});
