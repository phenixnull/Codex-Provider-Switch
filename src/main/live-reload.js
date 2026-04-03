const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DEBOUNCE_MS = 120;

function buildLiveReloadRoots(appPath) {
  return [
    path.join(appPath, 'src', 'renderer'),
    path.join(appPath, 'src', 'preload')
  ];
}

function createLiveReloadWatcher({
  roots,
  watchImpl = fs.watch,
  reloadWindow,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
}) {
  if (!Array.isArray(roots) || roots.length === 0 || typeof reloadWindow !== 'function') {
    return () => {};
  }

  const watchers = [];
  let reloadTimer = null;

  const scheduleReload = () => {
    if (reloadTimer) {
      clearTimeoutImpl(reloadTimer);
    }

    reloadTimer = setTimeoutImpl(() => {
      reloadTimer = null;
      reloadWindow();
    }, debounceMs);
  };

  for (const root of roots) {
    const watcher = watchImpl(root, { recursive: true }, () => {
      scheduleReload();
    });
    watchers.push(watcher);
  }

  return () => {
    if (reloadTimer) {
      clearTimeoutImpl(reloadTimer);
      reloadTimer = null;
    }

    for (const watcher of watchers) {
      watcher?.close?.();
    }
  };
}

function setupLiveReload(window, { appPath, watchImpl = fs.watch } = {}) {
  if (!window || typeof window.isDestroyed !== 'function') {
    return () => {};
  }

  const roots = buildLiveReloadRoots(appPath || process.cwd());

  try {
    return createLiveReloadWatcher({
      roots,
      watchImpl,
      reloadWindow: () => {
        if (window.isDestroyed()) {
          return;
        }

        window.webContents.reloadIgnoringCache();
      }
    });
  } catch {
    return () => {};
  }
}

module.exports = {
  DEFAULT_DEBOUNCE_MS,
  buildLiveReloadRoots,
  createLiveReloadWatcher,
  setupLiveReload
};
