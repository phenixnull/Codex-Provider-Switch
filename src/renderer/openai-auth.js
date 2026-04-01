(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.openAiAuth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const OPENAI_API_KEY_PLACEHOLDER = 'sk-your-openai-api-key';

  function parseAuthJsonSafe(text) {
    if (!text || !String(text).trim()) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  function extractApiKey(authText) {
    const auth = parseAuthJsonSafe(authText);
    return typeof auth.OPENAI_API_KEY === 'string' ? auth.OPENAI_API_KEY : '';
  }

  function hasUsableOpenAiApiKey(authText) {
    const apiKey = String(extractApiKey(authText) || '').trim();
    return !!apiKey && apiKey !== OPENAI_API_KEY_PLACEHOLDER;
  }

  function isChatGptAuthText(authText) {
    const auth = parseAuthJsonSafe(authText);
    return (
      String(auth?.auth_mode || '').trim().toLowerCase() === 'chatgpt' &&
      typeof auth?.tokens?.access_token === 'string' &&
      !!auth.tokens.access_token.trim()
    );
  }

  function resolveEditorAuthText(presetId, presetAuthText, liveAuthText) {
    if (
      presetId === 'openai' &&
      isChatGptAuthText(liveAuthText) &&
      !isChatGptAuthText(presetAuthText) &&
      !hasUsableOpenAiApiKey(presetAuthText)
    ) {
      return liveAuthText;
    }

    return presetAuthText;
  }

  return {
    hasUsableOpenAiApiKey,
    isChatGptAuthText,
    OPENAI_API_KEY_PLACEHOLDER,
    resolveEditorAuthText
  };
});
