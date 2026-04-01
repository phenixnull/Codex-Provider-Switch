const TOML = require('@iarna/toml');

const OPENAI_API_KEY_PLACEHOLDER = 'sk-your-openai-api-key';

function parseTomlSafe(text) {
  if (!text || !text.trim()) {
    return {};
  }

  return TOML.parse(text);
}

function parseJsonSafe(text) {
  if (!text || !text.trim()) {
    return {};
  }

  return JSON.parse(text);
}

function detectActiveProviderId(configText) {
  const config = parseTomlSafe(configText);
  const modelProvider = config.model_provider;
  const providerMap = config.model_providers || {};
  const activeProvider = providerMap[modelProvider] || {};
  const baseUrl = String(activeProvider.base_url || '').toLowerCase();

  if (modelProvider === 'openai') {
    return 'openai';
  }

  if (modelProvider === 'gwen' || baseUrl.includes('love-gwen.top')) {
    return 'gwen';
  }

  if (baseUrl.includes('92scw.cn')) {
    return '92scw';
  }

  if (baseUrl.includes('gmn.chuangzuoli.com')) {
    return 'gmn';
  }

  return 'custom';
}

function mergePresetWithExistingConfig(presetConfigText, existingConfigText) {
  const presetConfig = parseTomlSafe(presetConfigText);
  const existingConfig = parseTomlSafe(existingConfigText);

  if (existingConfig.projects && !presetConfig.projects) {
    presetConfig.projects = existingConfig.projects;
  }

  return TOML.stringify(presetConfig);
}

function buildAuthJson(apiKey) {
  return `${JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2)}\n`;
}

function extractApiKey(authJsonText) {
  const auth = parseJsonSafe(authJsonText);
  return typeof auth.OPENAI_API_KEY === 'string' ? auth.OPENAI_API_KEY : '';
}

function hasUsableOpenAiApiKey(authJsonText) {
  const apiKey = String(extractApiKey(authJsonText) || '').trim();
  return !!apiKey && apiKey !== OPENAI_API_KEY_PLACEHOLDER;
}

function isChatGptAuth(authJsonText) {
  const auth = parseJsonSafe(authJsonText);
  return (
    String(auth?.auth_mode || '').trim().toLowerCase() === 'chatgpt' &&
    typeof auth?.tokens?.access_token === 'string' &&
    !!auth.tokens.access_token.trim()
  );
}

function resolveAuthJsonForSave({ configText, authJsonText, existingAuthJsonText }) {
  if (
    detectActiveProviderId(configText) === 'openai' &&
    isChatGptAuth(existingAuthJsonText) &&
    !isChatGptAuth(authJsonText) &&
    !hasUsableOpenAiApiKey(authJsonText)
  ) {
    return existingAuthJsonText;
  }

  return authJsonText;
}

function sanitizePresetAuthTextForStorage({ configText, authJsonText }) {
  let providerId = 'custom';

  try {
    providerId = detectActiveProviderId(configText);
  } catch {
    providerId = 'custom';
  }

  if (providerId === 'openai' && isChatGptAuth(authJsonText)) {
    return buildAuthJson(OPENAI_API_KEY_PLACEHOLDER);
  }

  return authJsonText;
}

function maskKey(apiKey) {
  if (!apiKey) {
    return '';
  }

  if (apiKey.length <= 11) {
    return apiKey;
  }

  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}

function summarizeCurrentState({ configText, authJsonText }) {
  const config = parseTomlSafe(configText);
  const apiKey = extractApiKey(authJsonText);

  return {
    providerId: detectActiveProviderId(configText),
    model: config.model || '',
    maskedKey: maskKey(apiKey)
  };
}

module.exports = {
  buildAuthJson,
  detectActiveProviderId,
  extractApiKey,
  hasUsableOpenAiApiKey,
  isChatGptAuth,
  maskKey,
  mergePresetWithExistingConfig,
  OPENAI_API_KEY_PLACEHOLDER,
  resolveAuthJsonForSave,
  sanitizePresetAuthTextForStorage,
  summarizeCurrentState
};
