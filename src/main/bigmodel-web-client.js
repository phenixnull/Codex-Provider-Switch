const { maskKey } = require('../shared/config-service');
const { normalizeBigModelAuth, summarizeBigModelAuth } = require('./bigmodel-auth-store');

const BIGMODEL_ORIGIN = 'https://www.bigmodel.cn';
const BIGMODEL_API_PREFIX = '/api';
const BIGMODEL_LOGIN_PATH = '/auth/login';
const BIGMODEL_USAGE_QUOTA_LIMIT_PATH = '/monitor/usage/quota/limit';

const BIGMODEL_USAGE_LIMITS = [
  {
    key: 'TOKENS_LIMIT:3',
    type: 'TOKENS_LIMIT',
    unit: 3,
    title: '每5小时使用额度',
    unitText: 'Tokens',
    tooltip:
      '套餐所支持的模型与视觉理解 MCP 共享使用额度。GLM-5、GLM-5.1、GLM-5-Turbo 作为高阶模型会按倍数消耗额度。'
  },
  {
    key: 'TIME_LIMIT:5',
    type: 'TIME_LIMIT',
    unit: 5,
    title: 'MCP 每月额度',
    unitText: '次',
    tooltip: '网络搜索、网页读取、开源仓库 MCP 每月共享额度。'
  }
];

const BIGMODEL_USAGE_DETAIL_LABELS = {
  'search-prime': '网络搜索',
  'web-reader': '网页读取',
  zread: '开源仓库'
};

function normalizeFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildUsageLimitKey(value) {
  const type = String(value?.type || '').trim();
  const unit = Number(value?.unit) || 0;
  return `${type}:${unit}`;
}

function getUsageLimitDefinition(value) {
  const key = buildUsageLimitKey(value);
  return BIGMODEL_USAGE_LIMITS.find((item) => item.key === key) || null;
}

function normalizeUsageLimitDetail(detail) {
  const modelCode = String(detail?.modelCode || '').trim();
  const usage = normalizeFiniteNumber(detail?.usage);

  if (!modelCode && usage === null) {
    return null;
  }

  return {
    modelCode,
    name: BIGMODEL_USAGE_DETAIL_LABELS[modelCode] || modelCode,
    usage
  };
}

function normalizeUsageLimitEntry(entry) {
  const definition = getUsageLimitDefinition(entry);
  const usageDetails = Array.isArray(entry?.usageDetails)
    ? entry.usageDetails
        .map((detail) => normalizeUsageLimitDetail(detail))
        .filter(Boolean)
    : [];

  return {
    key: definition?.key || buildUsageLimitKey(entry),
    type: String(entry?.type || definition?.type || '').trim(),
    unit: Number(entry?.unit) || 0,
    number: Number(entry?.number) || 0,
    title: definition?.title || '',
    tooltip: definition?.tooltip || '',
    unitText: definition?.unitText || '',
    usage: normalizeFiniteNumber(entry?.usage),
    currentValue: normalizeFiniteNumber(entry?.currentValue),
    remaining: normalizeFiniteNumber(entry?.remaining),
    percentage: normalizeFiniteNumber(entry?.percentage) ?? 0,
    nextResetTime: normalizeFiniteNumber(entry?.nextResetTime),
    usageDetails
  };
}

function compareUsageLimitEntries(left, right) {
  const leftIndex = BIGMODEL_USAGE_LIMITS.findIndex((item) => item.key === left?.key);
  const rightIndex = BIGMODEL_USAGE_LIMITS.findIndex((item) => item.key === right?.key);
  const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
  const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;

  return normalizedLeftIndex - normalizedRightIndex;
}

function normalizeBigModelQuotaLimit(payload) {
  const resolvedPayload =
    payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload;
  const rawLimits = Array.isArray(resolvedPayload?.limits) ? resolvedPayload.limits : [];

  return {
    level: typeof resolvedPayload?.level === 'string' ? resolvedPayload.level : '',
    limits: rawLimits.map((item) => normalizeUsageLimitEntry(item)).sort(compareUsageLimitEntries)
  };
}

function createBigModelCredentialsError(credentials, message) {
  const normalized = normalizeBigModelAuth(credentials);
  let resolvedMessage = message;

  if (!resolvedMessage) {
    if (!normalized.username && !normalized.password) {
      resolvedMessage = 'BigModel account username and password are required.';
    } else if (!normalized.username) {
      resolvedMessage = 'BigModel account username is required.';
    } else {
      resolvedMessage = 'BigModel account password is required.';
    }
  }

  const error = new Error(resolvedMessage);
  error.status = 401;
  return error;
}

function extractApiErrorMessage(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.msg === 'string' && payload.msg.trim()) {
    return payload.msg;
  }

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof payload.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message;
  }

  return '';
}

async function parseResponsePayload(response) {
  if (typeof response?.text === 'function') {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (typeof response?.json === 'function') {
    return response.json();
  }

  return null;
}

function unwrapBigModelPayload(payload, status = 0) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return payload;
  }

  const hasCode = Object.prototype.hasOwnProperty.call(payload, 'code');
  const codeValue = hasCode ? Number(payload.code) : NaN;
  const isSuccessCode = codeValue === 0 || codeValue === 200;
  const isSuccessFlag = payload.success === true;

  if (!hasCode && !isSuccessFlag) {
    return payload;
  }

  if (!isSuccessCode && !isSuccessFlag) {
    const message =
      codeValue === 1005
        ? 'BigModel account requires SMS two-factor verification.'
        : extractApiErrorMessage(payload) || `BigModel API error (${payload.code}).`;
    const error = new Error(message);
    error.status = status;
    error.code = payload.code;
    throw error;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }

  return payload;
}

function extractSetCookieHeaders(headers) {
  if (!headers) {
    return [];
  }

  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  if (typeof headers.raw === 'function') {
    const raw = headers.raw();

    if (raw && Array.isArray(raw['set-cookie'])) {
      return raw['set-cookie'];
    }
  }

  const directValue =
    headers['set-cookie'] || headers['Set-Cookie'] || (typeof headers.get === 'function' ? headers.get('set-cookie') : '');

  if (!directValue) {
    return [];
  }

  return Array.isArray(directValue) ? directValue : [directValue];
}

function parseCookiePair(setCookieHeader) {
  const cookieText = String(setCookieHeader || '').split(';')[0].trim();
  const index = cookieText.indexOf('=');

  if (index <= 0) {
    return null;
  }

  return {
    name: cookieText.slice(0, index).trim(),
    value: cookieText.slice(index + 1).trim()
  };
}

function applyResponseCookies(cookieJar, response) {
  for (const header of extractSetCookieHeaders(response?.headers)) {
    const cookie = parseCookiePair(header);

    if (!cookie) {
      continue;
    }

    cookieJar.set(cookie.name, cookie.value);
  }
}

function buildCookieHeader(cookieJar) {
  if (!(cookieJar instanceof Map) || cookieJar.size === 0) {
    return '';
  }

  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function resolveApiUrl(baseUrl, endpointPath) {
  const normalizedPath = String(endpointPath || '');
  const prefixedPath = normalizedPath.startsWith(`${BIGMODEL_API_PREFIX}/`)
    ? normalizedPath
    : `${BIGMODEL_API_PREFIX}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;

  return new URL(prefixedPath, `${baseUrl}/`).toString();
}

async function requestBigModelJson(clientState, endpointPath, options = {}) {
  const requestHeaders = {
    Accept: 'application/json, text/plain, */*',
    ...(options.headers || {})
  };

  if (!requestHeaders.Authorization && clientState.authToken) {
    requestHeaders.Authorization = clientState.authToken;
  }

  const cookieHeader = buildCookieHeader(clientState.cookieJar);

  if (cookieHeader) {
    requestHeaders.Cookie = cookieHeader;
  }

  let body = options.body;

  if (body !== undefined && body !== null && typeof body !== 'string') {
    body = JSON.stringify(body);

    if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }
  }

  const response = await clientState.fetchImpl(
    resolveApiUrl(clientState.baseUrl, endpointPath),
    {
      method: options.method || 'GET',
      headers: requestHeaders,
      body
    }
  );
  const payload = await parseResponsePayload(response);

  applyResponseCookies(clientState.cookieJar, response);

  if (!response?.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `BigModel request failed (${response?.status || 0}).`
    );
    error.status = response?.status || 0;
    error.code = payload?.code || '';
    throw error;
  }

  return unwrapBigModelPayload(payload, response?.status || 0);
}

function normalizeApiKeyItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function sanitizeApiKeyRecord(record) {
  const rawKey =
    typeof record?.key === 'string'
      ? record.key
      : typeof record?.apiKey === 'string'
        ? record.apiKey
        : typeof record?.maskedKey === 'string'
          ? record.maskedKey
          : '';

  return {
    id: record?.id || 0,
    name: typeof record?.name === 'string' ? record.name : '',
    maskedKey: maskKey(rawKey),
    status: typeof record?.status === 'string' ? record.status : '',
    createdAt: record?.createdAt || record?.created_at || '',
    updatedAt: record?.updatedAt || record?.updated_at || '',
    lastUsedAt: record?.lastUsedAt || record?.last_used_at || ''
  };
}

function findContextInValue(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findContextInValue(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const keySets = [
    ['organizationId', 'projectId'],
    ['orgId', 'projectId'],
    ['currentOrganizationId', 'currentProjectId'],
    ['currentOrgId', 'currentProjectId'],
    ['organization_id', 'project_id'],
    ['org_id', 'project_id']
  ];

  for (const [orgKey, projectKey] of keySets) {
    if (value[orgKey] && value[projectKey]) {
      return {
        organizationId: String(value[orgKey]).trim(),
        projectId: String(value[projectKey]).trim()
      };
    }
  }

  for (const childValue of Object.values(value)) {
    const found = findContextInValue(childValue);

    if (found) {
      return found;
    }
  }

  return null;
}

function resolveBigModelContext(auth, ...payloads) {
  const normalizedAuth = normalizeBigModelAuth(auth);

  if (normalizedAuth.organizationId && normalizedAuth.projectId) {
    return {
      organizationId: normalizedAuth.organizationId,
      projectId: normalizedAuth.projectId
    };
  }

  for (const payload of payloads) {
    const found = findContextInValue(payload);

    if (found) {
      return found;
    }
  }

  return {
    organizationId: '',
    projectId: ''
  };
}

function normalizeProductEntries(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return [payload];
}

function getProductIdFromEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  return String(entry.productId || entry.product_id || entry.id || '').trim();
}

function getProductLabelFromEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  return String(entry.productName || entry.name || entry.label || '').trim();
}

function resolveBigModelProductId(productIdInfo) {
  const entries = normalizeProductEntries(productIdInfo);
  const keywords = [/glm[-\s]?coding/i, /coding/i, /claude/i, /glm[-\s]?5\.1/i];

  for (const entry of entries) {
    const haystack = JSON.stringify(entry);

    if (keywords.some((pattern) => pattern.test(haystack))) {
      return {
        productId: getProductIdFromEntry(entry),
        productLabel: getProductLabelFromEntry(entry)
      };
    }
  }

  if (entries.length === 1) {
    return {
      productId: getProductIdFromEntry(entries[0]),
      productLabel: getProductLabelFromEntry(entries[0])
    };
  }

  return {
    productId: '',
    productLabel: ''
  };
}

function summarizeCustomerInfo(customerInfo) {
  if (!customerInfo || typeof customerInfo !== 'object') {
    return null;
  }

  return {
    email: typeof customerInfo.email === 'string' ? customerInfo.email : '',
    username:
      typeof customerInfo.username === 'string'
        ? customerInfo.username
        : typeof customerInfo.name === 'string'
          ? customerInfo.name
          : '',
    accountType:
      typeof customerInfo.accountType === 'string'
        ? customerInfo.accountType
        : typeof customerInfo.userType === 'string'
          ? customerInfo.userType
          : ''
  };
}

function createBigModelWebClient({ fetchImpl = fetch, baseUrl = BIGMODEL_ORIGIN } = {}) {
  const clientState = {
    fetchImpl,
    baseUrl,
    cookieJar: new Map(),
    authToken: ''
  };

  return {
    async login(credentials) {
      const normalized = normalizeBigModelAuth(credentials);

      if (!normalized.username || !normalized.password) {
        throw createBigModelCredentialsError(normalized);
      }

      const payload = await requestBigModelJson(clientState, BIGMODEL_LOGIN_PATH, {
        method: 'POST',
        body: {
          phoneNumber: '',
          countryCode: '',
          username: normalized.username,
          smsCode: '',
          password: normalized.password,
          loginType: 'password',
          grantType: 'customer',
          userType: 'PERSONAL',
          userCode: '',
          noLoading: true,
          appId: ''
        }
      });

      clientState.authToken =
        typeof payload?.access_token === 'string'
          ? payload.access_token
          : typeof payload?.token === 'string'
            ? payload.token
            : clientState.authToken;

      return payload;
    },
    async getCustomerInfo() {
      return requestBigModelJson(clientState, '/biz/customer/getCustomerInfo');
    },
    async getAccountSet() {
      return requestBigModelJson(clientState, '/biz/customer/accountSet');
    },
    async listApiKeys({ organizationId, projectId }) {
      if (!organizationId || !projectId) {
        throw new Error('BigModel organizationId and projectId are required for API key lookup.');
      }

      return normalizeApiKeyItems(
        await requestBigModelJson(
          clientState,
          `/biz/v1/organization/${encodeURIComponent(organizationId)}/projects/${encodeURIComponent(projectId)}/api_keys`
        )
      );
    },
    async getProductIdInfo() {
      return requestBigModelJson(clientState, '/biz/tokenResPack/productIdInfo');
    },
    async getTokenMagnitude(productId) {
      if (!productId) {
        return null;
      }

      return requestBigModelJson(
        clientState,
        `/biz/customer/getTokenMagnitude?productId=${encodeURIComponent(productId)}`
      );
    },
    async queryCustomerAccountReport() {
      return requestBigModelJson(clientState, '/biz/account/query-customer-account-report');
    },
    async queryOrgOwnerAccountReport() {
      return requestBigModelJson(clientState, '/biz/account/query-org-owner-account-report');
    },
    async getUsageQuotaLimit() {
      return normalizeBigModelQuotaLimit(
        await requestBigModelJson(clientState, BIGMODEL_USAGE_QUOTA_LIMIT_PATH)
      );
    },
    getCookieHeader() {
      return buildCookieHeader(clientState.cookieJar);
    }
  };
}

async function settleTask(errors, key, task) {
  try {
    return await task();
  } catch (error) {
    errors[key] = error.message || 'Unknown error';
    return null;
  }
}

async function fetchBigModelConsoleSnapshot(auth, { fetchImpl = fetch, baseUrl = BIGMODEL_ORIGIN } = {}) {
  const normalizedAuth = normalizeBigModelAuth(auth);

  if (!normalizedAuth.username || !normalizedAuth.password) {
    throw createBigModelCredentialsError(normalizedAuth);
  }

  const client = createBigModelWebClient({ fetchImpl, baseUrl });
  const errors = {};

  await client.login(normalizedAuth);

  const [
    customerInfo,
    accountSet,
    productIdInfo,
    customerAccountReport,
    orgOwnerAccountReport,
    quotaLimit
  ] =
    await Promise.all([
      settleTask(errors, 'customerInfo', () => client.getCustomerInfo()),
      settleTask(errors, 'accountSet', () => client.getAccountSet()),
      settleTask(errors, 'productIdInfo', () => client.getProductIdInfo()),
      settleTask(errors, 'customerAccountReport', () => client.queryCustomerAccountReport()),
      settleTask(errors, 'orgOwnerAccountReport', () => client.queryOrgOwnerAccountReport()),
      settleTask(errors, 'usageQuotaLimit', () => client.getUsageQuotaLimit())
    ]);

  const context = resolveBigModelContext(normalizedAuth, accountSet, customerInfo);
  const apiKeyRecords =
    context.organizationId && context.projectId
      ? await settleTask(errors, 'apiKeys', () => client.listApiKeys(context))
      : null;
  const resolvedProduct = resolveBigModelProductId(productIdInfo);
  const tokenMagnitude = resolvedProduct.productId
    ? await settleTask(errors, 'tokenMagnitude', () => client.getTokenMagnitude(resolvedProduct.productId))
    : null;
  const apiKeys = Array.isArray(apiKeyRecords) ? apiKeyRecords : [];
  const matchedKey =
    normalizedAuth.apiKey && apiKeys.length > 0
      ? apiKeys.find((item) => item?.key === normalizedAuth.apiKey || item?.apiKey === normalizedAuth.apiKey)
      : null;

  return {
    auth: summarizeBigModelAuth(normalizedAuth),
    account: summarizeCustomerInfo(customerInfo),
    context,
    apiKeys: {
      count: apiKeys.length,
      matchedKeyName: typeof matchedKey?.name === 'string' ? matchedKey.name : '',
      items: apiKeys.map(sanitizeApiKeyRecord)
    },
    usage: {
      productId: resolvedProduct.productId,
      productLabel: resolvedProduct.productLabel,
      tokenMagnitude,
      customerAccountReport,
      orgOwnerAccountReport,
      quotaLimit: quotaLimit || normalizeBigModelQuotaLimit(null),
      refreshedAt: Date.now()
    },
    errors
  };
}

module.exports = {
  BIGMODEL_LOGIN_PATH,
  BIGMODEL_ORIGIN,
  BIGMODEL_USAGE_QUOTA_LIMIT_PATH,
  createBigModelWebClient,
  fetchBigModelConsoleSnapshot,
  normalizeBigModelQuotaLimit,
  resolveBigModelContext,
  resolveBigModelProductId,
  sanitizeApiKeyRecord
};
