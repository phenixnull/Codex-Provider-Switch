const { maskKey } = require('../shared/config-service');

const GWEN_USAGE_URL = 'https://ai.love-gwen.top/v1/usage';

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

function buildGwenKeyOverview(payload, apiKey = '') {
  const totalQuota = roundUsd(payload?.quota?.limit);
  const usedQuota = roundUsd(payload?.quota?.used);
  const rawRemaining = Number(payload?.quota?.remaining);
  const fallbackRemaining = Number(payload?.remaining);
  const remainingQuota = roundUsd(
    Number.isFinite(rawRemaining)
      ? rawRemaining
      : Number.isFinite(fallbackRemaining)
        ? fallbackRemaining
        : Math.max(totalQuota - usedQuota, 0)
  );
  const progressPercent =
    totalQuota > 0 ? roundUsd((remainingQuota / totalQuota) * 100) : 0;

  return {
    key: String(apiKey || '').trim(),
    maskedKey: maskKey(String(apiKey || '').trim()),
    status: typeof payload?.status === 'string' ? payload.status : '',
    isValid: payload?.isValid !== false,
    mode: typeof payload?.mode === 'string' ? payload.mode : '',
    totalQuota,
    usedQuota,
    remainingQuota,
    progressPercent,
    unit: typeof payload?.quota?.unit === 'string' ? payload.quota.unit : 'USD',
    expiresAt: payload?.expires_at || null,
    daysUntilExpiry:
      Number.isFinite(Number(payload?.days_until_expiry)) ? Number(payload.days_until_expiry) : null,
    updatedAt: new Date().toISOString()
  };
}

async function fetchGwenKeyOverview(apiKey, { fetchImpl = fetch } = {}) {
  const targetKey = String(apiKey || '').trim();

  if (!targetKey) {
    throw new Error('GWEN key is required.');
  }

  const response = await fetchImpl(GWEN_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${targetKey}`
    }
  });
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `GWEN usage request failed (${response.status}).`
    );
    error.status = response.status || 0;
    throw error;
  }

  if (payload?.isValid === false) {
    const error = new Error(extractApiErrorMessage(payload) || 'GWEN key is invalid.');
    error.status = 401;
    throw error;
  }

  return buildGwenKeyOverview(payload, targetKey);
}

module.exports = {
  buildGwenKeyOverview,
  fetchGwenKeyOverview
};
