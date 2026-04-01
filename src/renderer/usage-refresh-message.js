(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.usageRefreshMessage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const USAGE_PROVIDER_LABELS = {
    '92scw': '92scw',
    gmn: 'GMN',
    gwen: 'GWEN',
    openai: 'Official'
  };

  function getUsageProviderLabel(providerId) {
    return USAGE_PROVIDER_LABELS[providerId] || String(providerId || '').toUpperCase();
  }

  function buildUsageRefreshResultMessage(providerId, usageSnapshot) {
    const providerLabel = getUsageProviderLabel(providerId);

    if (providerId === 'openai' && !usageSnapshot?.keyOverview) {
      return {
        text: '未登录，无法读取 Official 限额。',
        tone: 'neutral'
      };
    }

    return {
      text: `${providerLabel} quota refreshed.`,
      tone: 'success'
    };
  }

  return {
    USAGE_PROVIDER_LABELS,
    buildUsageRefreshResultMessage,
    getUsageProviderLabel
  };
});
