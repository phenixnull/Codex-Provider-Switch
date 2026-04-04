const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexApp', {
  bigmodelFetchConsole: () => ipcRenderer.invoke('app:bigmodel-console-refresh'),
  bigmodelReadAuth: () => ipcRenderer.invoke('app:bigmodel-auth-read'),
  bigmodelSaveAuth: (payload) => ipcRenderer.invoke('app:bigmodel-auth-save', payload),
  platform: process.platform,
  refresh92scw: () => ipcRenderer.invoke('app:92scw-refresh'),
  bootstrap: (productId) => ipcRenderer.invoke('app:bootstrap', productId),
  claudePresetUsageRefresh: (payload) => ipcRenderer.invoke('app:claude-preset-usage-refresh', payload),
  createCustomPreset: (payload) => ipcRenderer.invoke('app:create-custom-preset', payload),
  getPreset: (productId, presetId) => ipcRenderer.invoke('app:get-preset', productId, presetId),
  gmnLogin: (payload) => ipcRenderer.invoke('app:gmn-login', payload),
  gmnLogout: () => ipcRenderer.invoke('app:gmn-logout'),
  gmnRefresh: () => ipcRenderer.invoke('app:gmn-refresh'),
  gwenRefresh: () => ipcRenderer.invoke('app:gwen-refresh'),
  openaiRefresh: () => ipcRenderer.invoke('app:openai-refresh'),
  openConfigDir: (productId) => ipcRenderer.invoke('app:open-config-dir', productId),
  openUsageStats: (productId) => ipcRenderer.invoke('app:open-usage-stats', productId),
  quan2goRefresh: () => ipcRenderer.invoke('app:quan2go-refresh'),
  readLiveFiles: (productId) => ipcRenderer.invoke('app:read-live-files', productId),
  savePreset: (payload) => ipcRenderer.invoke('app:save-preset', payload),
  savePresetOrder: (order) => ipcRenderer.invoke('app:save-preset-order', order),
  saveFiles: (payload) => ipcRenderer.invoke('app:save-files', payload),
  testProvider: (payload) => ipcRenderer.invoke('app:test-provider', payload)
});
