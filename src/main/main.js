const path = require('node:path');

const { app, BrowserWindow, ipcMain, shell } = require('electron');

const { getCodexPaths, readCodexFiles, saveCodexFiles } = require('./codex-files');
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
  clearGmnSession,
  loginGmnAccount,
  readGmnSession,
  resolveGmnKeyOverview,
  resolveGmnOverview
} = require('./gmn-account');
const { fetchGwenKeyOverview } = require('./gwen-usage');
const { fetchNewApiTokenOverview } = require('./newapi-token-usage');
const { fetchOpenAiUsageOverview } = require('./openai-usage');
const { buildBootstrapPayload } = require('./bootstrap-payload');
const { getWindowOptions } = require('./window-options');
const { extractApiKey } = require('../shared/config-service');
const { listPresets } = require('../shared/presets');

function getGmnSessionStorePath() {
  return path.join(app.getPath('userData'), 'gmn-session.json');
}

async function readMergedPresets() {
  const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));
  const presetStore = await readPresetStore(presetStorePath);

  return {
    presetStorePath,
    presetStore,
    presets: mergePresetsWithOverrides(listPresets(), presetStore)
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

function createWindow() {
  const window = new BrowserWindow(getWindowOptions());

  window.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function bindIpc() {
  ipcMain.handle('app:bootstrap', async () =>
    runIpcTask(() =>
      buildBootstrapPayload({
        readMergedPresets,
        readLiveFiles: readCodexFiles,
        getCodexPaths
      })
    )
  );
  ipcMain.handle('app:read-live-files', async () => runIpcTask(() => readCodexFiles()));
  ipcMain.handle('app:get-preset', async (_event, presetId) =>
    runIpcTask(async () => {
      const { presets } = await readMergedPresets();

      return presets.find((preset) => preset.id === presetId) || null;
    })
  );
  ipcMain.handle('app:save-preset', async (_event, payload) =>
    runIpcTask(async () => {
      const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));

      if (payload.isBuiltIn === false) {
        const presetStore = await saveCustomPreset(payload, presetStorePath);

        return {
          presets: mergePresetsWithOverrides(listPresets(), presetStore)
        };
      }

      await savePresetOverride(payload, presetStorePath);

      const presetStore = await readPresetStore(presetStorePath);

      return {
        presets: mergePresetsWithOverrides(listPresets(), presetStore)
      };
    })
  );
  ipcMain.handle('app:create-custom-preset', async (_event, payload) =>
    runIpcTask(async () => {
      const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));
      const presetStore = await readPresetStore(presetStorePath);
      const existingPresets = mergePresetsWithOverrides(listPresets(), presetStore);
      const id = createCustomPresetId(payload.name, existingPresets);
      const nextStore = await saveCustomPreset(
        {
          id,
          name: payload.name,
          description: payload.description,
          configText: payload.configText,
          authText: payload.authText
        },
        presetStorePath
      );
      const presets = mergePresetsWithOverrides(listPresets(), nextStore);

      return {
        preset: presets.find((preset) => preset.id === id) || null,
        presets
      };
    })
  );
  ipcMain.handle('app:test-provider', async (_event, payload) =>
    runIpcTask(() => testProviderConnection(payload))
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
    runIpcTask(() => saveCodexFiles(payload))
  );
  ipcMain.handle('app:open-codex-dir', async () =>
    runIpcTask(async () => {
      const { codexDir } = getCodexPaths();
      return shell.openPath(codexDir);
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
