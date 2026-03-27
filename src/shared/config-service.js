const TOML = require('@iarna/toml');

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
  const auth = parseJsonSafe(authJsonText);

  return {
    providerId: detectActiveProviderId(configText),
    model: config.model || '',
    maskedKey: maskKey(auth.OPENAI_API_KEY || '')
  };
}

module.exports = {
  buildAuthJson,
  detectActiveProviderId,
  maskKey,
  mergePresetWithExistingConfig,
  summarizeCurrentState
};
