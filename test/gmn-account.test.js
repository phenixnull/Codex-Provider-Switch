const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let gmnAccount = {};

try {
  gmnAccount = require('../src/main/gmn-account');
} catch {
  gmnAccount = {};
}

const DEMO_GMN_KEY = 'sk-demo-gmn-provider-key-0001';
const DEMO_ALT_GMN_KEY = 'sk-demo-other-provider-key-9999';
const DEMO_GMN_ACCOUNT = 'demo-gmn@example.com';
const DEMO_GMN_PASSWORD = 'demo-password-123';

function createSubscription(overrides = {}) {
  return {
    id: `sub-${Math.random()}`,
    status: 'active',
    group: {
      name: 'Default',
      daily_limit_usd: 0,
      weekly_limit_usd: 0,
      monthly_limit_usd: 0
    },
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    ...overrides
  };
}

test('buildGmnOverview aggregates balance and remaining quota from active subscriptions', () => {
  assert.equal(typeof gmnAccount.buildGmnOverview, 'function');

  const overview = gmnAccount.buildGmnOverview({
    profile: {
      email: 'phenixnull@example.com',
      username: 'phenixnull',
      balance: 42.5,
      concurrency: 6,
      status: 'active'
    },
    subscriptions: [
      createSubscription({
        id: 'sub-pro',
        group: {
          name: 'Pro',
          daily_limit_usd: 20,
          weekly_limit_usd: 50,
          monthly_limit_usd: 120
        },
        daily_usage_usd: 5.25,
        weekly_usage_usd: 12.5,
        monthly_usage_usd: 35.1
      }),
      createSubscription({
        id: 'sub-burst',
        group: {
          name: 'Burst',
          daily_limit_usd: 10,
          weekly_limit_usd: 0,
          monthly_limit_usd: 40
        },
        daily_usage_usd: 1.5,
        weekly_usage_usd: 0,
        monthly_usage_usd: 10
      })
    ]
  });

  assert.equal(overview.accountLabel, 'phenixnull@example.com');
  assert.equal(overview.balance, 42.5);
  assert.equal(overview.concurrency, 6);
  assert.equal(overview.activeSubscriptionCount, 2);
  assert.equal(overview.quotas.daily.limit, 30);
  assert.equal(overview.quotas.daily.used, 6.75);
  assert.equal(overview.quotas.daily.remaining, 23.25);
  assert.equal(overview.quotas.weekly.limit, 50);
  assert.equal(overview.quotas.weekly.used, 12.5);
  assert.equal(overview.quotas.weekly.remaining, 37.5);
  assert.equal(overview.quotas.monthly.limit, 160);
  assert.equal(overview.quotas.monthly.used, 45.1);
  assert.equal(overview.quotas.monthly.remaining, 114.9);
});

test('buildGmnKeyOverview derives remaining quota from the matching key record', () => {
  assert.equal(typeof gmnAccount.buildGmnKeyOverview, 'function');

  const overview = gmnAccount.buildGmnKeyOverview({
    key: DEMO_GMN_KEY,
    name: 'codex',
    status: 'active',
    quota: 331,
    quota_used: 12.9707977,
    last_used_at: '2026-03-28T21:13:46.064567+08:00',
    updated_at: '2026-03-28T21:14:13.309077+08:00'
  });

  assert.equal(overview.name, 'codex');
  assert.equal(overview.maskedKey, 'sk-demo...0001');
  assert.equal(overview.totalQuota, 331);
  assert.equal(overview.usedQuota, 12.97);
  assert.equal(overview.remainingQuota, 318.03);
  assert.equal(overview.progressPercent, 96.08);
  assert.equal(overview.status, 'active');
});

test('loginGmnAccount persists tokens without storing the password', async () => {
  assert.equal(typeof gmnAccount.loginGmnAccount, 'function');
  assert.equal(typeof gmnAccount.readGmnSession, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gmn-session-'));
  const storePath = path.join(tempDir, 'gmn-session.json');
  const requests = [];

  const overview = await gmnAccount.loginGmnAccount(
    {
      account: 'phenixnull',
      password: 'secret-password'
    },
    storePath,
    {
      fetchImpl: async (url, options = {}) => {
        requests.push({
          url,
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body ? JSON.parse(options.body) : null
        });

        if (url.endsWith('/auth/login')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                code: 0,
                data: {
                  access_token: 'access-1',
                  refresh_token: 'refresh-1',
                  expires_in: 3600,
                  user: {
                    email: 'phenixnull@example.com',
                    username: 'phenixnull'
                  }
                }
              };
            }
          };
        }

        if (url.endsWith('/user/profile')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                code: 0,
                data: {
                  email: 'phenixnull@example.com',
                  username: 'phenixnull',
                  balance: 88.8,
                  concurrency: 3,
                  status: 'active'
                }
              };
            }
          };
        }

        if (url.endsWith('/subscriptions/active')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                code: 0,
                data: [
                  createSubscription({
                    id: 'sub-one',
                    group: {
                      name: 'Starter',
                      daily_limit_usd: 8,
                      weekly_limit_usd: 20,
                      monthly_limit_usd: 60
                    },
                    daily_usage_usd: 2,
                    weekly_usage_usd: 7,
                    monthly_usage_usd: 16
                  })
                ]
              };
            }
          };
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    }
  );

  assert.equal(requests[0].url.endsWith('/auth/login'), true);
  assert.deepEqual(requests[0].body, {
    email: 'phenixnull',
    password: 'secret-password'
  });
  assert.equal(overview.balance, 88.8);
  assert.equal(overview.quotas.daily.remaining, 6);

  const saved = await gmnAccount.readGmnSession(storePath);
  const savedText = fs.readFileSync(storePath, 'utf8');

  assert.equal(saved.account, 'phenixnull');
  assert.equal(saved.accessToken, 'access-1');
  assert.equal(saved.refreshToken, 'refresh-1');
  assert.equal(savedText.includes('secret-password'), false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('fetchGmnOverview refreshes the access token after a 401 and retries once', async () => {
  assert.equal(typeof gmnAccount.fetchGmnOverview, 'function');
  assert.equal(typeof gmnAccount.writeGmnSession, 'function');
  assert.equal(typeof gmnAccount.readGmnSession, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gmn-session-'));
  const storePath = path.join(tempDir, 'gmn-session.json');
  const calls = [];

  await gmnAccount.writeGmnSession(storePath, {
    account: 'phenixnull',
    accessToken: 'expired-access',
    refreshToken: 'refresh-2',
    expiresAt: Date.now() - 1000
  });

  const overview = await gmnAccount.fetchGmnOverview(storePath, {
    fetchImpl: async (url, options = {}) => {
      calls.push({
        url,
        method: options.method || 'GET',
        auth: options.headers?.Authorization || ''
      });

      if (url.endsWith('/user/profile') && options.headers?.Authorization === 'Bearer expired-access') {
        return {
          ok: false,
          status: 401,
          async json() {
            return {
              code: 1001,
              message: 'token expired'
            };
          }
        };
      }

      if (url.endsWith('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: {
                access_token: 'fresh-access',
                refresh_token: 'fresh-refresh',
                expires_in: 7200
              }
            };
          }
        };
      }

      if (url.endsWith('/user/profile') && options.headers?.Authorization === 'Bearer fresh-access') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: {
                email: 'phenixnull@example.com',
                username: 'phenixnull',
                balance: 66.6,
                concurrency: 4,
                status: 'active'
              }
            };
          }
        };
      }

      if (url.endsWith('/subscriptions/active')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: [
                createSubscription({
                  id: 'sub-refresh',
                  group: {
                    name: 'Refresh Plan',
                    daily_limit_usd: 12,
                    weekly_limit_usd: 30,
                    monthly_limit_usd: 90
                  },
                  daily_usage_usd: 3,
                  weekly_usage_usd: 8,
                  monthly_usage_usd: 20
                })
              ]
            };
          }
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    }
  });

  assert.equal(overview.balance, 66.6);
  assert.equal(calls[0].url.endsWith('/user/profile'), true);
  assert.equal(calls[1].url.endsWith('/auth/refresh'), true);
  assert.equal(calls[2].auth, 'Bearer fresh-access');

  const saved = await gmnAccount.readGmnSession(storePath);
  assert.equal(saved.accessToken, 'fresh-access');
  assert.equal(saved.refreshToken, 'fresh-refresh');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('clearGmnSession resets a persisted session file to an empty store', async () => {
  assert.equal(typeof gmnAccount.clearGmnSession, 'function');
  assert.equal(typeof gmnAccount.writeGmnSession, 'function');
  assert.equal(typeof gmnAccount.readGmnSession, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gmn-session-'));
  const storePath = path.join(tempDir, 'gmn-session.json');

  await gmnAccount.writeGmnSession(storePath, {
    account: 'phenixnull',
    accessToken: 'token-a',
    refreshToken: 'token-b'
  });

  await gmnAccount.clearGmnSession(storePath);
  const saved = await gmnAccount.readGmnSession(storePath);

  assert.deepEqual(saved, {
    account: '',
    accessToken: '',
    refreshToken: '',
    expiresAt: 0
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('resolveGmnOverview logs in with embedded credentials when no session exists', async () => {
  assert.equal(typeof gmnAccount.resolveGmnOverview, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gmn-session-'));
  const storePath = path.join(tempDir, 'gmn-session.json');
  const calls = [];

  const overview = await gmnAccount.resolveGmnOverview(storePath, {
    credentials: {
      account: DEMO_GMN_ACCOUNT,
      password: DEMO_GMN_PASSWORD
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({
        url,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body) : null,
        auth: options.headers?.Authorization || ''
      });

      if (url.endsWith('/auth/login')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: {
                access_token: 'embedded-access',
                refresh_token: 'embedded-refresh',
                expires_in: 3600,
                user: {
                  email: DEMO_GMN_ACCOUNT,
                  username: 'phenixnull'
                }
              }
            };
          }
        };
      }

      if (url.endsWith('/user/profile')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: {
                email: DEMO_GMN_ACCOUNT,
                username: 'phenixnull',
                balance: 51.2,
                concurrency: 4,
                status: 'active'
              }
            };
          }
        };
      }

      if (url.endsWith('/subscriptions/active')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              code: 0,
              data: [
                createSubscription({
                  id: 'embedded-sub',
                  group: {
                    name: 'GMN Main',
                    daily_limit_usd: 15,
                    weekly_limit_usd: 40,
                    monthly_limit_usd: 100
                  },
                  daily_usage_usd: 4,
                  weekly_usage_usd: 10,
                  monthly_usage_usd: 22
                })
              ]
            };
          }
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    }
  });

  assert.equal(calls[0].url.endsWith('/auth/login'), true);
  assert.deepEqual(calls[0].body, {
    email: DEMO_GMN_ACCOUNT,
    password: DEMO_GMN_PASSWORD
  });
  assert.equal(overview.balance, 51.2);
  assert.equal(overview.quotas.daily.limit, 15);
  assert.equal(overview.quotas.daily.remaining, 11);

  const saved = await gmnAccount.readGmnSession(storePath);
  assert.equal(saved.account, DEMO_GMN_ACCOUNT);
  assert.equal(saved.accessToken, 'embedded-access');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('resolveGmnKeyOverview logs in if needed and returns the current auth key quota', async () => {
  assert.equal(typeof gmnAccount.resolveGmnKeyOverview, 'function');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gmn-session-'));
  const storePath = path.join(tempDir, 'gmn-session.json');
  const calls = [];

  const overview = await gmnAccount.resolveGmnKeyOverview(
    storePath,
    DEMO_GMN_KEY,
    {
      credentials: {
        account: DEMO_GMN_ACCOUNT,
        password: DEMO_GMN_PASSWORD
      },
      fetchImpl: async (url, options = {}) => {
        calls.push({
          url,
          method: options.method || 'GET',
          body: options.body ? JSON.parse(options.body) : null,
          auth: options.headers?.Authorization || ''
        });

        if (url.endsWith('/auth/login')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                code: 0,
                data: {
                  access_token: 'embedded-access',
                  refresh_token: 'embedded-refresh',
                  expires_in: 3600
                }
              };
            }
          };
        }

        if (url.includes('/keys?page=1&page_size=100')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                code: 0,
                data: {
                  items: [
                    {
                      key: DEMO_ALT_GMN_KEY,
                      name: 'other',
                      status: 'active',
                      quota: 50,
                      quota_used: 10
                    },
                    {
                      key: DEMO_GMN_KEY,
                      name: 'codex',
                      status: 'active',
                      quota: 331,
                      quota_used: 12.9707977,
                      last_used_at: '2026-03-28T21:13:46.064567+08:00',
                      updated_at: '2026-03-28T21:14:13.309077+08:00'
                    }
                  ],
                  page: 1,
                  page_size: 100,
                  total: 2,
                  pages: 1
                }
              };
            }
          };
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    }
  );

  assert.equal(calls[0].url.endsWith('/auth/login'), true);
  assert.equal(calls[1].url.includes('/keys?page=1&page_size=100'), true);
  assert.equal(overview.name, 'codex');
  assert.equal(overview.totalQuota, 331);
  assert.equal(overview.remainingQuota, 318.03);
  assert.equal(overview.progressPercent, 96.08);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
