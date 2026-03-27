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
  savePresetOverride
} = require('./preset-overrides');
const { runIpcTask } = require('./ipc-response');
const { testProviderConnection } = require('./provider-tester');
const { listPresets } = require('../shared/presets');

function createWindow() {
  const window = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#0e1c1e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  window.loadFile(path.join(__dirname, '../renderer/index.html'));
}

async function buildBootstrapPayload() {
  const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));
  const presetStore = await readPresetStore(presetStorePath);
  const live = await readCodexFiles();

  return {
    paths: getCodexPaths(),
    presets: mergePresetsWithOverrides(listPresets(), presetStore),
    live
  };
}

function bindIpc() {
  ipcMain.handle('app:bootstrap', async () => runIpcTask(() => buildBootstrapPayload()));
  ipcMain.handle('app:read-live-files', async () => runIpcTask(() => readCodexFiles()));
  ipcMain.handle('app:get-preset', async (_event, presetId) =>
    runIpcTask(async () => {
      const presetStorePath = getPresetOverrideStorePath(app.getPath('userData'));
      const presetStore = await readPresetStore(presetStorePath);
      const presets = mergePresetsWithOverrides(listPresets(), presetStore);

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
