const fs = require('node:fs/promises');
const path = require('node:path');

const { maskKey } = require('../shared/config-service');

const GMN_API_BASE_URL = 'https://gmn.chuangzuoli.com/api/v1';
const DEFAULT_GMN_CREDENTIALS = Object.freeze({
  account: '',
  password: ''
});

function createEmptySession() {
  return {
    account: '',
    accessToken: '',
    refreshToken: '',
    expiresAt: 0
  };
}

function hasGmnCredentials(credentials) {
  return (
    !!credentials &&
    typeof credentials.account === 'string' &&
    !!credentials.account.trim() &&
    typeof credentials.password === 'string' &&
    !!credentials.password.trim()
  );
}

function createMissingGmnCredentialsError() {
  const error = new Error('GMN account credentials are required.');
  error.status = 401;
  return error;
}

function normalizeGmnSessionStore(parsed) {
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return createEmptySession();
  }

  return {
    account: typeof parsed.account === 'string' ? parsed.account : '',
    accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : '',
    refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
    expiresAt: Number.isFinite(Number(parsed.expiresAt)) ? Number(parsed.expiresAt) : 0
  };
}

async function readGmnSession(storePath) {
  try {
    const text = await fs.readFile(storePath, 'utf8');
    return normalizeGmnSessionStore(JSON.parse(text));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return createEmptySession();
    }

    throw error;
  }
}

async function writeGmnSession(storePath, session) {
  const normalized = normalizeGmnSessionStore(session);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

async function clearGmnSession(storePath) {
  return writeGmnSession(storePath, createEmptySession());
}

function roundUsd(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildQuotaSummary(subscriptions, limitKey, usageKey) {
  let limit = 0;
  let used = 0;

  for (const subscription of subscriptions) {
    const planLimit = Number(subscription?.group?.[limitKey]) || 0;

    if (planLimit <= 0) {
      continue;
    }

    limit += planLimit;
    used += Number(subscription?.[usageKey]) || 0;
  }

  return {
    limit: roundUsd(limit),
    used: roundUsd(used),
    remaining: roundUsd(Math.max(limit - used, 0))
  };
}

function buildGmnOverview({ profile, subscriptions }) {
  const activeSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];

  return {
    accountLabel: profile?.email || profile?.username || '',
    email: profile?.email || '',
    username: profile?.username || '',
    balance: roundUsd(profile?.balance),
    concurrency: Number(profile?.concurrency) || 0,
    status: profile?.status || '',
    activeSubscriptionCount: activeSubscriptions.length,
    quotas: {
      daily: buildQuotaSummary(activeSubscriptions, 'daily_limit_usd', 'daily_usage_usd'),
      weekly: buildQuotaSummary(activeSubscriptions, 'weekly_limit_usd', 'weekly_usage_usd'),
      monthly: buildQuotaSummary(activeSubscriptions, 'monthly_limit_usd', 'monthly_usage_usd')
    },
    subscriptions: activeSubscriptions,
    updatedAt: new Date().toISOString()
  };
}

function buildGmnKeyOverview(keyRecord) {
  const totalQuota = roundUsd(keyRecord?.quota);
  const usedQuota = roundUsd(keyRecord?.quota_used);
  const remainingQuota = roundUsd(Math.max(totalQuota - usedQuota, 0));
  const progressPercent =
    totalQuota > 0 ? roundUsd((remainingQuota / totalQuota) * 100) : 0;

  return {
    id: Number(keyRecord?.id) || 0,
    key: typeof keyRecord?.key === 'string' ? keyRecord.key : '',
    maskedKey: maskKey(typeof keyRecord?.key === 'string' ? keyRecord.key : ''),
    name: typeof keyRecord?.name === 'string' ? keyRecord.name : '',
    status: typeof keyRecord?.status === 'string' ? keyRecord.status : '',
    totalQuota,
    usedQuota,
    remainingQuota,
    progressPercent,
    lastUsedAt: keyRecord?.last_used_at || null,
    updatedAt: keyRecord?.updated_at || new Date().toISOString()
  };
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

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof payload.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message;
  }

  return '';
}

async function parseResponsePayload(response) {
  if (typeof response.json === 'function') {
    return response.json();
  }

  if (typeof response.text === 'function') {
    return response.text();
  }

  return null;
}

function unwrapApiPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if ('code' in payload) {
    if (payload.code !== 0) {
      const error = new Error(extractApiErrorMessage(payload) || `GMN API error (${payload.code}).`);
      error.status = 400;
      throw error;
    }

    if ('data' in payload) {
      return payload.data;
    }
  }

  return payload;
}

async function requestGmnApi(endpointPath, { method = 'GET', headers = {}, body } = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`${GMN_API_BASE_URL}${endpointPath}`, {
    method,
    headers,
    body
  });
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `GMN request failed (${response.status}).`
    );
    error.status = response.status || 0;
    throw error;
  }

  return unwrapApiPayload(payload);
}

function buildSessionFromAuthPayload(account, payload, previousSession = createEmptySession()) {
  return {
    account: account || previousSession.account || '',
    accessToken: payload?.access_token || previousSession.accessToken || '',
    refreshToken: payload?.refresh_token || previousSession.refreshToken || '',
    expiresAt:
      payload?.expires_in && Number.isFinite(Number(payload.expires_in))
        ? Date.now() + Number(payload.expires_in) * 1000
        : previousSession.expiresAt || 0
  };
}

async function refreshGmnSession(storePath, { fetchImpl = fetch } = {}) {
  const current = await readGmnSession(storePath);

  if (!current.refreshToken) {
    const error = new Error('GMN refresh token is missing.');
    error.status = 401;
    throw error;
  }

  const refreshed = await requestGmnApi(
    '/auth/refresh',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: current.refreshToken
      })
    },
    fetchImpl
  );
  const nextSession = buildSessionFromAuthPayload(current.account, refreshed, current);

  await writeGmnSession(storePath, nextSession);
  return nextSession;
}

function buildAuthorizedHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

async function runWithGmnSession(storePath, task, { fetchImpl = fetch } = {}) {
  let session = await readGmnSession(storePath);

  if (!session.accessToken) {
    const error = new Error('GMN account is not logged in.');
    error.status = 401;
    throw error;
  }

  try {
    return await task(session.accessToken);
  } catch (error) {
    if (error?.status !== 401 || !session.refreshToken) {
      throw error;
    }

    session = await refreshGmnSession(storePath, { fetchImpl });
    return task(session.accessToken);
  }
}

async function fetchGmnOverview(storePath, { fetchImpl = fetch } = {}) {
  return runWithGmnSession(
    storePath,
    async (accessToken) => {
      const headers = buildAuthorizedHeaders(accessToken);
      const profile = await requestGmnApi('/user/profile', { headers }, fetchImpl);
      const subscriptions = await requestGmnApi('/subscriptions/active', { headers }, fetchImpl);

      return buildGmnOverview({
        profile,
        subscriptions
      });
    },
    { fetchImpl }
  );
}

async function listAllGmnKeys(accessToken, fetchImpl = fetch) {
  const headers = buildAuthorizedHeaders(accessToken);
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await requestGmnApi(`/keys?page=${page}&page_size=100`, { headers }, fetchImpl);
    const pageItems = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

    items.push(...pageItems);
    totalPages = Math.max(Number(payload?.pages) || 1, 1);
    page += 1;
  } while (page <= totalPages);

  return items;
}

async function fetchGmnKeyOverview(storePath, apiKey, { fetchImpl = fetch } = {}) {
  const targetKey = String(apiKey || '').trim();

  if (!targetKey) {
    throw new Error('GMN key is required.');
  }

  return runWithGmnSession(
    storePath,
    async (accessToken) => {
      const keys = await listAllGmnKeys(accessToken, fetchImpl);
      const keyRecord = keys.find((item) => String(item?.key || '').trim() === targetKey);

      if (!keyRecord) {
        const error = new Error('Current GMN key was not found in your account.');
        error.status = 404;
        throw error;
      }

      return buildGmnKeyOverview(keyRecord);
    },
    { fetchImpl }
  );
}

async function authenticateGmnSession({ account, password }, storePath, { fetchImpl = fetch } = {}) {
  if (!account || !String(account).trim()) {
    throw new Error('GMN account is required.');
  }

  if (!password || !String(password).trim()) {
    throw new Error('GMN password is required.');
  }

  const loginResult = await requestGmnApi(
    '/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: String(account).trim(),
        password: String(password)
      })
    },
    fetchImpl
  );

  if (!loginResult?.access_token) {
    throw new Error('GMN login did not return an access token.');
  }

  const nextSession = buildSessionFromAuthPayload(String(account).trim(), loginResult);
  await writeGmnSession(storePath, nextSession);
  return nextSession;
}

async function loginGmnAccount(credentials, storePath, { fetchImpl = fetch } = {}) {
  await authenticateGmnSession(credentials, storePath, { fetchImpl });
  return fetchGmnOverview(storePath, { fetchImpl });
}

async function resolveGmnOverview(
  storePath,
  { fetchImpl = fetch, credentials = DEFAULT_GMN_CREDENTIALS } = {}
) {
  const session = await readGmnSession(storePath);

  if (session.accessToken) {
    try {
      return await fetchGmnOverview(storePath, { fetchImpl });
    } catch (error) {
      if (error?.status !== 401) {
        throw error;
      }
    }
  }

  if (!hasGmnCredentials(credentials)) {
    throw createMissingGmnCredentialsError();
  }

  return loginGmnAccount(credentials, storePath, { fetchImpl });
}

async function resolveGmnKeyOverview(
  storePath,
  apiKey,
  { fetchImpl = fetch, credentials = DEFAULT_GMN_CREDENTIALS } = {}
) {
  const session = await readGmnSession(storePath);

  if (session.accessToken) {
    try {
      return await fetchGmnKeyOverview(storePath, apiKey, { fetchImpl });
    } catch (error) {
      if (error?.status !== 401) {
        throw error;
      }
    }
  }

  if (!hasGmnCredentials(credentials)) {
    throw createMissingGmnCredentialsError();
  }

  await authenticateGmnSession(credentials, storePath, { fetchImpl });
  return fetchGmnKeyOverview(storePath, apiKey, { fetchImpl });
}

module.exports = {
  buildGmnOverview,
  buildGmnKeyOverview,
  clearGmnSession,
  DEFAULT_GMN_CREDENTIALS,
  fetchGmnKeyOverview,
  fetchGmnOverview,
  loginGmnAccount,
  normalizeGmnSessionStore,
  readGmnSession,
  resolveGmnKeyOverview,
  resolveGmnOverview,
  refreshGmnSession,
  writeGmnSession
};
