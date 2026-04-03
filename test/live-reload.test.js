const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  DEFAULT_DEBOUNCE_MS,
  buildLiveReloadRoots,
  createLiveReloadWatcher,
  setupLiveReload
} = require('../src/main/live-reload');

test('buildLiveReloadRoots points at renderer and preload source folders', () => {
  const roots = buildLiveReloadRoots('D:/repo/app');

  assert.deepEqual(roots, [
    path.join('D:/repo/app', 'src', 'renderer'),
    path.join('D:/repo/app', 'src', 'preload')
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
