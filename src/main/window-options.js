const path = require('node:path');

function getWindowOptions(platform = process.platform) {
  const isMac = platform === 'darwin';
  const isWindows = platform === 'win32';
  const iconPath = path.join(__dirname, '../../assets/codex-provider-switch.ico');

  return {
    width: 1560,
    height: isMac ? 1008 : 980,
    minWidth: 980,
    minHeight: isMac ? 720 : 700,
    autoHideMenuBar: true,
    backgroundColor: '#faf9f5',
    icon: iconPath,
    ...(isWindows
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#f5efe6',
            symbolColor: '#6f6257',
            height: 52
          }
        }
      : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  };
}

module.exports = {
  getWindowOptions
};
