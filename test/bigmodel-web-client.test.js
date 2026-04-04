const test = require('node:test');
const assert = require('node:assert/strict');

let bigModel = {};

try {
  bigModel = require('../src/main/bigmodel-web-client');
} catch {
  bigModel = {};
}

function createJsonResponse(payload, { ok = true, status = 200, setCookies = [] } = {}) {
  return {
    ok,
    status,
    headers: {
      getSetCookie() {
        return setCookies;
      }
    },
    async json() {
      return payload;
    }
  };
}

test('createBigModelWebClient logs in with password mode and forwards cookies to later requests', async () => {
  assert.equal(typeof bigModel.createBigModelWebClient, 'function');

  const requests = [];
  const client = bigModel.createBigModelWebClient({
    fetchImpl: async (url, options = {}) => {
      const request = {
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body ? JSON.parse(options.body) : null
      };

      requests.push(request);

      if (String(url).endsWith('/auth/login')) {
        return createJsonResponse(
          {
            code: 200,
            success: true,
            data: {
              userId: 'user-1',
              access_token: 'token-abc-123'
            }
          },
          {
            setCookies: ['SESSION=abc123; Path=/; HttpOnly', 'csrftoken=csrf456; Path=/']
          }
        );
      }

      if (String(url).endsWith('/biz/customer/getCustomerInfo')) {
        return createJsonResponse({
          code: 0,
          data: {
            customerId: 'customer-1'
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    }
  });

  await client.login({
    username: 'demo@example.com',
    password: 'secret-password'
  });
  const customerInfo = await client.getCustomerInfo();

  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, 'https://www.bigmodel.cn/api/auth/login');
  assert.deepEqual(requests[0].body, {
    phoneNumber: '',
    countryCode: '',
    username: 'demo@example.com',
    smsCode: '',
    password: 'secret-password',
    loginType: 'password',
    grantType: 'customer',
    userType: 'PERSONAL',
    userCode: '',
    noLoading: true,
    appId: ''
  });
  assert.equal(requests[1].url, 'https://www.bigmodel.cn/api/biz/customer/getCustomerInfo');
  assert.equal(requests[1].headers.Cookie, 'SESSION=abc123; csrftoken=csrf456');
  assert.equal(requests[1].headers.Authorization, 'token-abc-123');
  assert.deepEqual(customerInfo, {
    customerId: 'customer-1'
  });
});

test('createBigModelWebClient surfaces the 2FA branch when the login API returns code 1005', async () => {
  assert.equal(typeof bigModel.createBigModelWebClient, 'function');

  const client = bigModel.createBigModelWebClient({
    fetchImpl: async () =>
      createJsonResponse({
        code: 1005,
        message: 'two factor auth required'
      })
  });

  await assert.rejects(
    client.login({
      username: 'demo@example.com',
      password: 'secret-password'
    }),
    (error) => error && error.code === 1005
  );
});

test('createBigModelWebClient handles non-JSON HTTP bodies without reading the response twice', async () => {
  assert.equal(typeof bigModel.createBigModelWebClient, 'function');

  const client = bigModel.createBigModelWebClient({
    fetchImpl: async () =>
      new Response('<html><body>forbidden</body></html>', {
        status: 403,
        headers: {
          'content-type': 'text/html'
        }
      })
  });

  await assert.rejects(
    client.login({
      username: 'demo@example.com',
      password: 'secret-password'
    }),
    /forbidden/i
  );
});

test('fetchBigModelConsoleSnapshot resolves the current org/project, masks API keys, and fetches usage reports', async () => {
  assert.equal(typeof bigModel.fetchBigModelConsoleSnapshot, 'function');

  const requests = [];
  const snapshot = await bigModel.fetchBigModelConsoleSnapshot(
    {
      username: 'demo@example.com',
      password: 'secret-password',
      apiKey: 'sk-live-bigmodel-key-1234567890',
      organizationId: '',
      projectId: ''
    },
    {
      fetchImpl: async (url, options = {}) => {
        requests.push({
          url: String(url),
          method: options.method || 'GET',
          headers: options.headers || {}
        });

        if (String(url).endsWith('/auth/login')) {
          return createJsonResponse(
            {
              code: 0,
              data: {
                userId: 'user-1'
              }
            },
            {
              setCookies: ['SESSION=abc123; Path=/; HttpOnly']
            }
          );
        }

        if (String(url).endsWith('/biz/customer/getCustomerInfo')) {
          return createJsonResponse({
            code: 0,
            data: {
              email: 'demo@example.com',
              accountType: 'PERSONAL'
            }
          });
        }

        if (String(url).endsWith('/biz/customer/accountSet')) {
          return createJsonResponse({
            code: 0,
            data: {
              organizationId: 'org-9',
              projectId: 'proj-7'
            }
          });
        }

        if (String(url).endsWith('/biz/v1/organization/org-9/projects/proj-7/api_keys')) {
          return createJsonResponse({
            code: 0,
            data: [
              {
                id: 11,
                name: 'Claude GLM',
                key: 'sk-live-bigmodel-key-1234567890',
                status: 'active'
              }
            ]
          });
        }

        if (String(url).endsWith('/biz/tokenResPack/productIdInfo')) {
          return createJsonResponse({
            code: 0,
            data: [
              {
                productId: 'prod-glm-coding',
                productName: 'GLM Coding'
              }
            ]
          });
        }

        if (String(url).includes('/biz/customer/getTokenMagnitude?productId=prod-glm-coding')) {
          return createJsonResponse({
            code: 0,
            data: {
              total: 1000,
              remaining: 640
            }
          });
        }

        if (String(url).endsWith('/biz/account/query-customer-account-report')) {
          return createJsonResponse({
            code: 0,
            data: {
              balance: 88.5
            }
          });
        }

        if (String(url).endsWith('/biz/account/query-org-owner-account-report')) {
          return createJsonResponse({
            code: 0,
            data: {
              balance: 166.2
            }
          });
        }

        if (String(url).endsWith('/monitor/usage/quota/limit')) {
          return createJsonResponse({
            code: 200,
            success: true,
            data: {
              level: 'max',
              limits: [
                {
                  type: 'TIME_LIMIT',
                  unit: 5,
                  number: 1,
                  usage: 4000,
                  currentValue: 164,
                  remaining: 3836,
                  percentage: 4,
                  nextResetTime: 1775820943997,
                  usageDetails: [
                    {
                      modelCode: 'search-prime',
                      usage: 110
                    },
                    {
                      modelCode: 'web-reader',
                      usage: 45
                    },
                    {
                      modelCode: 'zread',
                      usage: 9
                    }
                  ]
                },
                {
                  type: 'TOKENS_LIMIT',
                  unit: 3,
                  number: 5,
                  percentage: 0
                }
              ]
            }
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    }
  );

  assert.equal(requests[1].headers.Cookie, 'SESSION=abc123');
  assert.deepEqual(snapshot.context, {
    organizationId: 'org-9',
    projectId: 'proj-7'
  });
  assert.deepEqual(snapshot.auth, {
    username: 'demo@example.com',
    hasPassword: true,
    maskedApiKey: 'sk-live...7890',
    organizationId: '',
    projectId: ''
  });
  assert.equal(snapshot.apiKeys.count, 1);
  assert.equal(snapshot.apiKeys.matchedKeyName, 'Claude GLM');
  assert.deepEqual(snapshot.apiKeys.items[0], {
    id: 11,
    name: 'Claude GLM',
    maskedKey: 'sk-live...7890',
    status: 'active',
    createdAt: '',
    updatedAt: '',
    lastUsedAt: ''
  });
  assert.equal(snapshot.usage.productId, 'prod-glm-coding');
  assert.equal(snapshot.usage.productLabel, 'GLM Coding');
  assert.deepEqual(snapshot.usage.tokenMagnitude, {
    total: 1000,
    remaining: 640
  });
  assert.deepEqual(snapshot.usage.customerAccountReport, {
    balance: 88.5
  });
  assert.deepEqual(snapshot.usage.orgOwnerAccountReport, {
    balance: 166.2
  });
  assert.deepEqual(snapshot.usage.quotaLimit, {
    level: 'max',
    limits: [
      {
        key: 'TOKENS_LIMIT:3',
        type: 'TOKENS_LIMIT',
        unit: 3,
        number: 5,
        title: '每5小时使用额度',
        tooltip:
          '套餐所支持的模型与视觉理解 MCP 共享使用额度。GLM-5、GLM-5.1、GLM-5-Turbo 作为高阶模型会按倍数消耗额度。',
        unitText: 'Tokens',
        usage: null,
        currentValue: null,
        remaining: null,
        percentage: 0,
        nextResetTime: null,
        usageDetails: []
      },
      {
        key: 'TIME_LIMIT:5',
        type: 'TIME_LIMIT',
        unit: 5,
        number: 1,
        title: 'MCP 每月额度',
        tooltip: '网络搜索、网页读取、开源仓库 MCP 每月共享额度。',
        unitText: '次',
        usage: 4000,
        currentValue: 164,
        remaining: 3836,
        percentage: 4,
        nextResetTime: 1775820943997,
        usageDetails: [
          {
            modelCode: 'search-prime',
            name: '网络搜索',
            usage: 110
          },
          {
            modelCode: 'web-reader',
            name: '网页读取',
            usage: 45
          },
          {
            modelCode: 'zread',
            name: '开源仓库',
            usage: 9
          }
        ]
      }
    ]
  });
  assert.equal(typeof snapshot.usage.refreshedAt, 'number');
});
