const NEW_PRESET_ID = '__new__';
const USAGE_PROVIDER_IDS = ['92scw', 'gmn', 'gwen', 'openai'];
const usageRefreshMessage = globalThis.usageRefreshMessage || {};
const openAiAuth = globalThis.openAiAuth || {};

const state = {
  draftPreset: null,
  live: null,
  presets: [],
  presetOrder: [],
  selectedPresetId: null,
  editorsDirty: false,
  lastTestResult: null,
  providerBusy: {
    '92scw': false,
    gmn: false,
    gwen: false,
    openai: false
  },
  providerUsage: {
    '92scw': null,
    gmn: null,
    gwen: null,
    openai: null
  }
};

const elements = {};

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

function qs(selector) {
  return document.querySelector(selector);
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

  const toolbarTest = document.querySelector('.toolbar-test');
  if (toolbarTest) {
    toolbarTest.classList.toggle('is-loading', tone === 'loading');
  }
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

  return window.confirm('The current editor content has unsaved changes. Discard them and continue?');
}

function setTargetFields(preset) {
  elements.presetNameInput.value = preset?.name || '';
  elements.presetDescriptionInput.value = preset?.description || '';
}

function parseAuthJsonSafe(text) {
  if (!text || !text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function extractApiKeyFromAuthText(authText) {
  const auth = parseAuthJsonSafe(authText);
  return typeof auth.OPENAI_API_KEY === 'string' ? auth.OPENAI_API_KEY : '';
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
  return USAGE_PROVIDER_IDS.includes(providerId);
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

function isProviderBusy(providerId) {
  return !!state.providerBusy[providerId];
}

function getPresetMaskedKey(preset) {
  const maskedPresetKey = maskApiKey(extractApiKeyFromAuthText(preset?.authText || ''));

  if (maskedPresetKey) {
    return maskedPresetKey;
  }

  if (state.live?.summary?.providerId === preset?.id) {
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
            <span class="preset-card__gmn-progress-detail">${item.detailText || '-'}</span>
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

  if (state.live?.summary?.providerId === preset.id) {
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
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        ></path>
        <path
          d="M20 4v5h-5"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        ></path>
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

function createStandardPresetCard(preset) {
  const button = document.createElement('button');
  button.className = 'preset-card';
  button.type = 'button';
  button.dataset.presetId = preset.id;
  button.setAttribute('aria-label', `Select ${preset.name} preset`);

  if (preset.id === state.selectedPresetId) {
    button.classList.add('selected');
  }

  if (state.live?.summary?.providerId === preset.id) {
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
    <span class="preset-card__desc">Clear the editor and create a new custom provider preset.</span>
  `;

  button.addEventListener('click', () => {
    startNewPresetDraft();
  });

  return button;
}

function getSortedPresets() {
  const liveId = state.live?.summary?.providerId;
  const order = state.presetOrder;
  const sorted = [...state.presets];

  if (order.length > 0) {
    sorted.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });
  }

  // Active-live preset always first
  if (liveId) {
    const idx = sorted.findIndex((p) => p.id === liveId);
    if (idx > 0) {
      const [active] = sorted.splice(idx, 1);
      sorted.unshift(active);
    }
  }

  return sorted;
}

let dragSrcId = null;

function attachDragHandlers(card, presetId) {
  const liveId = state.live?.summary?.providerId;
  if (presetId === liveId) return;

  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    dragSrcId = presetId;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    dragSrcId = null;
    card.classList.remove('is-dragging');
    elements.presetList.querySelectorAll('.drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    const lId = state.live?.summary?.providerId;
    if (dragSrcId && presetId !== dragSrcId && presetId !== lId) {
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    }
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!dragSrcId || dragSrcId === presetId) return;

    const sorted = getSortedPresets();
    const fromIdx = sorted.findIndex((p) => p.id === dragSrcId);
    const toIdx = sorted.findIndex((p) => p.id === presetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);

    state.presetOrder = sorted.map((p) => p.id);
    renderPresetList();
    window.codexApp.savePresetOrder(state.presetOrder);
  });
}

function renderPresetList() {
  elements.presetList.innerHTML = '';

  const sorted = getSortedPresets();
  sorted.forEach((preset) => {
    const card = createPresetCard(preset);
    attachDragHandlers(card, preset.id);
    elements.presetList.appendChild(card);
  });

  elements.presetList.appendChild(createAddPresetCard());
}

function renderLiveSummary() {
  const providerId = state.live?.summary?.providerId;
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

  if (elements.presetList) {
    renderPresetList();
  }
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
    name: '',
    description: 'Custom provider preset.',
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
  setMessage('Started a new preset draft.', 'success');
}

async function loadPresetIntoEditors(presetId) {
  const preset = unwrapIpcResult(await window.codexApp.getPreset(presetId));

  if (!preset) {
    setMessage('Preset not found.', 'error');
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
  setMessage(`Loaded preset: ${preset.name}.`, 'success');
}

async function loadLiveFilesIntoEditors() {
  if (!canDiscardChanges()) {
    return;
  }

  const live = unwrapIpcResult(await window.codexApp.readLiveFiles());
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
  setMessage('Loaded the current live config files.', 'success');
  await refreshAllProviderUsage({ silent: true });
}

async function saveCurrentEditors() {
  if (!window.confirm('Write the current editor content into .codex and switch to it now?')) {
    return;
  }

  const payload = {
    configText: elements.configEditor.value,
    authText: elements.authEditor.value
  };

  try {
    setMessage('Validating and writing files...', 'neutral');
    const live = unwrapIpcResult(await window.codexApp.saveFiles(payload));
    state.live = live;
    syncDirtyState(false);
    renderPresetList();
    renderLiveSummary();
    renderPaths();
    await refreshAllProviderUsage({ silent: true });
    setMessage('Config files were written and activated.', 'success');
  } catch (error) {
    setMessage(`Failed to activate config: ${error.message}`, 'error');
  }
}

async function runProviderTest() {
  try {
    setMessage('Running online test request...', 'neutral');
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
      configText: elements.configEditor.value,
      authText: elements.authEditor.value
    });

    if (response.ok) {
      state.lastTestResult = response.data;
      renderTestResult(response.data, 'success');
      setMessage('Online test succeeded.', 'success');
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
    setMessage(`Online test failed: ${response.error.message}`, 'error');
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
    setMessage(`Online test failed: ${error.message}`, 'error');
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

  throw new Error(`Unsupported usage provider: ${providerId}`);
}

async function refreshProviderUsage(providerId, { silent = false } = {}) {
  const providerLabel = resolveUsageProviderLabel(providerId);

  try {
    syncProviderBusyState(providerId, true);
    if (!silent) {
      setMessage(`Refreshing ${providerLabel} quota...`, 'neutral');
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
      setMessage(`${providerLabel} refresh failed: ${error.message}`, 'error');
    }
  } finally {
    if (isProviderBusy(providerId)) {
      syncProviderBusyState(providerId, false);
    }
  }
}

async function refreshAllProviderUsage(options = {}) {
  for (const providerId of USAGE_PROVIDER_IDS) {
    await refreshProviderUsage(providerId, options);
  }
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

    if (!window.confirm(`Save the current editor content into preset "${payload.name}"?`)) {
      return;
    }

    if (state.selectedPresetId === NEW_PRESET_ID) {
      const result = unwrapIpcResult(
        await window.codexApp.createCustomPreset({
          name: payload.name,
          description: payload.description,
          configText: payload.configText,
          authText: payload.authText
        })
      );

      state.presets = result.presets;
      state.draftPreset = null;
      state.selectedPresetId = result.preset?.id || state.selectedPresetId;

      if (result.preset) {
        fillEditors(result.preset.configText, result.preset.authText);
      }

      renderPresetList();
      renderSelectedPresetMeta();
      setMessage(`Saved new preset: ${payload.name}.`, 'success');

      if (isUsageProviderId(result.preset?.id)) {
        await refreshProviderUsage(result.preset.id, { silent: true });
      }

      return;
    }

    const result = unwrapIpcResult(await window.codexApp.savePreset(payload));
    state.presets = result.presets;
    syncDirtyState(false);
    renderPresetList();
    renderSelectedPresetMeta();
    setMessage(`Preset saved: ${payload.name}.`, 'success');

    if (isUsageProviderId(payload.id)) {
      await refreshProviderUsage(payload.id, { silent: true });
    }
  } catch (error) {
    setMessage(`Failed to save preset: ${error.message}`, 'error');
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

async function bootstrap() {
  Object.assign(elements, {
    activeKey: qs('#active-key'),
    activeModel: qs('#active-model'),
    activeProviderName: qs('#active-provider-name'),
    authEditor: qs('#auth-editor'),
    authPath: qs('#auth-path'),
    configEditor: qs('#config-editor'),
    configPath: qs('#config-path'),
    messageText: qs('#message-text'),
    openDirBtn: qs('#open-dir-btn'),
    presetDescriptionInput: qs('#preset-description-input'),
    presetList: qs('#preset-list'),
    presetNameInput: qs('#preset-name-input'),
    applyBtn: qs('#apply-btn'),
    reloadLiveBtn: qs('#reload-live-btn'),
    savePresetBtn: qs('#save-preset-btn'),
    testBtn: qs('#test-btn'),
    testEndpoint: qs('#test-endpoint'),
    testModel: qs('#test-model'),
    testOutput: qs('#test-output'),
    testResponseId: qs('#test-response-id'),
    testStatus: qs('#test-status')
  });

  bindEditorEvents();

  try {
    const bootstrapPayload = unwrapIpcResult(await window.codexApp.bootstrap());
    const providerUsage = bootstrapPayload.providerUsage || {};

    state.presets = bootstrapPayload.presets;
    state.presetOrder = bootstrapPayload.presetOrder || [];
    state.live = bootstrapPayload.live;
    state.providerUsage = {
      '92scw': providerUsage['92scw'] || null,
      gmn: providerUsage.gmn || bootstrapPayload.gmn || null,
      gwen: providerUsage.gwen || null,
      openai: providerUsage.openai || null
    };
    state.providerBusy = {
      '92scw': false,
      gmn: false,
      gwen: false,
      openai: false
    };

    const liveProviderId = bootstrapPayload.live?.summary?.providerId;
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
    }

    renderPresetList();
    renderSelectedPresetMeta();
    renderLiveSummary();
    renderPaths();
    renderTestResult(null, 'neutral');
    setMessage('Presets and current config loaded.', 'success');
  } catch (error) {
    setMessage(`Bootstrap failed: ${error.message}`, 'error');
  }

  elements.reloadLiveBtn.addEventListener('click', () => {
    loadLiveFilesIntoEditors();
  });

  elements.testBtn.addEventListener('click', () => {
    runProviderTest();
  });

  elements.savePresetBtn.addEventListener('click', () => {
    saveCurrentPreset();
  });

  elements.applyBtn.addEventListener('click', () => {
    saveCurrentEditors();
  });

  elements.openDirBtn.addEventListener('click', async () => {
    try {
      unwrapIpcResult(await window.codexApp.openCodexDir());
      setMessage('Tried to open the .codex directory.', 'neutral');
    } catch (error) {
      setMessage(`Failed to open directory: ${error.message}`, 'error');
    }
  });
}

window.addEventListener('DOMContentLoaded', bootstrap);
