const NEW_PRESET_ID = '__new__';
const DEFAULT_PRODUCT_ID = 'codex';
const USAGE_PROVIDER_IDS = ['92scw', 'gmn', 'gwen', 'openai', 'quan2go'];
const usageRefreshMessage = globalThis.usageRefreshMessage || {};
const openAiAuth = globalThis.openAiAuth || {};

const PRODUCT_UI = {
  codex: {
    id: 'codex',
    name: 'Codex',
    sidebarEyebrow: 'Codex Provider Switch',
    sidebarTitle: '供应商切换器',
    sidebarSubtle:
      '选择左侧预设后，直接编辑并保存 `.codex` 的配置文件，再决定是否立即启用到 Codex。',
    openDirLabel: '打开 .codex 目录',
    applyLabel: '启用到 Codex',
    testButtonLabel: '在线测试',
    configFileLabel: 'config.toml',
    authFileLabel: 'auth.json',
    configEditorTitle: '配置文件',
    authEditorTitle: '鉴权文件',
    configEditorTip: '直接编辑当前预设对应的 `config.toml` 内容。',
    authEditorTip: '先保存预设，再按需启用到 Codex。',
    draftDescription: 'Custom Codex preset.',
    addPresetDescription: '清空编辑器并创建新的 Codex 自定义预设。',
    supportsProviderTest: true,
    supportsUsageCards: true
  },
  claude: {
    id: 'claude',
    name: 'Claude Code',
    sidebarEyebrow: 'Claude Code Switch',
    sidebarTitle: 'Claude 预设切换',
    sidebarSubtle:
      '按官方文件边界编辑 `~/.claude/settings.json`，并以 `.claude.json patch` 方式保留 onboarding，不覆盖本地项目状态。',
    usageButtonLabel: '查看额度',
    openDirLabel: '打开 .claude 目录',
    applyLabel: '启用到 Claude',
    testButtonLabel: '在线测试（仅 Codex）',
    configFileLabel: 'settings.json',
    authFileLabel: '.claude.json patch',
    configEditorTitle: '设置文件',
    authEditorTitle: '状态补丁',
    configEditorTip: '直接编辑 `~/.claude/settings.json`。',
    authEditorTip: '这里只保存并应用 `.claude.json` 的安全补丁，目前仅保留 onboarding 状态。',
    draftDescription: 'Custom Claude preset.',
    addPresetDescription: '清空编辑器并创建新的 Claude 自定义预设。',
    supportsProviderTest: false,
    supportsUsageCards: false,
    supportsUsageStats: true
  }
};

const fallbackUsageModelBuilder = (_keyOverview, fallbackMaskedKey = '') => ({
  keyText: fallbackMaskedKey || 'Unavailable',
  remainingText: '-',
  totalText: '-',
  progressLabelText: 'Quota Left',
  progressPercent: 0,
  progressText: '-',
  progressDetailText: '-',
  progressGradient: 'linear-gradient(90deg, #ff7b61 0%, #f6ca57 100%)',
  progressItems: [
    {
      labelText: 'Quota Left',
      percent: 0,
      text: '-',
      detailText: '-',
      gradient: 'linear-gradient(90deg, #ff7b61 0%, #f6ca57 100%)'
    }
  ],
  statusText: 'SYNCING'
});

const gmnDisplay = globalThis.gmnDisplay || {
  buildUsagePresetCardModel: fallbackUsageModelBuilder,
  buildGmnPresetCardModel: fallbackUsageModelBuilder
};

function createInitialProviderBusy() {
  return {
    '92scw': false,
    gmn: false,
    gwen: false,
    openai: false,
    quan2go: false
  };
}

function createInitialProviderUsageState() {
  return {
    '92scw': null,
    gmn: null,
    gwen: null,
    openai: null,
    quan2go: null
  };
}

function createInitialBigModelAuthSummary() {
  return {
    username: '',
    hasPassword: false,
    maskedApiKey: '',
    organizationId: '',
    projectId: ''
  };
}

function createInitialClaudePresetUsageState() {
  return {};
}

function createInitialClaudePresetBusyState() {
  return {};
}

const state = {
  currentProductId: DEFAULT_PRODUCT_ID,
  draftPreset: null,
  live: null,
  presets: [],
  presetOrder: [],
  selectedPresetId: null,
  editorsDirty: false,
  lastTestResult: null,
  providerBusy: createInitialProviderBusy(),
  providerUsage: createInitialProviderUsageState(),
  bigmodelAuth: createInitialBigModelAuthSummary(),
  bigmodelConsole: null,
  bigmodelConsoleBusy: false,
  claudePresetUsage: createInitialClaudePresetUsageState(),
  claudePresetBusy: createInitialClaudePresetBusyState()
};

const elements = {};
let dragSrcId = null;

function qs(selector) {
  return document.querySelector(selector);
}

function getCurrentProduct() {
  return PRODUCT_UI[state.currentProductId] || PRODUCT_UI[DEFAULT_PRODUCT_ID];
}

function supportsProviderTest() {
  return !!getCurrentProduct().supportsProviderTest;
}

function supportsUsageCards() {
  return !!getCurrentProduct().supportsUsageCards;
}

function supportsUsageStats() {
  return !!getCurrentProduct().supportsUsageStats;
}

function supportsClaudeConsole() {
  return state.currentProductId === 'claude';
}

function resolveClaudePresetModelId(configText) {
  const env = extractClaudeEnv(configText);
  return (
    String(env.ANTHROPIC_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_OPUS_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_SONNET_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '').trim()
  );
}

function resolveLivePresetId() {
  const summaryProviderId = String(state.live?.summary?.providerId || '').trim();

  if (summaryProviderId && state.presets.some((preset) => preset.id === summaryProviderId)) {
    return summaryProviderId;
  }

  if (!supportsClaudeConsole() || !state.live?.configText) {
    return summaryProviderId;
  }

  const liveBaseUrl = String(extractClaudeEnv(state.live.configText).ANTHROPIC_BASE_URL || '')
    .trim()
    .toLowerCase();
  const liveModelId = resolveClaudePresetModelId(state.live.configText).toLowerCase();

  if (!liveBaseUrl && !liveModelId) {
    return summaryProviderId;
  }

  const matchedPreset = state.presets.find((preset) => {
    const env = extractClaudeEnv(preset?.configText || '');
    const presetBaseUrl = String(env.ANTHROPIC_BASE_URL || '')
      .trim()
      .toLowerCase();
    const presetModelId = resolveClaudePresetModelId(preset?.configText || '').toLowerCase();

    return presetBaseUrl === liveBaseUrl && presetModelId === liveModelId;
  });

  return matchedPreset?.id || summaryProviderId;
}

function formatBigModelContext(value) {
  const organizationId = String(value?.organizationId || '').trim();
  const projectId = String(value?.projectId || '').trim();

  if (!organizationId && !projectId) {
    return '-';
  }

  if (!organizationId) {
    return `Project ${projectId}`;
  }

  if (!projectId) {
    return `Org ${organizationId}`;
  }

  return `${organizationId} / ${projectId}`;
}

const BIGMODEL_QUOTA_CARD_ITEMS = [
  {
    key: 'TOKENS_LIMIT:3',
    title: '每5小时使用额度',
    emptyText: '等待同步',
    emptyDetailText: '',
    gradient: ''
  },
  {
    key: 'TIME_LIMIT:5',
    title: 'MCP 每月额度',
    emptyText: '等待同步',
    emptyDetailText: '官方 MCP 月额度还没同步回来。',
    gradient: ''
  }
];

function clampPercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue * 100) / 100));
}

function buildBigModelProgressGradient(progressPercent) {
  const percent = clampPercent(progressPercent);
  const baseHue = Math.round((percent / 100) * 120);
  const startHue = Math.max(0, Math.min(120, baseHue - 18));
  const endHue = Math.max(12, Math.min(132, baseHue + 10));

  return `linear-gradient(90deg, hsl(${startHue} 84% 56%) 0%, hsl(${endHue} 80% 64%) 100%)`;
}

function formatMetricNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 2
  }).format(numericValue);
}

function formatBigModelDateTime(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function compactBigModelIdentifier(value, keepStart = 8, keepEnd = 4) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= keepStart + keepEnd + 3) {
    return normalized;
  }

  return `${normalized.slice(0, keepStart)}...${normalized.slice(-keepEnd)}`;
}

function formatBigModelCardContext(value) {
  const organizationId = compactBigModelIdentifier(value?.organizationId, 8, 4);
  const projectId = compactBigModelIdentifier(value?.projectId, 9, 4);

  if (!organizationId && !projectId) {
    return '';
  }

  if (!organizationId) {
    return projectId;
  }

  if (!projectId) {
    return organizationId;
  }

  return `${organizationId} / ${projectId}`;
}

function getBigModelQuotaLimits(snapshot) {
  return Array.isArray(snapshot?.usage?.quotaLimit?.limits) ? snapshot.usage.quotaLimit.limits : [];
}

function getBigModelQuotaItemMap(snapshot) {
  return new Map(
    getBigModelQuotaLimits(snapshot)
      .filter((item) => item && typeof item === 'object')
      .map((item) => [String(item.key || ''), item])
      .filter(([key]) => key)
  );
}

function buildBigModelQuotaDetailText(limit, fallbackItem) {
  const detailParts = [];
  const currentValue = Number(limit?.currentValue);
  const usage = Number(limit?.usage);
  const remaining = Number(limit?.remaining);
  const usageDetails = Array.isArray(limit?.usageDetails) ? limit.usageDetails : [];

  if (Number.isFinite(currentValue) || Number.isFinite(usage)) {
    detailParts.push(
      `已用 ${Number.isFinite(currentValue) ? formatMetricNumber(currentValue) : '-'} / ${
        Number.isFinite(usage) ? formatMetricNumber(usage) : '-'
      } ${limit?.unitText || ''}`.trim()
    );
  }

  if (Number.isFinite(remaining)) {
    detailParts.push(`剩余 ${formatMetricNumber(remaining)} ${limit?.unitText || ''}`.trim());
  }

  if (usageDetails.length > 0) {
    detailParts.push(
      usageDetails
        .map((item) => `${item?.name || item?.modelCode || '-'} ${formatMetricNumber(item?.usage)}${limit?.unitText || ''}`)
        .join(' · ')
    );
  }

  if (detailParts.length === 0 && limit?.type === 'TOKENS_LIMIT') {
    return fallbackItem.emptyDetailText;
  }

  return detailParts.join(' | ') || fallbackItem.emptyDetailText;
}

function buildBigModelQuotaProgressItems(snapshot) {
  const quotaItemMap = getBigModelQuotaItemMap(snapshot);

  return BIGMODEL_QUOTA_CARD_ITEMS.map((fallbackItem) => {
    const quotaItem = quotaItemMap.get(fallbackItem.key);

    if (!quotaItem) {
      return {
        key: fallbackItem.key,
        labelText: fallbackItem.title,
        percent: 0,
        usedPercent: 0,
        text: fallbackItem.emptyText,
        detailText: fallbackItem.emptyDetailText,
        gradient: buildBigModelProgressGradient(0),
        hasData: false
      };
    }

    const usedPercent = clampPercent(quotaItem.percentage);
    const percent = clampPercent(100 - usedPercent);
    const showDetailText = fallbackItem.key !== 'TOKENS_LIMIT:3';

    return {
      key: fallbackItem.key,
      labelText: quotaItem.title || fallbackItem.title,
      percent,
      usedPercent,
      text: `${formatMetricNumber(percent)}% 剩余`,
      detailText: showDetailText ? buildBigModelQuotaDetailText(quotaItem, fallbackItem) : '',
      gradient: buildBigModelProgressGradient(percent),
      hasData: true
    };
  });
}

function buildBigModelUsageSummary(snapshot) {
  if (!snapshot || getBigModelQuotaLimits(snapshot).length === 0) {
    return '-';
  }

  const quotaSummary = buildBigModelQuotaProgressItems(snapshot)
    .filter((item) => item.hasData)
    .map((item) => `${item.labelText} ${item.text}`);
  const refreshedAt = formatBigModelDateTime(snapshot?.usage?.refreshedAt);

  if (refreshedAt) {
    quotaSummary.push(`最近更新时间 ${refreshedAt}`);
  }

  return quotaSummary.join(' | ') || '已抓取官方额度接口';
}

function buildBigModelProgressModel(snapshot) {
  if (!snapshot) {
    return {
      mainText: '-',
      sideText: '等待查询',
      footText: '切到 Claude 后会自动尝试同步一次。',
      percent: 0
    };
  }

  const quotaItems = buildBigModelQuotaProgressItems(snapshot).filter((item) => item.hasData);
  const primaryItem =
    quotaItems.find((item) => item.key === 'TIME_LIMIT:5') ||
    quotaItems.find((item) => item.key === 'TOKENS_LIMIT:3') ||
    null;

  if (primaryItem) {
    return {
      mainText: `${formatMetricNumber(primaryItem.percent)}%`,
      sideText: primaryItem.labelText,
      footText: primaryItem.detailText,
      percent: primaryItem.percent
    };
  }

  return {
    mainText: '-',
    sideText: '等待官方额度接口',
    footText: '当前尚未拿到官方配额数据。',
    percent: 0
  };
}

function buildBigModelOutputText(snapshot) {
  if (!snapshot) {
    return '';
  }

  return JSON.stringify(snapshot, null, 2);
}

function getBigModelFormPayload() {
  return {
    username: elements.bigmodelUsernameInput.value.trim(),
    password: elements.bigmodelPasswordInput.value.trim(),
    apiKey: elements.bigmodelApiKeyInput.value.trim(),
    organizationId: elements.bigmodelOrganizationInput.value.trim(),
    projectId: elements.bigmodelProjectInput.value.trim()
  };
}

function hasPendingBigModelAuthChanges() {
  const payload = getBigModelFormPayload();

  if (payload.password || payload.apiKey) {
    return true;
  }

  return (
    payload.username !== String(state.bigmodelAuth?.username || '').trim() ||
    payload.organizationId !== String(state.bigmodelAuth?.organizationId || '').trim() ||
    payload.projectId !== String(state.bigmodelAuth?.projectId || '').trim()
  );
}

function applyPlatformTheme() {
  const platform = window.codexApp?.platform || 'unknown';
  document.documentElement.dataset.platform = platform;
  document.body.dataset.platform = platform;
  document.body.classList.add(`platform-${platform}`);
}

function buildRendererError(result) {
  const error = new Error(result?.error?.message || 'Unknown IPC error');
  Object.assign(error, result?.error || {});
  return error;
}

function unwrapIpcResult(result) {
  if (!result?.ok) {
    throw buildRendererError(result);
  }

  return result.data;
}

function setMessage(text, tone = 'neutral') {
  elements.messageText.textContent = text;
  elements.messageText.dataset.tone = tone;
}

function renderTestResult(result, tone = 'neutral') {
  const toolbarTest = qs('.toolbar-test');

  if (!supportsProviderTest()) {
    elements.testStatus.textContent = '不适用';
    elements.testStatus.dataset.tone = 'neutral';
    elements.testEndpoint.textContent = '-';
    elements.testModel.textContent = '-';
    elements.testResponseId.textContent = '-';
    elements.testOutput.textContent = '';
    elements.testOutput.hidden = true;

    if (toolbarTest) {
      toolbarTest.classList.remove('is-loading');
    }

    return;
  }

  const hasResult = !!result;
  let statusText = '未测试';

  if (hasResult) {
    if (tone === 'error') {
      statusText = '失败';
    } else if (tone === 'loading') {
      statusText = '测试中...';
    } else {
      statusText = '通过';
    }
  }

  elements.testStatus.textContent = statusText;
  elements.testStatus.dataset.tone = tone;
  elements.testEndpoint.textContent = hasResult ? result.endpoint || '-' : '-';
  elements.testModel.textContent = hasResult ? result.model || '-' : '-';
  elements.testResponseId.textContent = hasResult ? result.responseId || '-' : '-';
  elements.testOutput.textContent = hasResult
    ? result.outputText || 'Request succeeded, but no text output was returned.'
    : '';
  elements.testOutput.hidden = !hasResult;

  if (toolbarTest) {
    toolbarTest.classList.toggle('is-loading', tone === 'loading');
  }
}

function renderProductChrome() {
  const product = getCurrentProduct();
  const toolbarTest = qs('.toolbar-test');
  const productButtons = [elements.productCodexBtn, elements.productClaudeBtn].filter(Boolean);

  document.title = `${product.name} Switch`;
  elements.sidebarEyebrow.textContent = product.sidebarEyebrow;
  elements.sidebarTitle.textContent = product.sidebarTitle;
  elements.sidebarSubtle.textContent = product.sidebarSubtle;
  elements.openDirBtn.textContent = product.openDirLabel;
  elements.usageBtn.textContent = product.usageButtonLabel || '查看额度';
  elements.applyBtn.textContent = product.applyLabel;
  elements.testBtn.textContent = product.testButtonLabel;
  elements.testBtn.disabled = !supportsProviderTest();
  elements.usageBtn.hidden = !supportsUsageStats();
  elements.configFileLabel.textContent = product.configFileLabel;
  elements.authFileLabel.textContent = product.authFileLabel;
  elements.configEditorLabel.textContent = product.configFileLabel;
  elements.authEditorLabel.textContent = product.authFileLabel;
  elements.configEditorTitle.textContent = product.configEditorTitle;
  elements.authEditorTitle.textContent = product.authEditorTitle;
  elements.configEditorTip.textContent = product.configEditorTip;
  elements.authEditorTip.textContent = product.authEditorTip;
  document.body.dataset.product = product.id;

  productButtons.forEach((button) => {
    const isActive = button.dataset.productId === product.id;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (toolbarTest) {
    toolbarTest.classList.toggle('is-hidden', !supportsProviderTest());
    toolbarTest.classList.remove('is-loading');
  }

  if (elements.claudeConsolePanel) {
    elements.claudeConsolePanel.hidden = true;
  }
}

function renderBigModelPanel() {
  if (!elements.claudeConsolePanel) {
    return;
  }

  const auth = state.bigmodelAuth || createInitialBigModelAuthSummary();
  const snapshot = state.bigmodelConsole;
  const hasErrors = !!snapshot && Object.keys(snapshot.errors || {}).length > 0;
  const progressModel = buildBigModelProgressModel(snapshot);
  const keysText = snapshot
    ? `${snapshot.apiKeys?.count || 0}${snapshot.apiKeys?.matchedKeyName ? ` | ${snapshot.apiKeys.matchedKeyName}` : ''}`
    : '-';

  elements.bigmodelUsernameInput.value = auth.username || '';
  elements.bigmodelOrganizationInput.value = auth.organizationId || '';
  elements.bigmodelProjectInput.value = auth.projectId || '';
  elements.bigmodelPasswordInput.placeholder = auth.hasPassword
    ? '留空则保留当前已保存密码'
    : '输入 BigModel 控制台密码';
  elements.bigmodelApiKeyInput.placeholder = auth.maskedApiKey
    ? `留空则保留 ${auth.maskedApiKey}`
    : '可选，当前 Claude 用的 API Key';
  elements.bigmodelSavedAccount.textContent = auth.username || '-';
  elements.bigmodelPasswordState.textContent = auth.hasPassword ? '已保存' : '未保存';
  elements.bigmodelSavedKey.textContent = auth.maskedApiKey || '-';
  elements.bigmodelSavedContext.textContent = formatBigModelContext(auth);
  elements.bigmodelFetchStatus.textContent = state.bigmodelConsoleBusy
    ? '抓取中...'
    : snapshot
      ? hasErrors
        ? '部分成功'
        : '已同步'
      : '未抓取';
  elements.bigmodelFetchStatus.dataset.tone = state.bigmodelConsoleBusy
    ? 'loading'
    : hasErrors
      ? 'error'
      : snapshot
        ? 'success'
        : 'neutral';
  elements.bigmodelFetchContext.textContent = snapshot ? formatBigModelContext(snapshot.context) : '-';
  elements.bigmodelFetchKeys.textContent = keysText;
  elements.bigmodelFetchUsage.textContent = buildBigModelUsageSummary(snapshot);
  elements.bigmodelBalanceMain.textContent = progressModel.mainText;
  elements.bigmodelBalanceSide.textContent = progressModel.sideText;
  elements.bigmodelBalanceFoot.textContent = progressModel.footText;
  elements.bigmodelBalanceFill.style.width = `${Number(progressModel.percent) || 0}%`;
  elements.bigmodelConsoleOutput.textContent = snapshot ? buildBigModelOutputText(snapshot) : '';
  elements.bigmodelConsoleOutput.hidden = !snapshot;
  elements.bigmodelSaveBtn.disabled = !supportsClaudeConsole() || state.bigmodelConsoleBusy;
  elements.bigmodelFetchBtn.disabled = !supportsClaudeConsole() || state.bigmodelConsoleBusy;
}

function getPresetById(presetId) {
  if (presetId === NEW_PRESET_ID) {
    return state.draftPreset;
  }

  return state.presets.find((item) => item.id === presetId) || null;
}

function getPresetLabel(providerId) {
  const preset = state.presets.find((item) => item.id === providerId);
  return preset ? preset.name : providerId || 'Custom / Unknown';
}

function hasUnsavedChanges() {
  return state.editorsDirty;
}

function canDiscardChanges() {
  if (!hasUnsavedChanges()) {
    return true;
  }

  return window.confirm('当前编辑内容尚未保存。确认丢弃并继续吗？');
}

function setTargetFields(preset) {
  elements.presetNameInput.value = preset?.name || '';
  elements.presetDescriptionInput.value = preset?.description || '';
}

function parseJsonObjectSafe(text) {
  if (!text || !String(text).trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function parseAuthJsonSafe(text) {
  return parseJsonObjectSafe(text);
}

function extractApiKeyFromAuthText(authText) {
  const auth = parseAuthJsonSafe(authText);
  return typeof auth.OPENAI_API_KEY === 'string' ? auth.OPENAI_API_KEY : '';
}

function extractClaudeEnv(configText) {
  const config = parseJsonObjectSafe(configText);
  return config?.env && typeof config.env === 'object' ? config.env : {};
}

function extractClaudePresetMaskedKey(preset) {
  const env = extractClaudeEnv(preset?.configText || '');
  const directKey =
    typeof env.ANTHROPIC_AUTH_TOKEN === 'string'
      ? env.ANTHROPIC_AUTH_TOKEN
      : typeof env.OPENROUTER_API_KEY === 'string'
        ? env.OPENROUTER_API_KEY
        : '';
  const maskedKey = maskApiKey(directKey);

  if (maskedKey) {
    return maskedKey;
  }

  if (state.live?.summary?.providerId === preset?.id) {
    return state.live?.summary?.maskedKey || '';
  }

  return '';
}

function isOpenRouterClaudeUsagePreset(preset) {
  if (!supportsClaudeConsole() || !preset?.configText) {
    return false;
  }

  const env = extractClaudeEnv(preset.configText);
  const baseUrl = String(env.ANTHROPIC_BASE_URL || '').trim().toLowerCase();
  const model =
    String(env.ANTHROPIC_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_OPUS_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_SONNET_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '').trim();

  return baseUrl.includes('openrouter.ai/api') && model.toLowerCase().endsWith(':free');
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return '';
  }

  if (apiKey.length <= 11) {
    return apiKey;
  }

  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}

function isUsageProviderId(providerId) {
  return supportsUsageCards() && USAGE_PROVIDER_IDS.includes(providerId);
}

function resolveUsageProviderLabel(providerId) {
  if (typeof usageRefreshMessage.getUsageProviderLabel === 'function') {
    return usageRefreshMessage.getUsageProviderLabel(providerId);
  }

  return String(providerId || '').toUpperCase();
}

function getUsageSnapshot(providerId) {
  return state.providerUsage[providerId] || null;
}

function getUsageKeyOverview(providerId) {
  return getUsageSnapshot(providerId)?.keyOverview || null;
}

function getClaudePresetUsageSnapshot(presetId) {
  return state.claudePresetUsage[presetId] || null;
}

function getClaudePresetKeyOverview(presetId) {
  return getClaudePresetUsageSnapshot(presetId)?.keyOverview || null;
}

function isProviderBusy(providerId) {
  return !!state.providerBusy[providerId];
}

function isClaudePresetBusy(presetId) {
  return !!state.claudePresetBusy[presetId];
}

function getPresetMaskedKey(preset) {
  const maskedPresetKey = maskApiKey(extractApiKeyFromAuthText(preset?.authText || ''));

  if (maskedPresetKey) {
    return maskedPresetKey;
  }

  if (resolveLivePresetId() === preset?.id) {
    return state.live?.summary?.maskedKey || '';
  }

  return '';
}

function buildUsagePresetCardMarkup(preset) {
  const providerId = preset.id;
  const keyOverview = getUsageKeyOverview(providerId);
  const fallbackMaskedKey = getPresetMaskedKey(preset);
  const usageModel =
    typeof gmnDisplay.buildUsagePresetCardModel === 'function'
      ? gmnDisplay.buildUsagePresetCardModel(keyOverview, fallbackMaskedKey, { providerId })
      : gmnDisplay.buildGmnPresetCardModel(keyOverview, fallbackMaskedKey);
  const busy = isProviderBusy(providerId);
  const statusText = busy ? 'SYNCING' : usageModel.statusText;
  const statusTone = busy ? 'neutral' : keyOverview ? 'success' : 'neutral';
  const progressItems =
    Array.isArray(usageModel.progressItems) && usageModel.progressItems.length > 0
      ? usageModel.progressItems
      : [
          {
            labelText: usageModel.progressLabelText || 'Quota Left',
            percent: usageModel.progressPercent,
            text: usageModel.progressText,
            detailText: usageModel.progressDetailText,
            gradient: usageModel.progressGradient
          }
        ];
  const progressMarkup = progressItems
    .map(
      (item) => `
        <span class="preset-card__gmn-progress">
          <span class="preset-card__gmn-progress-head">
            <span class="status-label">${item.labelText || 'Quota Left'}</span>
            <strong class="preset-card__gmn-progress-text">${item.text || '-'}</strong>
            ${
              item.detailText
                ? `<span class="preset-card__gmn-progress-detail">${item.detailText}</span>`
                : ''
            }
          </span>
          <span class="preset-card__gmn-progress-track" aria-hidden="true">
            <span
              class="preset-card__gmn-progress-fill"
              style="width: ${Number(item.percent) || 0}%; background: ${item.gradient || usageModel.progressGradient};"
            ></span>
          </span>
        </span>
      `
    )
    .join('');

  return `
    <span class="preset-card__head">
      <span class="preset-card__title">${preset.name}</span>
      <span class="gmn-status" data-tone="${statusTone}">${statusText}</span>
    </span>
    <span class="preset-card__desc">${preset.description || 'No description provided.'}</span>
    <span class="preset-card__meta">${usageModel.keyText}</span>
    <span class="preset-card__progress-stack">${progressMarkup}</span>
  `;
}

function createUsagePresetCard(preset) {
  const providerId = preset.id;
  const providerLabel = resolveUsageProviderLabel(providerId);
  const busy = isProviderBusy(providerId);
  const card = document.createElement('div');
  card.className = 'preset-card preset-card--usage';
  card.dataset.presetId = preset.id;

  if (preset.id === state.selectedPresetId) {
    card.classList.add('selected');
  }

  if (resolveLivePresetId() === preset.id) {
    card.classList.add('active-live');
  }

  const surface = document.createElement('button');
  surface.className = 'preset-card__surface';
  surface.type = 'button';
  surface.setAttribute('aria-label', `Select ${preset.name} preset`);
  surface.innerHTML = buildUsagePresetCardMarkup(preset);
  surface.addEventListener('click', async () => {
    if (preset.id === state.selectedPresetId) {
      return;
    }

    if (!canDiscardChanges()) {
      return;
    }

    await loadPresetIntoEditors(preset.id);
  });

  const refreshButton = document.createElement('button');
  refreshButton.className = 'preset-card__refresh';
  refreshButton.type = 'button';
  refreshButton.setAttribute(
    'aria-label',
    busy ? `Refreshing ${providerLabel} quota` : `Refresh ${providerLabel} quota`
  );
  refreshButton.disabled = busy;
  refreshButton.innerHTML = `
    <span class="preset-card__refresh-icon${busy ? ' is-spinning' : ''}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
        <path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
      </svg>
    </span>
    <span class="preset-card__refresh-text">${busy ? 'Syncing...' : `Refresh ${providerLabel}`}</span>
  `;
  refreshButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    await refreshProviderUsage(providerId);
  });

  card.append(surface, refreshButton);
  return card;
}

function buildClaudeUsageCardMarkup() {
  const auth = state.bigmodelAuth || createInitialBigModelAuthSummary();
  const snapshot = state.bigmodelConsole;
  const quotaItems = buildBigModelQuotaProgressItems(snapshot);
  const hasErrors = !!snapshot && Object.keys(snapshot.errors || {}).length > 0;
  const statusText = state.bigmodelConsoleBusy
    ? 'SYNCING'
    : auth.username && auth.hasPassword
      ? snapshot
        ? hasErrors
          ? 'PARTIAL'
          : 'READY'
        : 'IDLE'
      : 'SETUP';
  const statusTone = state.bigmodelConsoleBusy
    ? 'neutral'
    : hasErrors
      ? 'error'
      : snapshot
        ? 'success'
      : 'neutral';
  const description = auth.username
    ? `本地账号 ${auth.username}${auth.maskedApiKey ? ` · ${auth.maskedApiKey}` : ''}`
    : '把账号密码放进本机 bigmodel-auth.json 后，这里会自动加载并同步额度。';
  const metaText = formatBigModelCardContext(auth) || '官方用量统计接口';
  const progressMarkup = quotaItems
    .map(
      (item) => `
      <span class="preset-card__gmn-progress">
        <span class="preset-card__gmn-progress-head">
          <span class="status-label">${item.labelText}</span>
          <strong class="preset-card__gmn-progress-text">${item.text}</strong>
          ${
            item.detailText
              ? `<span class="preset-card__gmn-progress-detail">${item.detailText}</span>`
              : ''
          }
        </span>
        <span class="preset-card__gmn-progress-track" aria-hidden="true">
          <span
            class="preset-card__gmn-progress-fill"
            style="width: ${Number(item.percent) || 0}%; background: ${item.gradient};"
          ></span>
        </span>
      </span>
    `
    )
    .join('');

  return `
    <span class="preset-card__head">
      <span class="preset-card__title">GLM-5.1 (Claude Code)</span>
      <span class="gmn-status" data-tone="${statusTone}">${statusText}</span>
    </span>
    <span class="preset-card__desc">${description}</span>
    <span class="preset-card__meta">${metaText}</span>
    <span class="preset-card__progress-stack">${progressMarkup}</span>
  `;
}

function buildOpenRouterClaudeUsageCardMarkup(preset) {
  const busy = isClaudePresetBusy(preset.id);
  const fallbackMaskedKey = extractClaudePresetMaskedKey(preset);
  const statusText = busy ? 'SYNCING' : 'READY';
  const statusTone = busy ? 'neutral' : 'success';
  const progressItems = [
    {
      labelText: 'Daily Free Limit',
      percent: 100,
      text: '每日限额1000次',
      detailText: '【额度无法统计，仅日总限额估算】',
      gradient:
        typeof gmnDisplay.buildProgressGradient === 'function'
          ? gmnDisplay.buildProgressGradient(100)
          : 'linear-gradient(90deg, #ff7b61 0%, #f6ca57 100%)'
    }
  ];
  const progressMarkup = progressItems
    .map(
      (item) => `
      <span class="preset-card__gmn-progress">
        <span class="preset-card__gmn-progress-head">
          <span class="status-label">${item.labelText || 'Daily Free Left'}</span>
          <strong class="preset-card__gmn-progress-text">${item.text || '-'}</strong>
          ${
            item.detailText
              ? `<span class="preset-card__gmn-progress-detail">${item.detailText}</span>`
              : ''
          }
        </span>
        <span class="preset-card__gmn-progress-track" aria-hidden="true">
          <span
            class="preset-card__gmn-progress-fill"
            style="width: ${Number(item.percent) || 0}%; background: ${item.gradient || usageModel.progressGradient};"
          ></span>
        </span>
      </span>
    `
    )
    .join('');
  const env = extractClaudeEnv(preset?.configText || '');
  const model =
    String(env.ANTHROPIC_MODEL || '').trim() ||
    String(env.ANTHROPIC_DEFAULT_OPUS_MODEL || '').trim() ||
    'qwen/qwen3.6-plus:free';
  const metaText = model;

  return `
    <span class="preset-card__head">
      <span class="preset-card__title">${preset.name}</span>
      <span class="gmn-status" data-tone="${statusTone}">${statusText}</span>
    </span>
    <span class="preset-card__desc">${preset.description || 'OpenRouter free daily estimate.'}</span>
    <span class="preset-card__meta">${metaText}</span>
    <span class="preset-card__progress-stack">${progressMarkup}</span>
  `;
}

function isBigModelClaudeUsagePreset(preset) {
  return supportsClaudeConsole() && preset?.id === 'claude-glm-5-1';
}

function isClaudeUsagePreset(preset) {
  return isBigModelClaudeUsagePreset(preset) || isOpenRouterClaudeUsagePreset(preset);
}

function createClaudeUsageCard(preset) {
  const card = document.createElement('div');
  card.className = 'preset-card preset-card--usage';
  card.dataset.presetId = preset.id;

  if (preset.id === state.selectedPresetId) {
    card.classList.add('selected');
  }

  if (resolveLivePresetId() === preset.id) {
    card.classList.add('active-live');
  }

  const surface = document.createElement('button');
  surface.className = 'preset-card__surface';
  surface.type = 'button';
  surface.setAttribute('aria-label', `Select ${preset.name} preset`);
  surface.innerHTML = isBigModelClaudeUsagePreset(preset)
    ? buildClaudeUsageCardMarkup()
    : buildOpenRouterClaudeUsageCardMarkup(preset);
  surface.addEventListener('click', async () => {
    if (preset.id === state.selectedPresetId) {
      return;
    }

    if (!canDiscardChanges()) {
      return;
    }

    await loadPresetIntoEditors(preset.id);
  });

  const refreshButton = document.createElement('button');
  refreshButton.className = 'preset-card__refresh';
  refreshButton.type = 'button';
  const isBigModelPreset = isBigModelClaudeUsagePreset(preset);
  const busy = isBigModelPreset ? state.bigmodelConsoleBusy : isClaudePresetBusy(preset.id);
  refreshButton.disabled = busy;
  refreshButton.setAttribute(
    'aria-label',
    busy ? `Refreshing ${preset.name} usage` : `Refresh ${preset.name} usage`
  );
  refreshButton.innerHTML = `
    <span class="preset-card__refresh-icon${busy ? ' is-spinning' : ''}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
        <path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
      </svg>
    </span>
    <span class="preset-card__refresh-text">${busy ? 'Syncing...' : isBigModelPreset ? 'Refresh Claude' : 'Refresh OpenRouter'}</span>
  `;
  refreshButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (isBigModelPreset) {
      await fetchBigModelConsole();
      return;
    }

    await refreshClaudePresetUsage(preset.id);
  });

  card.append(surface, refreshButton);
  return card;
}

function createStandardPresetCard(preset) {
  const button = document.createElement('button');
  button.className = 'preset-card';
  button.type = 'button';
  button.dataset.presetId = preset.id;
  button.setAttribute('aria-label', `Select ${preset.name} preset`);

  if (preset.id === state.selectedPresetId) {
    button.classList.add('selected');
  }

  if (resolveLivePresetId() === preset.id) {
    button.classList.add('active-live');
  }

  button.innerHTML = `
    <span class="preset-card__head">
      <span class="preset-card__title">${preset.name}</span>
      <span class="preset-card__chip">${preset.isBuiltIn === false ? 'Custom' : 'Built In'}</span>
    </span>
    <span class="preset-card__desc">${preset.description || 'No description provided.'}</span>
  `;

  button.addEventListener('click', async () => {
    if (!canDiscardChanges()) {
      return;
    }

    await loadPresetIntoEditors(preset.id);
  });

  return button;
}

function createPresetCard(preset) {
  if (isClaudeUsagePreset(preset)) {
    return createClaudeUsageCard(preset);
  }

  if (isUsageProviderId(preset.id)) {
    return createUsagePresetCard(preset);
  }

  return createStandardPresetCard(preset);
}

function createAddPresetCard() {
  const button = document.createElement('button');
  button.className = 'preset-card preset-card--add';
  button.type = 'button';
  button.setAttribute('aria-label', 'Create a new custom preset');

  if (state.selectedPresetId === NEW_PRESET_ID) {
    button.classList.add('selected');
  }

  button.innerHTML = `
    <span class="preset-card__plus">+</span>
    <span class="preset-card__title">New Preset</span>
    <span class="preset-card__desc">${getCurrentProduct().addPresetDescription}</span>
  `;

  button.addEventListener('click', () => {
    startNewPresetDraft();
  });

  return button;
}

function getSortedPresets() {
  const liveId = resolveLivePresetId();
  const order = state.presetOrder;
  const sorted = [...state.presets];

  if (order.length > 0) {
    sorted.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });
  }

  if (liveId) {
    const idx = sorted.findIndex((preset) => preset.id === liveId);

    if (idx > 0) {
      const [active] = sorted.splice(idx, 1);
      sorted.unshift(active);
    }
  }

  return sorted;
}

function attachDragHandlers(card, presetId) {
  const liveId = resolveLivePresetId();

  if (presetId === liveId) {
    return;
  }

  card.draggable = true;

  card.addEventListener('dragstart', (event) => {
    dragSrcId = presetId;
    card.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    dragSrcId = null;
    card.classList.remove('is-dragging');
    elements.presetList.querySelectorAll('.drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
  });

  card.addEventListener('dragover', (event) => {
    event.preventDefault();
    const livePresetId = resolveLivePresetId();

    if (dragSrcId && presetId !== dragSrcId && presetId !== livePresetId) {
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    }
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (event) => {
    event.preventDefault();
    card.classList.remove('drag-over');

    if (!dragSrcId || dragSrcId === presetId) {
      return;
    }

    const sorted = getSortedPresets();
    const fromIdx = sorted.findIndex((preset) => preset.id === dragSrcId);
    const toIdx = sorted.findIndex((preset) => preset.id === presetId);

    if (fromIdx === -1 || toIdx === -1) {
      return;
    }

    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);

    state.presetOrder = sorted.map((preset) => preset.id);
    renderPresetList();
    window.codexApp.savePresetOrder(state.presetOrder);
  });
}

function renderPresetList() {
  elements.presetList.innerHTML = '';

  getSortedPresets().forEach((preset) => {
    const card = createPresetCard(preset);
    attachDragHandlers(card, preset.id);
    elements.presetList.appendChild(card);
  });

  elements.presetList.appendChild(createAddPresetCard());
}

function renderLiveSummary() {
  const providerId = resolveLivePresetId();
  elements.activeProviderName.textContent = getPresetLabel(providerId);
  elements.activeModel.textContent = state.live?.summary?.model || '-';
  elements.activeKey.textContent = state.live?.summary?.maskedKey || '-';
}

function renderSelectedPresetMeta() {
  setTargetFields(getPresetById(state.selectedPresetId));
}

function renderPaths() {
  elements.configPath.textContent = state.live?.paths?.configPath || '-';
  elements.authPath.textContent = state.live?.paths?.authPath || '-';
}

function syncProviderBusyState(providerId, isBusy) {
  state.providerBusy = {
    ...state.providerBusy,
    [providerId]: isBusy
  };

  renderPresetList();
}

function syncDirtyState(isDirty) {
  state.editorsDirty = isDirty;
}

function fillEditors(configText, authText) {
  elements.configEditor.value = configText || '';
  elements.authEditor.value = authText || '';
  syncDirtyState(false);
}

function createDraftPreset() {
  return {
    id: NEW_PRESET_ID,
    productId: state.currentProductId,
    name: '',
    description: getCurrentProduct().draftDescription,
    configText: '',
    authText: '',
    isBuiltIn: false
  };
}

function startNewPresetDraft() {
  if (!canDiscardChanges()) {
    return;
  }

  state.draftPreset = createDraftPreset();
  state.selectedPresetId = NEW_PRESET_ID;
  fillEditors('', '');
  renderPresetList();
  renderSelectedPresetMeta();
  renderTestResult(null, 'neutral');
  setMessage(`已开始新的 ${getCurrentProduct().name} 预设草稿。`, 'success');
}

async function loadPresetIntoEditors(presetId) {
  const preset = unwrapIpcResult(await window.codexApp.getPreset(state.currentProductId, presetId));

  if (!preset) {
    setMessage('未找到对应预设。', 'error');
    return;
  }

  state.draftPreset = null;
  state.selectedPresetId = presetId;
  const resolvedAuthText =
    typeof openAiAuth.resolveEditorAuthText === 'function'
      ? openAiAuth.resolveEditorAuthText(preset.id, preset.authText, state.live?.authText || '')
      : preset.authText;
  fillEditors(preset.configText, resolvedAuthText);
  renderPresetList();
  renderSelectedPresetMeta();
  renderTestResult(null, 'neutral');
  setMessage(`已载入预设：${preset.name}`, 'success');
}

async function loadLiveFilesIntoEditors() {
  if (!canDiscardChanges()) {
    return;
  }

  const live = unwrapIpcResult(await window.codexApp.readLiveFiles(state.currentProductId));
  state.live = live;

  const liveProviderId = live.summary?.providerId;
  if (state.presets.some((item) => item.id === liveProviderId)) {
    state.draftPreset = null;
    state.selectedPresetId = liveProviderId;
  }

  fillEditors(live.configText, live.authText);
  renderPresetList();
  renderSelectedPresetMeta();
  renderLiveSummary();
  renderPaths();
  renderTestResult(null, 'neutral');
  setMessage('已读取当前生效文件。', 'success');

  if (supportsUsageCards()) {
    void refreshAllProviderUsage({ silent: true });
  }
}

async function saveCurrentEditors() {
  const product = getCurrentProduct();

  if (!window.confirm(`将当前编辑内容写入 ${product.name} 并立即启用吗？`)) {
    return;
  }

  try {
    setMessage('正在校验并写入文件...', 'neutral');
    const live = unwrapIpcResult(
      await window.codexApp.saveFiles({
        productId: state.currentProductId,
        configText: elements.configEditor.value,
        authText: elements.authEditor.value
      })
    );
    state.live = live;
    syncDirtyState(false);
    renderPresetList();
    renderLiveSummary();
    renderPaths();
    setMessage(`已写入并启用到 ${product.name}。`, 'success');

    if (supportsUsageCards()) {
      void refreshAllProviderUsage({ silent: true });
    }
  } catch (error) {
    setMessage(`启用失败：${error.message}`, 'error');
  }
}

async function runProviderTest() {
  if (!supportsProviderTest()) {
    setMessage('Claude 页签当前不提供在线测试，请直接保存和启用设置。', 'neutral');
    renderTestResult(null, 'neutral');
    return;
  }

  try {
    setMessage('正在发送在线测试请求...', 'neutral');
    renderTestResult(
      {
        endpoint: 'Requesting...',
        model: '-',
        responseId: '-',
        outputText: 'Waiting for the provider response...'
      },
      'loading'
    );

    const response = await window.codexApp.testProvider({
      productId: state.currentProductId,
      configText: elements.configEditor.value,
      authText: elements.authEditor.value
    });

    if (response.ok) {
      state.lastTestResult = response.data;
      renderTestResult(response.data, 'success');
      setMessage('在线测试成功。', 'success');
      return;
    }

    state.lastTestResult = null;
    renderTestResult(
      {
        endpoint: response.error.endpoint || '-',
        model: response.error.model || '-',
        responseId: response.error.responseId || '-',
        outputText: response.error.outputText || response.error.message || 'Unknown test failure.'
      },
      'error'
    );
    setMessage(`在线测试失败：${response.error.message}`, 'error');
  } catch (error) {
    state.lastTestResult = null;
    renderTestResult(
      {
        endpoint: error.endpoint || '-',
        model: error.model || '-',
        responseId: error.responseId || '-',
        outputText: error.outputText || error.message
      },
      'error'
    );
    setMessage(`在线测试失败：${error.message}`, 'error');
  }
}

async function saveBigModelAuth({ silent = false } = {}) {
  if (!supportsClaudeConsole()) {
    return null;
  }

  const payload = getBigModelFormPayload();
  const hasSavedAccount = !!String(state.bigmodelAuth?.username || '').trim();

  if (!payload.username && !hasSavedAccount) {
    throw new Error('请输入 BigModel 控制台账号后再保存。');
  }

  const summary = unwrapIpcResult(await window.codexApp.bigmodelSaveAuth(payload));
  state.bigmodelAuth = summary || createInitialBigModelAuthSummary();
  elements.bigmodelPasswordInput.value = '';
  elements.bigmodelApiKeyInput.value = '';
  renderPresetList();
  renderBigModelPanel();

  if (!silent) {
    setMessage('BigModel 本地凭据已保存。', 'success');
  }

  return summary;
}

async function fetchBigModelConsole({ silent = false } = {}) {
  if (!supportsClaudeConsole()) {
    return;
  }

  try {
    if (hasPendingBigModelAuthChanges()) {
      await saveBigModelAuth({ silent: true });
    }

    state.bigmodelConsoleBusy = true;
    renderPresetList();
    renderBigModelPanel();

    if (!silent) {
      setMessage('正在抓取 BigModel 控制台数据...', 'neutral');
    }

    const snapshot = unwrapIpcResult(await window.codexApp.bigmodelFetchConsole());
    state.bigmodelConsole = snapshot || null;
    state.bigmodelConsoleBusy = false;
    renderPresetList();
    renderBigModelPanel();

    if (silent) {
      return;
    }

    if (snapshot && Object.keys(snapshot.errors || {}).length > 0) {
      setMessage('BigModel 控制台数据已部分抓取，详情见下方结果。', 'neutral');
      return;
    }

    setMessage('BigModel 控制台数据已抓取。', 'success');
  } catch (error) {
    state.bigmodelConsoleBusy = false;
    renderPresetList();
    renderBigModelPanel();

    if (/No handler registered/i.test(String(error.message || ''))) {
      if (!silent) {
        setMessage('Claude 额度查询需要完全重启一次 App，当前窗口还在使用旧主进程。', 'error');
      }
      return;
    }

    if (!silent) {
      setMessage(`BigModel 控制台抓取失败：${error.message}`, 'error');
    }
  }
}

async function refreshClaudePresetUsage(presetId, { silent = false } = {}) {
  if (!supportsClaudeConsole()) {
    return;
  }

  const preset = state.presets.find((item) => item.id === presetId);

  if (!preset || !isOpenRouterClaudeUsagePreset(preset)) {
    return;
  }

  try {
    state.claudePresetBusy = {
      ...state.claudePresetBusy,
      [presetId]: true
    };
    renderPresetList();

    if (!silent) {
      setMessage(`正在刷新 ${preset.name} 显示状态...`, 'neutral');
    }
    await new Promise((resolve) => window.setTimeout(resolve, 700));

    if (!silent) {
      setMessage(`${preset.name} 已刷新。`, 'success');
    }
  } catch (error) {
    if (!silent) {
      setMessage(`${preset?.name || presetId} 刷新失败：${error.message}`, 'error');
    }
  } finally {
    state.claudePresetBusy = {
      ...state.claudePresetBusy,
      [presetId]: false
    };
    renderPresetList();
  }
}

async function invokeUsageRefresh(providerId) {
  if (providerId === '92scw') {
    return window.codexApp.refresh92scw();
  }

  if (providerId === 'gmn') {
    return window.codexApp.gmnRefresh();
  }

  if (providerId === 'gwen') {
    return window.codexApp.gwenRefresh();
  }

  if (providerId === 'openai') {
    return window.codexApp.openaiRefresh();
  }

  if (providerId === 'quan2go') {
    return window.codexApp.quan2goRefresh();
  }

  throw new Error(`Unsupported usage provider: ${providerId}`);
}

async function refreshProviderUsage(providerId, { silent = false } = {}) {
  if (!supportsUsageCards()) {
    return;
  }

  const providerLabel = resolveUsageProviderLabel(providerId);

  try {
    syncProviderBusyState(providerId, true);

    if (!silent) {
      setMessage(`正在刷新 ${providerLabel} 额度...`, 'neutral');
    }

    const result = unwrapIpcResult(await invokeUsageRefresh(providerId));
    state.providerUsage = {
      ...state.providerUsage,
      [providerId]: result || null
    };
    state.providerBusy = {
      ...state.providerBusy,
      [providerId]: false
    };
    renderPresetList();

    if (!silent) {
      const message =
        typeof usageRefreshMessage.buildUsageRefreshResultMessage === 'function'
          ? usageRefreshMessage.buildUsageRefreshResultMessage(providerId, result)
          : { text: `${providerLabel} quota refreshed.`, tone: 'success' };
      setMessage(message.text, message.tone);
    }
  } catch (error) {
    if (!silent) {
      setMessage(`${providerLabel} 刷新失败：${error.message}`, 'error');
    }
  } finally {
    if (isProviderBusy(providerId)) {
      syncProviderBusyState(providerId, false);
    }
  }
}

async function refreshAllProviderUsage(options = {}) {
  if (!supportsUsageCards()) {
    return;
  }

  await Promise.all(USAGE_PROVIDER_IDS.map((providerId) => refreshProviderUsage(providerId, options)));
}

function buildPresetPayloadForSave() {
  const preset = getPresetById(state.selectedPresetId);
  const name = elements.presetNameInput.value.trim();
  const description = elements.presetDescriptionInput.value.trim();

  if (!name) {
    throw new Error('Preset name is required.');
  }

  return {
    id: preset?.id,
    productId: state.currentProductId,
    name,
    description,
    isBuiltIn: preset?.isBuiltIn !== false,
    configText: elements.configEditor.value,
    authText: elements.authEditor.value
  };
}

async function saveCurrentPreset() {
  try {
    const payload = buildPresetPayloadForSave();

    if (!window.confirm(`将当前编辑内容保存到预设 "${payload.name}" 吗？`)) {
      return;
    }

    if (state.selectedPresetId === NEW_PRESET_ID) {
      const result = unwrapIpcResult(await window.codexApp.createCustomPreset(payload));
      state.presets = result.presets;
      state.draftPreset = null;
      state.selectedPresetId = result.preset?.id || state.selectedPresetId;

      if (result.preset) {
        fillEditors(result.preset.configText, result.preset.authText);
      }

      renderPresetList();
      renderSelectedPresetMeta();
      setMessage(`已保存新预设：${payload.name}`, 'success');

      if (isUsageProviderId(result.preset?.id)) {
        void refreshProviderUsage(result.preset.id, { silent: true });
      }

      return;
    }

    const result = unwrapIpcResult(await window.codexApp.savePreset(payload));
    state.presets = result.presets;
    syncDirtyState(false);
    renderPresetList();
    renderSelectedPresetMeta();
    setMessage(`预设已保存：${payload.name}`, 'success');

    if (isUsageProviderId(payload.id)) {
      void refreshProviderUsage(payload.id, { silent: true });
    }
  } catch (error) {
    setMessage(`保存预设失败：${error.message}`, 'error');
  }
}

function bindEditorEvents() {
  [elements.configEditor, elements.authEditor].forEach((editor) => {
    editor.addEventListener('input', () => {
      syncDirtyState(true);
    });
  });

  [elements.presetNameInput, elements.presetDescriptionInput].forEach((field) => {
    field.addEventListener('input', () => {
      const preset = getPresetById(state.selectedPresetId);

      if (preset) {
        preset.name = elements.presetNameInput.value;
        preset.description = elements.presetDescriptionInput.value;
      }

      syncDirtyState(true);
    });
  });
}

function applyBootstrapPayload(bootstrapPayload) {
  const providerUsage = bootstrapPayload.providerUsage || {};
  state.presets = bootstrapPayload.presets || [];
  state.presetOrder = bootstrapPayload.presetOrder || [];
  state.live = bootstrapPayload.live || null;
  state.bigmodelAuth = bootstrapPayload.bigmodelAuth || createInitialBigModelAuthSummary();
  state.bigmodelConsole = null;
  state.bigmodelConsoleBusy = false;
  state.claudePresetUsage = createInitialClaudePresetUsageState();
  state.claudePresetBusy = createInitialClaudePresetBusyState();
  state.providerUsage = createInitialProviderUsageState();
  state.providerBusy = createInitialProviderBusy();

  if (supportsUsageCards()) {
    state.providerUsage = {
      '92scw': providerUsage['92scw'] || null,
      gmn: providerUsage.gmn || bootstrapPayload.gmn || null,
      gwen: providerUsage.gwen || null,
      openai: providerUsage.openai || null,
      quan2go: providerUsage.quan2go || null
    };
    state.providerBusy = {
      '92scw': true,
      gmn: true,
      gwen: true,
      openai: true,
      quan2go: true
    };
  }

  const liveProviderId = resolveLivePresetId();
  const initialPresetId = state.presets.some((item) => item.id === liveProviderId)
    ? liveProviderId
    : state.presets[0]?.id;

  state.selectedPresetId = initialPresetId;
  state.draftPreset = null;

  if (bootstrapPayload.live?.configText || bootstrapPayload.live?.authText) {
    fillEditors(bootstrapPayload.live.configText, bootstrapPayload.live.authText);
  } else if (initialPresetId) {
    const preset = state.presets.find((item) => item.id === initialPresetId);
    fillEditors(preset?.configText, preset?.authText);
  } else {
    fillEditors('', '');
  }
}

async function loadProduct(productId, { force = false } = {}) {
  const nextProductId = PRODUCT_UI[productId] ? productId : DEFAULT_PRODUCT_ID;

  if (!force && nextProductId === state.currentProductId) {
    return;
  }

  if (!force && !canDiscardChanges()) {
    return;
  }

  state.currentProductId = nextProductId;
  state.live = null;
  state.presets = [];
  state.presetOrder = [];
  state.selectedPresetId = null;
  state.draftPreset = null;
  state.lastTestResult = null;
  state.providerBusy = createInitialProviderBusy();
  state.providerUsage = createInitialProviderUsageState();
  state.bigmodelAuth = createInitialBigModelAuthSummary();
  state.bigmodelConsole = null;
  state.bigmodelConsoleBusy = false;
  state.claudePresetUsage = createInitialClaudePresetUsageState();
  state.claudePresetBusy = createInitialClaudePresetBusyState();
  renderProductChrome();
  renderBigModelPanel();
  renderPresetList();
  renderLiveSummary();
  renderPaths();
  renderTestResult(null, 'neutral');
  setMessage(`正在加载 ${getCurrentProduct().name} 预设与当前配置...`, 'neutral');

  try {
    const bootstrapPayload = unwrapIpcResult(await window.codexApp.bootstrap(nextProductId));
    applyBootstrapPayload(bootstrapPayload);
    renderProductChrome();
    renderPresetList();
    renderSelectedPresetMeta();
    renderLiveSummary();
    renderPaths();
    renderBigModelPanel();
    renderTestResult(null, 'neutral');
    setMessage('预设与当前配置已加载。', 'success');

    if (supportsUsageCards()) {
      void refreshAllProviderUsage({ silent: true });
    }

    if (supportsClaudeConsole() && state.bigmodelAuth.username && state.bigmodelAuth.hasPassword) {
      void fetchBigModelConsole({ silent: true });
    }

    if (supportsClaudeConsole()) {
      state.presets.filter((preset) => isOpenRouterClaudeUsagePreset(preset)).forEach((preset) => {
        state.claudePresetUsage = {
          ...state.claudePresetUsage,
          [preset.id]: {
            keyOverview: null
          }
        };
      });
    }
  } catch (error) {
    setMessage(`加载失败：${error.message}`, 'error');
  }
}

async function bootstrap() {
  applyPlatformTheme();

  Object.assign(elements, {
    activeKey: qs('#active-key'),
    activeModel: qs('#active-model'),
    activeProviderName: qs('#active-provider-name'),
    applyBtn: qs('#apply-btn'),
    authEditor: qs('#auth-editor'),
    authEditorLabel: qs('#auth-editor-label'),
    authEditorTip: qs('#auth-editor-tip'),
    authEditorTitle: qs('#auth-editor-title'),
    authFileLabel: qs('#auth-file-label'),
    authPath: qs('#auth-path'),
    bigmodelApiKeyInput: qs('#bigmodel-api-key-input'),
    bigmodelBalanceFill: qs('#bigmodel-balance-fill'),
    bigmodelBalanceFoot: qs('#bigmodel-balance-foot'),
    bigmodelBalanceMain: qs('#bigmodel-balance-main'),
    bigmodelBalanceSide: qs('#bigmodel-balance-side'),
    bigmodelConsoleOutput: qs('#bigmodel-console-output'),
    bigmodelFetchBtn: qs('#bigmodel-fetch-btn'),
    bigmodelFetchContext: qs('#bigmodel-fetch-context'),
    bigmodelFetchKeys: qs('#bigmodel-fetch-keys'),
    bigmodelFetchStatus: qs('#bigmodel-fetch-status'),
    bigmodelFetchUsage: qs('#bigmodel-fetch-usage'),
    bigmodelOrganizationInput: qs('#bigmodel-organization-input'),
    bigmodelPasswordInput: qs('#bigmodel-password-input'),
    bigmodelPasswordState: qs('#bigmodel-password-state'),
    bigmodelProjectInput: qs('#bigmodel-project-input'),
    bigmodelSaveBtn: qs('#bigmodel-save-btn'),
    bigmodelSavedAccount: qs('#bigmodel-saved-account'),
    bigmodelSavedContext: qs('#bigmodel-saved-context'),
    bigmodelSavedKey: qs('#bigmodel-saved-key'),
    bigmodelUsernameInput: qs('#bigmodel-username-input'),
    claudeConsolePanel: qs('#claude-console-panel'),
    configEditor: qs('#config-editor'),
    configEditorLabel: qs('#config-editor-label'),
    configEditorTip: qs('#config-editor-tip'),
    configEditorTitle: qs('#config-editor-title'),
    configFileLabel: qs('#config-file-label'),
    configPath: qs('#config-path'),
    messageText: qs('#message-text'),
    openDirBtn: qs('#open-dir-btn'),
    presetDescriptionInput: qs('#preset-description-input'),
    presetList: qs('#preset-list'),
    presetNameInput: qs('#preset-name-input'),
    productClaudeBtn: qs('#product-claude-btn'),
    productCodexBtn: qs('#product-codex-btn'),
    reloadLiveBtn: qs('#reload-live-btn'),
    savePresetBtn: qs('#save-preset-btn'),
    sidebarEyebrow: qs('#sidebar-eyebrow'),
    sidebarSubtle: qs('#sidebar-subtle'),
    sidebarTitle: qs('#sidebar-title'),
    testBtn: qs('#test-btn'),
    testEndpoint: qs('#test-endpoint'),
    testModel: qs('#test-model'),
    testOutput: qs('#test-output'),
    testResponseId: qs('#test-response-id'),
    testStatus: qs('#test-status'),
    usageBtn: qs('#usage-btn')
  });

  bindEditorEvents();

  [elements.productCodexBtn, elements.productClaudeBtn].forEach((button) => {
    button.addEventListener('click', () => {
      loadProduct(button.dataset.productId);
    });
  });

  elements.reloadLiveBtn.addEventListener('click', () => {
    loadLiveFilesIntoEditors();
  });

  elements.usageBtn.addEventListener('click', async () => {
    try {
      unwrapIpcResult(await window.codexApp.openUsageStats(state.currentProductId));
      setMessage('已打开官方用量统计页面。', 'success');
    } catch (error) {
      setMessage(`打开额度页面失败：${error.message}`, 'error');
    }
  });

  elements.testBtn.addEventListener('click', () => {
    runProviderTest();
  });

  elements.bigmodelSaveBtn.addEventListener('click', async () => {
    try {
      await saveBigModelAuth();
    } catch (error) {
      setMessage(`保存 BigModel 本地凭据失败：${error.message}`, 'error');
    }
  });

  elements.bigmodelFetchBtn.addEventListener('click', () => {
    fetchBigModelConsole();
  });

  elements.savePresetBtn.addEventListener('click', () => {
    saveCurrentPreset();
  });

  elements.applyBtn.addEventListener('click', () => {
    saveCurrentEditors();
  });

  elements.openDirBtn.addEventListener('click', async () => {
    try {
      unwrapIpcResult(await window.codexApp.openConfigDir(state.currentProductId));
      setMessage(`已尝试打开 ${getCurrentProduct().openDirLabel.replace('打开 ', '')}。`, 'neutral');
    } catch (error) {
      setMessage(`打开目录失败：${error.message}`, 'error');
    }
  });

  await loadProduct(DEFAULT_PRODUCT_ID, { force: true });
}

window.addEventListener('DOMContentLoaded', bootstrap);
