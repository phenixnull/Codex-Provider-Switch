const path = require('node:path');

function getWindowOptions(platform = process.platform) {
  const isMac = platform === 'darwin';

  return {
    width: 1560,
    height: isMac ? 1008 : 980,
    minWidth: 980,
    minHeight: isMac ? 720 : 700,
    autoHideMenuBar: true,
    backgroundColor: '#faf9f5',
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
