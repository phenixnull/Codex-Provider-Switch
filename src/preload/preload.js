const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexApp', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  createCustomPreset: (payload) => ipcRenderer.invoke('app:create-custom-preset', payload),
  getPreset: (presetId) => ipcRenderer.invoke('app:get-preset', presetId),
  openCodexDir: () => ipcRenderer.invoke('app:open-codex-dir'),
  readLiveFiles: () => ipcRenderer.invoke('app:read-live-files'),
  savePreset: (payload) => ipcRenderer.invoke('app:save-preset', payload),
  saveFiles: (payload) => ipcRenderer.invoke('app:save-files', payload),
  testProvider: (payload) => ipcRenderer.invoke('app:test-provider', payload)
});
