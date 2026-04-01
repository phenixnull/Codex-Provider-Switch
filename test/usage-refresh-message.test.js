const test = require('node:test');
const assert = require('node:assert/strict');

let usageRefreshMessage = {};

try {
  usageRefreshMessage = require('../src/renderer/usage-refresh-message');
} catch {
  usageRefreshMessage = {};
}

test('buildUsageRefreshResultMessage returns the explicit sign-in hint for Official when quota is unavailable', () => {
  assert.equal(typeof usageRefreshMessage.buildUsageRefreshResultMessage, 'function');

  const message = usageRefreshMessage.buildUsageRefreshResultMessage('openai', {
    keyOverview: null
  });

  assert.deepEqual(message, {
    text: '未登录，无法读取 Official 限额。',
    tone: 'neutral'
  });
});

test('buildUsageRefreshResultMessage keeps the existing success wording for Official when quota is available', () => {
  assert.equal(typeof usageRefreshMessage.buildUsageRefreshResultMessage, 'function');

  const message = usageRefreshMessage.buildUsageRefreshResultMessage('openai', {
    keyOverview: {
      usageKind: 'chatgpt_rate_limit'
    }
  });

  assert.deepEqual(message, {
    text: 'Official quota refreshed.',
    tone: 'success'
  });
});

test('buildUsageRefreshResultMessage keeps the standard success wording for other providers', () => {
  assert.equal(typeof usageRefreshMessage.buildUsageRefreshResultMessage, 'function');

  const message = usageRefreshMessage.buildUsageRefreshResultMessage('gwen', {
    keyOverview: null
  });

  assert.deepEqual(message, {
    text: 'GWEN quota refreshed.',
    tone: 'success'
  });
});
