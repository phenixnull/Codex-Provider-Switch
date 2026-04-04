const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { getWindowOptions } = require('../src/main/window-options');

test('getWindowOptions keeps shared window canvas and light background on Windows', () => {
  const options = getWindowOptions('win32');

  assert.equal(options.width, 1560);
  assert.equal(options.height, 980);
  assert.equal(options.minWidth, 980);
  assert.equal(options.minHeight, 700);
  assert.equal(options.backgroundColor, '#faf9f5');
  assert.equal(options.titleBarStyle, 'hidden');
  assert.deepEqual(options.titleBarOverlay, {
    color: '#f5efe6',
    symbolColor: '#6f6257',
    height: 52
  });
  assert.equal(
    options.icon,
    path.join(__dirname, '../assets/codex-provider-switch.ico')
  );
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(
    options.webPreferences.preload,
    path.join(__dirname, '../src/preload/preload.js')
  );
});

test('getWindowOptions gives mac the same width with extra vertical room', () => {
  const options = getWindowOptions('darwin');

  assert.equal(options.width, 1560);
  assert.equal(options.height, 1008);
  assert.equal(options.minWidth, 980);
  assert.equal(options.minHeight, 720);
  assert.equal(options.backgroundColor, '#faf9f5');
  assert.equal(options.titleBarStyle, undefined);
  assert.equal(options.titleBarOverlay, undefined);
  assert.equal(
    options.icon,
    path.join(__dirname, '../assets/codex-provider-switch.ico')
  );
});
