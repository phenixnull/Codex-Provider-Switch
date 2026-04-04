const fs = require('node:fs/promises');
const os = require('node:os');

const { parseJsonObjectSafe } = require('../shared/claude-config-service');
const { getClaudePaths } = require('./claude-files');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api';
const OPENROUTER_KEY_ENDPOINT = 'https://openrouter.ai/api/v1/key';
const OPENROUTER_CREDITS_ENDPOINT = 'https://openrouter.ai/api/v1/credits';
const OPENROUTER_LOW_CREDIT_DAILY_LIMIT = 50;
const OPENROUTER_HIGH_CREDIT_DAILY_LIMIT = 1000;
const OPENROUTER_HIGH_CREDIT_THRESHOLD = 10;

function normalizeFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function maskKey(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= 11) {
    return normalized;
  }

  return `${normalized.slice(0, 7)}...${normalized.slice(-4)}`;
}

function formatLocalDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractOpenRouterClaudeConfig(configText) {
  const settings = parseJsonObjectSafe(configText);
  const env = settings?.env && typeof settings.env === 'object' ? settings.env : {};
  const baseUrl = String(env.ANTHROPIC_BASE_URL || '').trim();
  const model =
    String(env.ANTHROPIC_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_OPUS_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_SONNET_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '').trim();
  const apiKey =
    String(env.OPENROUTER_API_KEY || '').trim() || String(env.ANTHROPIC_AUTH_TOKEN || '').trim();

  return {
    baseUrl,
    model,
    apiKey,
    maskedKey: maskKey(apiKey)
  };
}

function isOpenRouterFreeClaudeConfig(configText) {
  const config = extractOpenRouterClaudeConfig(configText);
  return (
    config.baseUrl.toLowerCase().includes('openrouter.ai/api') && config.model.toLowerCase().endsWith(':free')
  );
}

function isOpenRouterFreeClaudePreset(preset) {
  return !!preset?.configText && isOpenRouterFreeClaudeConfig(preset.configText);
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

async function parseResponsePayload(response) {
  const text = typeof response?.text === 'function' ? await response.text() : '';

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractApiErrorMessage(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  return '';
}

async function requestOpenRouterJson(fetchImpl, url, apiKey) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });
  const payload = await parseResponsePayload(response);

  if (!response?.ok) {
    const error = new Error(
      extractApiErrorMessage(payload) || `OpenRouter request failed (${response?.status || 0}).`
    );
    error.status = response?.status || 0;
    throw error;
  }

  return payload;
}

function normalizeOpenRouterKeyPayload(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};

  return {
    label: String(data.label || '').trim(),
    usage: normalizeFiniteNumber(data.usage),
    usageDaily: normalizeFiniteNumber(data.usage_daily),
    usageWeekly: normalizeFiniteNumber(data.usage_weekly),
    usageMonthly: normalizeFiniteNumber(data.usage_monthly),
    limitRemaining: normalizeFiniteNumber(data.limit_remaining),
    isFreeTier: data.is_free_tier === true,
    limit: normalizeFiniteNumber(data.limit),
    limitReset: data.limit_reset || null,
    rateLimit: data.rate_limit && typeof data.rate_limit === 'object' ? data.rate_limit : null
  };
}

function normalizeOpenRouterCreditsPayload(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};

  return {
    totalCredits: normalizeFiniteNumber(data.total_credits),
    totalUsage: normalizeFiniteNumber(data.total_usage)
  };
}

function parseStatsCacheText(text) {
  if (!text || !String(text).trim()) {
    return {
      version: 0,
      lastComputedDate: '',
      dailyActivity: [],
      dailyModelTokens: []
    };
  }

  const parsed = JSON.parse(text);

  return {
    version: Number(parsed?.version) || 0,
    lastComputedDate: String(parsed?.lastComputedDate || '').trim(),
    dailyActivity: Array.isArray(parsed?.dailyActivity) ? parsed.dailyActivity : [],
    dailyModelTokens: Array.isArray(parsed?.dailyModelTokens) ? parsed.dailyModelTokens : []
  };
}

function getTodayActivity(statsCache, now = new Date()) {
  const dateKey = formatLocalDateKey(now);
  const matched = Array.isArray(statsCache?.dailyActivity)
    ? statsCache.dailyActivity.find((item) => String(item?.date || '').trim() === dateKey)
    : null;

  return {
    date: dateKey,
    messageCount: Number(matched?.messageCount) || 0,
    sessionCount: Number(matched?.sessionCount) || 0,
    toolCallCount: Number(matched?.toolCallCount) || 0
  };
}

function getTodayModelTokens(statsCache, model, now = new Date()) {
  const dateKey = formatLocalDateKey(now);
  const matched = Array.isArray(statsCache?.dailyModelTokens)
    ? statsCache.dailyModelTokens.find((item) => String(item?.date || '').trim() === dateKey)
    : null;
  const tokensByModel =
    matched?.tokensByModel && typeof matched.tokensByModel === 'object' ? matched.tokensByModel : {};

  return Number(tokensByModel[model]) || 0;
}

function resolveOpenRouterDailyLimit(totalCredits) {
  const numericCredits = normalizeFiniteNumber(totalCredits);

  if (numericCredits === null) {
    return OPENROUTER_LOW_CREDIT_DAILY_LIMIT;
  }

  return numericCredits >= OPENROUTER_HIGH_CREDIT_THRESHOLD
    ? OPENROUTER_HIGH_CREDIT_DAILY_LIMIT
    : OPENROUTER_LOW_CREDIT_DAILY_LIMIT;
}

function buildOpenRouterFreeUsageOverview({
  configText,
  statsCacheText,
  keyPayload,
  creditsPayload,
  now = new Date()
}) {
  const config = extractOpenRouterClaudeConfig(configText);
  const keyInfo = normalizeOpenRouterKeyPayload(keyPayload);
  const creditsInfo = normalizeOpenRouterCreditsPayload(creditsPayload);
  const statsCache = parseStatsCacheText(statsCacheText);
  const todayActivity = getTodayActivity(statsCache, now);
  const todayModelTokens = getTodayModelTokens(statsCache, config.model, now);
  const dailyLimit = resolveOpenRouterDailyLimit(creditsInfo.totalCredits);
  const estimatedUsedCount = Math.max(0, todayActivity.messageCount);
  const estimatedRemainingCount = Math.max(0, dailyLimit - estimatedUsedCount);
  const progressPercent = dailyLimit > 0 ? round((estimatedRemainingCount / dailyLimit) * 100) : 0;

  return {
    usageKind: 'openrouter_free_daily_estimate',
    status: 'estimate',
    model: config.model,
    maskedKey: config.maskedKey || keyInfo.label || '',
    dailyLimit,
    estimatedUsedCount,
    estimatedRemainingCount,
    progressPercent,
    totalCredits: creditsInfo.totalCredits,
    totalUsage: creditsInfo.totalUsage,
    localActivity: todayActivity,
    todayModelTokens,
    statsCacheDate: statsCache.lastComputedDate || todayActivity.date,
    keyInfo
  };
}

async function fetchOpenRouterFreeUsageOverviewFromPreset(
  preset,
  {
    homeDir = os.homedir(),
    fetchImpl = fetch,
    now = new Date()
  } = {}
) {
  if (!isOpenRouterFreeClaudePreset(preset)) {
    throw new Error('Preset is not an OpenRouter free Claude preset.');
  }

  const config = extractOpenRouterClaudeConfig(preset.configText);

  if (!config.apiKey) {
    throw new Error('OpenRouter API key is required for usage lookup.');
  }

  const paths = getClaudePaths(homeDir);
  const statsCacheText = await readTextIfExists(paths.statsCachePath);
  const [keyPayload, creditsPayload] = await Promise.all([
    requestOpenRouterJson(fetchImpl, OPENROUTER_KEY_ENDPOINT, config.apiKey),
    requestOpenRouterJson(fetchImpl, OPENROUTER_CREDITS_ENDPOINT, config.apiKey)
  ]);

  return buildOpenRouterFreeUsageOverview({
    configText: preset.configText,
    statsCacheText,
    keyPayload,
    creditsPayload,
    now
  });
}

module.exports = {
  OPENROUTER_BASE_URL,
  OPENROUTER_CREDITS_ENDPOINT,
  OPENROUTER_HIGH_CREDIT_DAILY_LIMIT,
  OPENROUTER_HIGH_CREDIT_THRESHOLD,
  OPENROUTER_KEY_ENDPOINT,
  OPENROUTER_LOW_CREDIT_DAILY_LIMIT,
  buildOpenRouterFreeUsageOverview,
  extractOpenRouterClaudeConfig,
  fetchOpenRouterFreeUsageOverviewFromPreset,
  formatLocalDateKey,
  getTodayActivity,
  getTodayModelTokens,
  isOpenRouterFreeClaudeConfig,
  isOpenRouterFreeClaudePreset,
  normalizeOpenRouterCreditsPayload,
  normalizeOpenRouterKeyPayload,
  parseStatsCacheText,
  resolveOpenRouterDailyLimit
};
