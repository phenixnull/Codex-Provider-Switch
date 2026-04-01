const test = require('node:test');
const assert = require('node:assert/strict');

let openAiUsage = {};

try {
  openAiUsage = require('../src/main/openai-usage');
} catch {
  openAiUsage = {};
}

const chatGptAuthText = `{
  "auth_mode": "chatgpt",
  "tokens": {
    "access_token": "access-123",
    "refresh_token": "refresh-456",
    "account_id": "account-789"
  },
  "last_refresh": "2026-04-01T08:00:00.000Z"
}
`;

const usagePayload = {
  user_id: 'user-123',
  account_id: 'account-789',
  email: 'person@example.com',
  plan_type: 'plus',
  rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: {
      used_percent: 3,
      limit_window_seconds: 18000,
      reset_after_seconds: 17735,
      reset_at: 1775047655
    },
    secondary_window: {
      used_percent: 1,
      limit_window_seconds: 604800,
      reset_after_seconds: 604535,
      reset_at: 1775634455
    }
  },
  code_review_rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: {
      used_percent: 0,
      limit_window_seconds: 604800,
      reset_after_seconds: 604800,
      reset_at: 1775634720
    },
    secondary_window: null
  },
  credits: {
    has_credits: false,
    unlimited: false,
    balance: '0',
    approx_local_messages: [0, 0],
    approx_cloud_messages: [0, 0]
  },
  spend_control: {
    reached: false
  }
};

test('buildOpenAiUsageOverview converts the 5-hour usage window into remaining percent metadata', () => {
  assert.equal(typeof openAiUsage.buildOpenAiUsageOverview, 'function');

  const overview = openAiUsage.buildOpenAiUsageOverview(usagePayload);

  assert.equal(overview.usageKind, 'chatgpt_rate_limit');
  assert.equal(overview.authType, 'chatgpt');
  assert.equal(overview.planType, 'plus');
  assert.equal(overview.status, 'active');
  assert.equal(overview.totalQuota, 100);
  assert.equal(overview.usedQuota, 3);
  assert.equal(overview.remainingQuota, 97);
  assert.equal(overview.progressPercent, 97);
  assert.equal(overview.limitWindowSeconds, 18000);
  assert.equal(overview.resetAfterSeconds, 17735);
  assert.equal(overview.resetAt, 1775047655);
  assert.equal(overview.secondaryWindow.limitWindowSeconds, 604800);
  assert.equal(overview.codeReviewRateLimit.primaryWindow.limitWindowSeconds, 604800);
});

test('fetchOpenAiUsageOverview queries the wham usage endpoint with the ChatGPT access token', async () => {
  assert.equal(typeof openAiUsage.fetchOpenAiUsageOverview, 'function');

  const calls = [];
  const overview = await openAiUsage.fetchOpenAiUsageOverview(chatGptAuthText, {
    fetchImpl: async (url, options = {}) => {
      calls.push({
        url,
        auth: options.headers?.Authorization || ''
      });

      return {
        ok: true,
        status: 200,
        async json() {
          return usagePayload;
        }
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://chatgpt.com/backend-api/wham/usage');
  assert.equal(calls[0].auth, 'Bearer access-123');
  assert.equal(overview.planType, 'plus');
  assert.equal(overview.remainingQuota, 97);
  assert.equal(overview.progressPercent, 97);
});

test('fetchOpenAiUsageOverview falls back to PowerShell on Windows when Node fetch fails', async () => {
  assert.equal(typeof openAiUsage.fetchOpenAiUsageOverview, 'function');

  let powershellCalls = 0;
  const overview = await openAiUsage.fetchOpenAiUsageOverview(chatGptAuthText, {
    platform: 'win32',
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
    powershellImpl: async (request) => {
      powershellCalls += 1;
      assert.equal(request.endpoint, 'https://chatgpt.com/backend-api/wham/usage');
      assert.equal(request.accessToken, 'access-123');

      return {
        status: 200,
        payload: usagePayload
      };
    }
  });

  assert.equal(powershellCalls, 1);
  assert.equal(overview.status, 'active');
  assert.equal(overview.remainingQuota, 97);
});

test('fetchOpenAiUsageOverview rejects when auth.json is not using ChatGPT sign-in', async () => {
  assert.equal(typeof openAiUsage.fetchOpenAiUsageOverview, 'function');

  await assert.rejects(
    openAiUsage.fetchOpenAiUsageOverview('{\n  "OPENAI_API_KEY": "sk-demo"\n}\n'),
    /ChatGPT sign-in auth/i
  );
});
