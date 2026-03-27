const NEW_PRESET_ID = '__new__';

const state = {
  draftPreset: null,
  live: null,
  presets: [],
  selectedPresetId: null,
  editorsDirty: false,
  lastTestResult: null
};

const elements = {};

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
      statusText = '测试中';
    } else {
      statusText = '成功';
    }
  }

  elements.testStatus.textContent = statusText;
  elements.testStatus.dataset.tone = tone;
  elements.testEndpoint.textContent = hasResult ? result.endpoint || '-' : '-';
  elements.testModel.textContent = hasResult ? result.model || '-' : '-';
  elements.testResponseId.textContent = hasResult ? result.responseId || '-' : '-';
  elements.testOutput.textContent = hasResult
    ? result.outputText || '请求成功，但供应商没有返回可提取的文本。'
    : '点击“在线测试”后，会用当前编辑器中的 config.toml 和 auth.json 发起最小请求。';
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

  return window.confirm('当前编辑内容还没有保存，确认切换并丢弃这些修改吗？');
}

function setTargetFields(preset) {
  elements.presetNameInput.value = preset?.name || '';
  elements.presetDescriptionInput.value = preset?.description || '';
}

function createPresetCard(preset) {
  const button = document.createElement('button');
  button.className = 'preset-card';
  button.type = 'button';
  button.dataset.presetId = preset.id;
  button.setAttribute('aria-label', `切换到 ${preset.name} 预设`);

  if (preset.id === state.selectedPresetId) {
    button.classList.add('selected');
  }

  if (state.live?.summary?.providerId === preset.id) {
    button.classList.add('active-live');
  }

  button.innerHTML = `
    <span class="preset-card__head">
      <span class="preset-card__title">${preset.name}</span>
      <span class="preset-card__chip">${preset.isBuiltIn === false ? '自定义' : '内置'}</span>
    </span>
    <span class="preset-card__desc">${preset.description || '未填写说明。'}</span>
  `;

  button.addEventListener('click', async () => {
    if (!canDiscardChanges()) {
      return;
    }

    await loadPresetIntoEditors(preset.id);
  });

  return button;
}

function createAddPresetCard() {
  const button = document.createElement('button');
  button.className = 'preset-card preset-card--add';
  button.type = 'button';
  button.setAttribute('aria-label', '新增自定义预设');

  if (state.selectedPresetId === NEW_PRESET_ID) {
    button.classList.add('selected');
  }

  button.innerHTML = `
    <span class="preset-card__plus">+</span>
    <span class="preset-card__title">新增预设</span>
    <span class="preset-card__desc">清空右侧内容并开始创建一张新的自定义供应商卡片。</span>
  `;

  button.addEventListener('click', () => {
    startNewPresetDraft();
  });

  return button;
}

function renderPresetList() {
  elements.presetList.innerHTML = '';

  state.presets.forEach((preset) => {
    elements.presetList.appendChild(createPresetCard(preset));
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
    description: '自定义供应商预设，可独立保存和启用。',
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
  setMessage('已进入新增预设模式。右侧内容已清空，请填写名称和配置。', 'success');
}

async function loadPresetIntoEditors(presetId) {
  const preset = unwrapIpcResult(await window.codexApp.getPreset(presetId));

  if (!preset) {
    setMessage('未找到对应的预设。', 'error');
    return;
  }

  state.draftPreset = null;
  state.selectedPresetId = presetId;
  fillEditors(preset.configText, preset.authText);
  renderPresetList();
  renderSelectedPresetMeta();
  renderTestResult(null, 'neutral');
  setMessage(`已载入 ${preset.name} 的预设内容。`, 'success');
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
  setMessage('已读取当前生效中的 config.toml 和 auth.json。', 'success');
}

async function saveCurrentEditors() {
  if (!window.confirm('确认将当前编辑内容写入 .codex，并立即切换为这套配置吗？')) {
    return;
  }

  const payload = {
    configText: elements.configEditor.value,
    authText: elements.authEditor.value
  };

  try {
    setMessage('正在校验并写入文件...', 'neutral');
    const live = unwrapIpcResult(await window.codexApp.saveFiles(payload));
    state.live = live;
    syncDirtyState(false);
    renderPresetList();
    renderLiveSummary();
    renderPaths();
    setMessage('启用完成，配置文件已写入并生效。', 'success');
  } catch (error) {
    setMessage(`启用失败：${error.message}`, 'error');
  }
}

async function runProviderTest() {
  try {
    setMessage('正在发起在线测试请求...', 'neutral');
    renderTestResult(
      {
        endpoint: '请求中...',
        model: '-',
        responseId: '-',
        outputText: '请稍候，正在等待供应商返回结果。'
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
      setMessage('在线测试成功，当前配置可用。', 'success');
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

function buildPresetPayloadForSave() {
  const preset = getPresetById(state.selectedPresetId);
  const name = elements.presetNameInput.value.trim();
  const description = elements.presetDescriptionInput.value.trim();

  if (!name) {
    throw new Error('供应商名称不能为空。');
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

    if (!window.confirm(`确认保存 ${payload.name} 当前编辑内容为应用内预设吗？`)) {
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
      setMessage(`已新增并保存预设 ${payload.name}。`, 'success');
      return;
    }

    const result = unwrapIpcResult(await window.codexApp.savePreset(payload));

    state.presets = result.presets;
    syncDirtyState(false);
    renderPresetList();
    renderSelectedPresetMeta();
    setMessage(`已保存 ${payload.name} 预设。当前尚未启用到 Codex。`, 'success');
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
    state.presets = bootstrapPayload.presets;
    state.live = bootstrapPayload.live;

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
      fillEditors(preset.configText, preset.authText);
    }

    renderPresetList();
    renderSelectedPresetMeta();
    renderLiveSummary();
    renderPaths();
    renderTestResult(null, 'neutral');
    setMessage('预设和当前配置已加载完成。', 'success');
  } catch (error) {
    setMessage(`启动失败：${error.message}`, 'error');
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
      setMessage('已尝试打开 .codex 目录。', 'neutral');
    } catch (error) {
      setMessage(`打开目录失败：${error.message}`, 'error');
    }
  });
}

window.addEventListener('DOMContentLoaded', bootstrap);
