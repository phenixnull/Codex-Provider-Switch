const { maskKey } = require('../shared/config-service');

const QUAN2GO_API_BASE_URL = 'https://deepl.micosoft.icu';
const QUAN2GO_CARD_LOGIN_URL = `${QUAN2GO_API_BASE_URL}/api/users/card-login`;
const QUAN2GO_WHOAMI_URL = `${QUAN2GO_API_BASE_URL}/api/users/whoami`;
const DEFAULT_QUAN2GO_DAILY_QUOTA = 90;

function roundUsd(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function extractApiErrorMessage(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload.msg === 'string' && payload.msg.trim()) {
    return payload.msg;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
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

function resolveDailyQuota(userPayload) {
  const vipQuota = Number(userPayload?.vip?.day_score);
  const fallbackQuota = Number(userPayload?.day_score);

  if (Number.isFinite(vipQuota) && vipQuota > 0) {
    return vipQuota;
  }

  if (Number.isFinite(fallbackQuota) && fallbackQuota > 0) {
    return fallbackQuota;
  }

  return DEFAULT_QUAN2GO_DAILY_QUOTA;
}

function resolveUserStatus(userPayload) {
  const expiresAt = Number(userPayload?.vip?.expire_at) || 0;

  if (expiresAt > 0 && expiresAt <= Date.now()) {
    return 'expired';
  }

  return Number(userPayload?.status) === 1 ? 'active' : 'inactive';
}

function buildQuan2GoUsageOverview(userPayload, activationCode = '') {
  const targetCode = String(activationCode || userPayload?.account || '').trim();
  const totalQuota = roundUsd(resolveDailyQuota(userPayload));
  const usedQuota = roundUsd(Number(userPayload?.day_score_used) || 0);
  const remainingQuota = roundUsd(Math.max(totalQuota - usedQuota, 0));
  const usedPercent = totalQuota > 0 ? roundUsd((usedQuota / totalQuota) * 100) : 0;
  const progressPercent = totalQuota > 0 ? roundUsd((remainingQuota / totalQuota) * 100) : 0;

  return {
    key: targetCode,
    maskedKey: maskKey(targetCode),
    usageKind: 'daily_usage_quota',
    status: resolveUserStatus(userPayload),
    userId: Number(userPayload?.id) || 0,
    account: typeof userPayload?.account === 'string' ? userPayload.account : '',
    totalQuota,
    usedQuota,
    remainingQuota,
    usedPercent,
    progressPercent,
    dayScoreDate: typeof userPayload?.day_score_date === 'string' ? userPayload.day_score_date : '',
    expiresAt: Number(userPayload?.vip?.expire_at) || 0,
    product: typeof userPayload?.vip?.product === 'string' ? userPayload.vip.product : '',
    token: typeof userPayload?.token === 'string' ? userPayload.token : '',
    updatedAt: new Date().toISOString()
  };
}

async function fetchQuan2GoCardLogin(activationCode, { fetchImpl = fetch } = {}) {
  const targetCode = String(activationCode || '').trim();

  if (!targetCode) {
    throw new Error('Quan2Go activation code is required.');
  }

  const response = await fetchImpl(QUAN2GO_CARD_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      card: targetCode,
      agent: 'main'
    })
  });
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `Quan2Go card login failed (${response.status}).`
    );
    error.status = response.status || 0;
    throw error;
  }

  if (payload?.code !== 0) {
    const error = new Error(extractApiErrorMessage(payload) || 'Quan2Go card login failed.');
    error.status = 401;
    throw error;
  }

  return payload?.data || {};
}

async function fetchQuan2GoWhoAmI(token, { fetchImpl = fetch } = {}) {
  const targetToken = String(token || '').trim();

  if (!targetToken) {
    throw new Error('Quan2Go session token is required.');
  }

  const response = await fetchImpl(QUAN2GO_WHOAMI_URL, {
    headers: {
      'x-auth-token': targetToken
    }
  });
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `Quan2Go whoami request failed (${response.status}).`
    );
    error.status = response.status || 0;
    throw error;
  }

  if (payload?.code !== 0) {
    const error = new Error(extractApiErrorMessage(payload) || 'Quan2Go whoami request failed.');
    error.status = 401;
    throw error;
  }

  return payload?.data || {};
}

async function fetchQuan2GoUsageOverview(activationCode, { fetchImpl = fetch } = {}) {
  const targetCode = String(activationCode || '').trim();
  const loginUser = await fetchQuan2GoCardLogin(targetCode, { fetchImpl });
  const loginToken = String(loginUser?.token || '').trim();

  if (!loginToken) {
    return buildQuan2GoUsageOverview(loginUser, targetCode);
  }

  let liveUser = loginUser;

  try {
    liveUser = await fetchQuan2GoWhoAmI(loginToken, { fetchImpl });
  } catch {
    liveUser = loginUser;
  }

  return buildQuan2GoUsageOverview(
    {
      ...loginUser,
      ...liveUser,
      token: liveUser?.token || loginUser?.token || ''
    },
    targetCode
  );
}

module.exports = {
  DEFAULT_QUAN2GO_DAILY_QUOTA,
  QUAN2GO_API_BASE_URL,
  QUAN2GO_CARD_LOGIN_URL,
  QUAN2GO_WHOAMI_URL,
  buildQuan2GoUsageOverview,
  fetchQuan2GoCardLogin,
  fetchQuan2GoUsageOverview,
  fetchQuan2GoWhoAmI
};
