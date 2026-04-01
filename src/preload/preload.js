const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexApp', {
  platform: process.platform,
  refresh92scw: () => ipcRenderer.invoke('app:92scw-refresh'),
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  createCustomPreset: (payload) => ipcRenderer.invoke('app:create-custom-preset', payload),
  getPreset: (presetId) => ipcRenderer.invoke('app:get-preset', presetId),
  gmnLogin: (payload) => ipcRenderer.invoke('app:gmn-login', payload),
  gmnLogout: () => ipcRenderer.invoke('app:gmn-logout'),
  gmnRefresh: () => ipcRenderer.invoke('app:gmn-refresh'),
  gwenRefresh: () => ipcRenderer.invoke('app:gwen-refresh'),
  openaiRefresh: () => ipcRenderer.invoke('app:openai-refresh'),
  openCodexDir: () => ipcRenderer.invoke('app:open-codex-dir'),
  readLiveFiles: () => ipcRenderer.invoke('app:read-live-files'),
  savePreset: (payload) => ipcRenderer.invoke('app:save-preset', payload),
  savePresetOrder: (order) => ipcRenderer.invoke('app:save-preset-order', order),
  saveFiles: (payload) => ipcRenderer.invoke('app:save-files', payload),
  testProvider: (payload) => ipcRenderer.invoke('app:test-provider', payload)
});
