const path = require('node:path');

const { app, BrowserWindow, ipcMain, shell } = require('electron');

const { getCodexPaths, readCodexFiles, saveCodexFiles } = require('./codex-files');
const { getClaudePaths, readClaudeFiles, saveClaudeFiles } = require('./claude-files');
const {
  createCustomPresetId,
  getPresetOverrideStorePath,
  mergePresetsWithOverrides,
  readPresetStore,
  readPresetOverrides,
  saveCustomPreset,
  savePresetOrder,
  savePresetOverride
} = require('./preset-overrides');
const { runIpcTask } = require('./ipc-response');
const { testProviderConnection } = require('./provider-tester');
const {
  getBigModelAuthStorePath,
  readBigModelAuth,
  saveBigModelAuth,
  summarizeBigModelAuth
} = require('./bigmodel-auth-store');
const { fetchBigModelConsoleSnapshot } = require('./bigmodel-web-client');
const {
  clearGmnSession,
  loginGmnAccount,
  readGmnSession,
  resolveGmnKeyOverview,
  resolveGmnOverview
} = require('./gmn-account');
const { fetchGwenKeyOverview } = require('./gwen-usage');
const { fetchNewApiTokenOverview } = require('./newapi-token-usage');
const {
  fetchOpenRouterFreeUsageOverviewFromPreset,
  isOpenRouterFreeClaudePreset
} = require('./openrouter-usage');
const { fetchOpenAiUsageOverview } = require('./openai-usage');
const { fetchQuan2GoUsageOverview } = require('./quan2go-usage');
const { setupLiveReload } = require('./live-reload');
const { buildBootstrapPayload } = require('./bootstrap-payload');
const { getUsageStatsTarget } = require('./usage-stats-links');
const { getWindowOptions } = require('./window-options');
const { extractApiKey } = require('../shared/config-service');
const { DEFAULT_PRODUCT_ID } = require('../shared/product-catalog');
const { listPresetsByProduct } = require('../shared/presets');

let mainWindow = null;
let stopLiveReload = null;

function getGmnSessionStorePath() {
  return path.join(app.getPath('userData'), 'gmn-session.json');
}

function getBigModelAuthPath() {
  return getBigModelAuthStorePath(app.getPath('userData'));
}

async function readMergedPresets() {
  const productId = arguments[0] || DEFAULT_PRODUCT_ID;
  const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));
  const presetStore = await readPresetStore(presetStorePath);

  return {
    presetStorePath,
    presetStore,
    presets: mergePresetsWithOverrides(listPresetsByProduct(productId), presetStore)
  };
}

function resolveProductId(productId) {
  return productId === 'claude' ? 'claude' : DEFAULT_PRODUCT_ID;
}

function getProductFileApi(productId) {
  if (resolveProductId(productId) === 'claude') {
    return {
      getPaths: getClaudePaths,
      readFiles: readClaudeFiles,
      saveFiles: saveClaudeFiles
    };
  }

  return {
    getPaths: getCodexPaths,
    readFiles: readCodexFiles,
    saveFiles: saveCodexFiles
  };
}

function getPresetApiKey(presets, presetId) {
  const preset = Array.isArray(presets)
    ? presets.find((item) => item.id === presetId)
    : null;

  return extractApiKey(preset?.authText || '');
}

async function buildGmnProviderUsage(presets) {
  const storePath = getGmnSessionStorePath();
  const session = await readGmnSession(storePath);
  const apiKey = getPresetApiKey(presets, 'gmn');
  let overview = null;
  let keyOverview = null;

  try {
    overview = await resolveGmnOverview(storePath);
  } catch {
    overview = null;
  }

  if (apiKey) {
    try {
      keyOverview = await resolveGmnKeyOverview(storePath, apiKey);
    } catch {
      keyOverview = null;
    }
  }

  return {
    account: session.account || '',
    overview,
    keyOverview
  };
}

async function buildGwenProviderUsage(presets) {
  const apiKey = getPresetApiKey(presets, 'gwen');

  if (!apiKey) {
    return {
      keyOverview: null
    };
  }

  try {
    return {
      keyOverview: await fetchGwenKeyOverview(apiKey)
    };
  } catch {
    return {
      keyOverview: null
    };
  }
}

async function build92scwProviderUsage(presets) {
  const preset = Array.isArray(presets)
    ? presets.find((item) => item.id === '92scw')
    : null;
  const apiKey = getPresetApiKey(presets, '92scw');

  if (!preset?.configText || !apiKey) {
    return {
      keyOverview: null
    };
  }

  try {
    return {
      keyOverview: await fetchNewApiTokenOverview('http://92scw.cn', apiKey)
    };
  } catch {
    return {
      keyOverview: null
    };
  }
}

async function buildOpenAiProviderUsage(live) {
  if (!live?.authText) {
    return {
      keyOverview: null
    };
  }

  try {
    return {
      keyOverview: await fetchOpenAiUsageOverview(live.authText)
    };
  } catch {
    return {
      keyOverview: null
    };
  }
}

async function buildQuan2GoProviderUsage(presets) {
  const apiKey = getPresetApiKey(presets, 'quan2go');

  if (!apiKey) {
    return {
      keyOverview: null
    };
  }

  try {
    return {
      keyOverview: await fetchQuan2GoUsageOverview(apiKey)
    };
  } catch {
    return {
      keyOverview: null
    };
  }
}

async function buildClaudePresetUsage(productId, presetId) {
  const resolvedProductId = resolveProductId(productId);
  const { presets } = await readMergedPresets(resolvedProductId);
  const preset = Array.isArray(presets) ? presets.find((item) => item.id === presetId) : null;

  if (!preset) {
    throw new Error(`Preset "${presetId}" was not found for product "${resolvedProductId}".`);
  }

  if (isOpenRouterFreeClaudePreset(preset)) {
    return {
      keyOverview: await fetchOpenRouterFreeUsageOverviewFromPreset(preset)
    };
  }

  throw new Error(`Claude preset "${presetId}" does not expose a supported usage source yet.`);
}

async function buildProductBootstrapPayload(productId) {
  const resolvedProductId = resolveProductId(productId);
  const fileApi = getProductFileApi(resolvedProductId);

  return buildBootstrapPayload({
    productId: resolvedProductId,
    readMergedPresets: () => readMergedPresets(resolvedProductId),
    readLiveFiles: () => fileApi.readFiles(),
    getCodexPaths: fileApi.getPaths,
    readBigModelAuthSummary: async () =>
      summarizeBigModelAuth(await readBigModelAuth(getBigModelAuthPath()))
  });
}

function createWindow() {
  if (stopLiveReload) {
    stopLiveReload();
    stopLiveReload = null;
  }

  const window = new BrowserWindow(getWindowOptions());
  mainWindow = window;

  window.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (!app.isPackaged) {
    stopLiveReload = setupLiveReload(window, {
      appPath: app.getAppPath(),
      restartApp: () => {
        app.relaunch();
        app.exit(0);
      }
    });
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }

    if (stopLiveReload) {
      stopLiveReload();
      stopLiveReload = null;
    }
  });
}

function bindIpc() {
  ipcMain.handle('app:bootstrap', async (_event, productId) =>
    runIpcTask(() => buildProductBootstrapPayload(productId))
  );
  ipcMain.handle('app:read-live-files', async (_event, productId) =>
    runIpcTask(() => getProductFileApi(productId).readFiles())
  );
  ipcMain.handle('app:get-preset', async (_event, productId, presetId) =>
    runIpcTask(async () => {
      const { presets } = await readMergedPresets(resolveProductId(productId));

      return presets.find((preset) => preset.id === presetId) || null;
    })
  );
  ipcMain.handle('app:save-preset', async (_event, payload) =>
    runIpcTask(async () => {
      const productId = resolveProductId(payload?.productId);
      const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));

      if (payload.isBuiltIn === false) {
        const presetStore = await saveCustomPreset(
          {
            ...payload,
            productId
          },
          presetStorePath
        );

        return {
          presets: mergePresetsWithOverrides(listPresetsByProduct(productId), presetStore)
        };
      }

      await savePresetOverride(
        {
          ...payload,
          productId
        },
        presetStorePath
      );

      const presetStore = await readPresetStore(presetStorePath);

      return {
        presets: mergePresetsWithOverrides(listPresetsByProduct(productId), presetStore)
      };
    })
  );
  ipcMain.handle('app:create-custom-preset', async (_event, payload) =>
    runIpcTask(async () => {
      const productId = resolveProductId(payload?.productId);
      const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));
      const presetStore = await readPresetStore(presetStorePath);
      const existingPresets = mergePresetsWithOverrides(listPresetsByProduct(productId), presetStore);
      const id = createCustomPresetId(payload.name, existingPresets);
      const nextStore = await saveCustomPreset(
        {
          id,
          productId,
          name: payload.name,
          description: payload.description,
          configText: payload.configText,
          authText: payload.authText
        },
        presetStorePath
      );
      const presets = mergePresetsWithOverrides(listPresetsByProduct(productId), nextStore);

      return {
        preset: presets.find((preset) => preset.id === id) || null,
        presets
      };
    })
  );
  ipcMain.handle('app:test-provider', async (_event, payload) =>
    runIpcTask(() => testProviderConnection(payload))
  );
  ipcMain.handle('app:bigmodel-auth-read', async () =>
    runIpcTask(async () => summarizeBigModelAuth(await readBigModelAuth(getBigModelAuthPath())))
  );
  ipcMain.handle('app:bigmodel-auth-save', async (_event, payload) =>
    runIpcTask(async () =>
      summarizeBigModelAuth(await saveBigModelAuth(payload, getBigModelAuthPath()))
    )
  );
  ipcMain.handle('app:bigmodel-console-refresh', async () =>
    runIpcTask(async () =>
      fetchBigModelConsoleSnapshot(await readBigModelAuth(getBigModelAuthPath()))
    )
  );
  ipcMain.handle('app:gmn-login', async (_event, payload) =>
    runIpcTask(async () => {
      const storePath = getGmnSessionStorePath();
      const overview = await loginGmnAccount(payload, storePath);

      return {
        account: String(payload?.account || '').trim(),
        overview
      };
    })
  );
  ipcMain.handle('app:gmn-refresh', async () =>
    runIpcTask(async () => buildGmnProviderUsage((await readMergedPresets()).presets))
  );
  ipcMain.handle('app:92scw-refresh', async () =>
    runIpcTask(async () => build92scwProviderUsage((await readMergedPresets()).presets))
  );
  ipcMain.handle('app:gwen-refresh', async () =>
    runIpcTask(async () => buildGwenProviderUsage((await readMergedPresets()).presets))
  );
  ipcMain.handle('app:openai-refresh', async () =>
    runIpcTask(async () => buildOpenAiProviderUsage(await readCodexFiles()))
  );
  ipcMain.handle('app:quan2go-refresh', async () =>
    runIpcTask(async () => buildQuan2GoProviderUsage((await readMergedPresets()).presets))
  );
  ipcMain.handle('app:claude-preset-usage-refresh', async (_event, payload) =>
    runIpcTask(async () => buildClaudePresetUsage(payload?.productId, payload?.presetId))
  );
  ipcMain.handle('app:gmn-logout', async () =>
    runIpcTask(async () => {
      const storePath = getGmnSessionStorePath();
      await clearGmnSession(storePath);

      return {
        account: '',
        overview: null
      };
    })
  );
  ipcMain.handle('app:save-preset-order', async (_event, order) =>
    runIpcTask(() => savePresetOrder(order, getPresetOverrideStorePath(app.getPath('userData'))))
  );
  ipcMain.handle('app:save-files', async (_event, payload) =>
    runIpcTask(() => getProductFileApi(payload?.productId).saveFiles(payload))
  );
  ipcMain.handle('app:open-config-dir', async (_event, productId) =>
    runIpcTask(async () => {
      const paths = getProductFileApi(productId).getPaths();
      return shell.openPath(paths.codexDir || paths.claudeDir || '');
    })
  );
  ipcMain.handle('app:open-usage-stats', async (_event, productId) =>
    runIpcTask(async () => {
      const target = getUsageStatsTarget(resolveProductId(productId));

      if (!target?.url) {
        throw new Error(`No usage stats page is configured for product "${resolveProductId(productId)}".`);
      }

      return shell.openExternal(target.url);
    })
  );
}

app.whenReady().then(() => {
  bindIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
