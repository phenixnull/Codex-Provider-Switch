const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  DEFAULT_DEBOUNCE_MS,
  buildLiveReloadRoots,
  createLiveReloadWatcher,
  setupLiveReload
} = require('../src/main/live-reload');

test('buildLiveReloadRoots points at main, preload, and renderer source folders', () => {
  const roots = buildLiveReloadRoots('D:/repo/app');

  assert.deepEqual(roots, [
    path.join('D:/repo/app', 'src', 'main'),
    path.join('D:/repo/app', 'src', 'preload'),
    path.join('D:/repo/app', 'src', 'renderer'),
  ]);
});

test('createLiveReloadWatcher subscribes to all roots and closes every watcher on cleanup', () => {
  const calls = [];
  const closed = [];

  const stop = createLiveReloadWatcher({
    roots: ['renderer-root', 'preload-root'],
    watchImpl: (root, options, listener) => {
      calls.push({ root, options, listener });
      return {
        close() {
          closed.push(root);
        }
      };
    },
    reloadWindow: () => {}
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((item) => item.root),
    ['renderer-root', 'preload-root']
  );
  assert.ok(calls.every((item) => item.options.recursive === true));

  stop();

  assert.deepEqual(closed, ['renderer-root', 'preload-root']);
});

test('createLiveReloadWatcher debounces multiple file changes into one reload', async () => {
  let listener = null;
  let reloads = 0;

  const stop = createLiveReloadWatcher({
    roots: ['renderer-root'],
    watchImpl: (_root, _options, nextListener) => {
      listener = nextListener;
      return {
        close() {}
      };
    },
    reloadWindow: () => {
      reloads += 1;
    },
    debounceMs: 10
  });

  listener('change', 'renderer.js');
  listener('change', 'styles.css');

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(reloads, 1);
  stop();
});

test('createLiveReloadWatcher prefers a full restart when src/main changes', async () => {
  let listener = null;
  let reloads = 0;
  let restarts = 0;

  const stop = createLiveReloadWatcher({
    roots: ['renderer-root', 'main-root'],
    watchImpl: (root, _options, nextListener) => {
      if (root === 'main-root') {
        listener = nextListener;
      }

      return {
        close() {}
      };
    },
    reloadWindow: () => {
      reloads += 1;
    },
    restartApp: () => {
      restarts += 1;
    },
    debounceMs: 10
  });

  listener('change', 'main.js');
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(reloads, 0);
  assert.equal(restarts, 1);
  stop();
});

test('setupLiveReload reloads the BrowserWindow when a watched file changes', async () => {
  let listener = null;
  let reloadCalls = 0;

  const stop = setupLiveReload(
    {
      isDestroyed: () => false,
      webContents: {
        reloadIgnoringCache() {
          reloadCalls += 1;
        }
      }
    },
    {
      appPath: 'D:/repo/app',
      watchImpl: (_root, _options, nextListener) => {
        listener = nextListener;
        return {
          close() {}
        };
      }
    }
  );

  assert.equal(typeof listener, 'function');

  listener('change', 'renderer.js');
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_DEBOUNCE_MS + 40));

  assert.equal(reloadCalls, 1);
  stop();
});

test('setupLiveReload restarts the app when a main-process file changes', async () => {
  let listeners = [];
  let restartCalls = 0;

  const stop = setupLiveReload(
    {
      isDestroyed: () => false,
      webContents: {
        reloadIgnoringCache() {}
      }
    },
    {
      appPath: 'D:/repo/app',
      restartApp: () => {
        restartCalls += 1;
      },
      watchImpl: (_root, _options, nextListener) => {
        listeners.push(nextListener);
        return {
          close() {}
        };
      }
    }
  );

  const mainListener = listeners[0];
  assert.equal(typeof mainListener, 'function');

  mainListener('change', 'main.js');
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_DEBOUNCE_MS + 40));

  assert.equal(restartCalls, 1);
  stop();
});
