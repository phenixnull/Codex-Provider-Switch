function parseJsonObjectSafe(text) {
  if (!text || !String(text).trim()) {
    return {};
  }

  const parsed = JSON.parse(text);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Claude config/state text must contain a JSON object.');
  }

  return parsed;
}

function formatJsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function extractClaudeEnv(settingsText) {
  const settings = parseJsonObjectSafe(settingsText);
  return settings.env && typeof settings.env === 'object' ? settings.env : {};
}

function resolveClaudeModel(env) {
  return (
    String(env.ANTHROPIC_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_OPUS_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_SONNET_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '').trim()
  );
}

function maskToken(token) {
  if (!token) {
    return '';
  }

  if (token.length <= 11) {
    return token;
  }

  return `${token.slice(0, 7)}...${token.slice(-4)}`;
}

function detectActiveClaudePresetId(settingsText) {
  const env = extractClaudeEnv(settingsText);
  const baseUrl = String(env.ANTHROPIC_BASE_URL || '').toLowerCase();
  const model = resolveClaudeModel(env);
  const opusModel = String(env.ANTHROPIC_DEFAULT_OPUS_MODEL || '').trim();
  const sonnetModel = String(env.ANTHROPIC_DEFAULT_SONNET_MODEL || '').trim();

  if (
    baseUrl.includes('open.bigmodel.cn/api/anthropic') &&
    opusModel === 'GLM-5.1' &&
    sonnetModel === 'GLM-5.1'
  ) {
    return 'claude-glm-5-1';
  }

  if (baseUrl.includes('openrouter.ai/api') && model === 'qwen/qwen3.6-plus:free') {
    return 'claude-openrouter-qwen3-6-plus-free';
  }

  return 'custom';
}

function buildClaudeStatePatchText(stateText, { defaultHasCompletedOnboarding = true } = {}) {
  const state = parseJsonObjectSafe(stateText);
  const hasCompletedOnboarding = Object.prototype.hasOwnProperty.call(
    state,
    'hasCompletedOnboarding'
  )
    ? !!state.hasCompletedOnboarding
    : defaultHasCompletedOnboarding;

  return formatJsonText({
    hasCompletedOnboarding
  });
}

function sanitizeClaudeStatePatchForStorage(stateText) {
  return buildClaudeStatePatchText(stateText);
}

function mergeClaudeStatePatch({ existingStateText, patchText }) {
  const existingState = parseJsonObjectSafe(existingStateText);
  const patch = parseJsonObjectSafe(patchText);

  return formatJsonText({
    ...existingState,
    ...patch
  });
}

function summarizeClaudeState({ settingsText }) {
  const env = extractClaudeEnv(settingsText);

  return {
    providerId: detectActiveClaudePresetId(settingsText),
    model: resolveClaudeModel(env),
    maskedKey: maskToken(String(env.OPENROUTER_API_KEY || env.ANTHROPIC_AUTH_TOKEN || '').trim())
  };
}

module.exports = {
  buildClaudeStatePatchText,
  detectActiveClaudePresetId,
  formatJsonText,
  mergeClaudeStatePatch,
  parseJsonObjectSafe,
  sanitizeClaudeStatePatchForStorage,
  summarizeClaudeState
};
