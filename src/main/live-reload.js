const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DEBOUNCE_MS = 120;

function buildLiveReloadRoots(appPath) {
  return [
    path.join(appPath, 'src', 'main'),
    path.join(appPath, 'src', 'preload'),
    path.join(appPath, 'src', 'renderer'),
  ];
}

function resolveRootAction(root) {
  const normalizedRoot = String(root || '').replace(/\\/g, '/');

  if (normalizedRoot.endsWith('/src/renderer')) {
    return 'reload';
  }

  return 'restart';
}

function createLiveReloadWatcher({
  roots,
  watchImpl = fs.watch,
  reloadWindow,
  restartApp,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
}) {
  if (!Array.isArray(roots) || roots.length === 0 || typeof reloadWindow !== 'function') {
    return () => {};
  }

  const watchers = [];
  let reloadTimer = null;
  let pendingAction = 'reload';

  const scheduleReload = (action = 'reload') => {
    if (action === 'restart') {
      pendingAction = 'restart';
    } else if (!pendingAction) {
      pendingAction = 'reload';
    }

    if (reloadTimer) {
      clearTimeoutImpl(reloadTimer);
    }

    reloadTimer = setTimeoutImpl(() => {
      reloadTimer = null;
      const actionToRun = pendingAction || 'reload';
      pendingAction = 'reload';

      if (actionToRun === 'restart' && typeof restartApp === 'function') {
        restartApp();
        return;
      }

      reloadWindow();
    }, debounceMs);
  };

  for (const root of roots) {
    const watcher = watchImpl(root, { recursive: true }, () => {
      scheduleReload(resolveRootAction(root));
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

function setupLiveReload(window, { appPath, watchImpl = fs.watch, restartApp } = {}) {
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
      },
      restartApp
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
