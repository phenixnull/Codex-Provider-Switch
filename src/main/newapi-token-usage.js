const { maskKey } = require('../shared/config-service');

const DEFAULT_NEWAPI_QUOTA_PER_UNIT = 500000;
const DEFAULT_NEWAPI_DISPLAY_TYPE = 'USD';

function roundUsd(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
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

function normalizeQuotaPerUnit(quotaPerUnit) {
  const normalized = Number(quotaPerUnit);
  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : DEFAULT_NEWAPI_QUOTA_PER_UNIT;
}

function buildNewApiTokenOverview(payload, { apiKey = '', quotaPerUnit, quotaDisplayType } = {}) {
  const tokenPayload = payload?.data || {};
  const normalizedQuotaPerUnit = normalizeQuotaPerUnit(quotaPerUnit);
  const displayType = String(quotaDisplayType || DEFAULT_NEWAPI_DISPLAY_TYPE).trim() || 'USD';
  const rawTotalGranted = Number(tokenPayload.total_granted) || 0;
  const rawTotalUsed = Number(tokenPayload.total_used) || 0;
  const rawTotalAvailable = Number(tokenPayload.total_available) || 0;
  const totalQuota = roundUsd(rawTotalGranted / normalizedQuotaPerUnit);
  const usedQuota = roundUsd(rawTotalUsed / normalizedQuotaPerUnit);
  const remainingQuota = roundUsd(rawTotalAvailable / normalizedQuotaPerUnit);
  const progressPercent =
    totalQuota > 0 ? roundUsd((remainingQuota / totalQuota) * 100) : 0;

  return {
    key: String(apiKey || '').trim(),
    maskedKey: maskKey(String(apiKey || '').trim()),
    name: typeof tokenPayload.name === 'string' ? tokenPayload.name : '',
    status: 'active',
    totalQuota,
    usedQuota,
    remainingQuota,
    progressPercent,
    displayType,
    quotaPerUnit: normalizedQuotaPerUnit,
    object: tokenPayload.object || '',
    expiresAt: Number(tokenPayload.expires_at) || 0,
    unlimitedQuota: tokenPayload.unlimited_quota === true,
    modelLimitsEnabled: tokenPayload.model_limits_enabled === true,
    modelLimits: tokenPayload.model_limits || {},
    updatedAt: new Date().toISOString()
  };
}

async function fetchNewApiStatus(baseUrl, { fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const response = await fetchImpl(`${normalizedBaseUrl}/api/status`);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `NewAPI status request failed (${response.status}).`
    );
    error.status = response.status || 0;
    throw error;
  }

  return payload?.data || {};
}

async function fetchNewApiTokenOverview(baseUrl, apiKey, { fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const targetKey = String(apiKey || '').trim();

  if (!normalizedBaseUrl) {
    throw new Error('NewAPI base URL is required.');
  }

  if (!targetKey) {
    throw new Error('NewAPI key is required.');
  }

  let statusData = {};

  try {
    statusData = await fetchNewApiStatus(normalizedBaseUrl, { fetchImpl });
  } catch {
    statusData = {};
  }

  const usageResponse = await fetchImpl(`${normalizedBaseUrl}/api/usage/token`, {
    headers: {
      Authorization: `Bearer ${targetKey}`
    }
  });
  const usagePayload = await parseResponsePayload(usageResponse);

  if (!usageResponse.ok) {
    const error = new Error(
      extractApiErrorMessage(usagePayload) || `NewAPI token usage request failed (${usageResponse.status}).`
    );
    error.status = usageResponse.status || 0;
    throw error;
  }

  if (usagePayload?.code !== true) {
    const error = new Error(extractApiErrorMessage(usagePayload) || 'NewAPI token usage lookup failed.');
    error.status = 400;
    throw error;
  }

  return buildNewApiTokenOverview(usagePayload, {
    apiKey: targetKey,
    quotaPerUnit: statusData.quota_per_unit,
    quotaDisplayType: statusData.quota_display_type
  });
}

module.exports = {
  DEFAULT_NEWAPI_DISPLAY_TYPE,
  DEFAULT_NEWAPI_QUOTA_PER_UNIT,
  buildNewApiTokenOverview,
  fetchNewApiStatus,
  fetchNewApiTokenOverview
};
