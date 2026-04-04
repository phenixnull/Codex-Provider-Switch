const test = require('node:test');
const assert = require('node:assert/strict');

let links = {};

try {
  links = require('../src/main/usage-stats-links');
} catch {
  links = {};
}

test('getUsageStatsTarget returns the official BigModel usage page for Claude', () => {
  assert.equal(typeof links.getUsageStatsTarget, 'function');

  assert.deepEqual(links.getUsageStatsTarget('claude'), {
    label: '查看额度',
    url: 'https://www.bigmodel.cn/usercenter/glm-coding/usage'
  });
});

test('getUsageStatsTarget returns null for Codex', () => {
  assert.equal(typeof links.getUsageStatsTarget, 'function');
  assert.equal(links.getUsageStatsTarget('codex'), null);
});
