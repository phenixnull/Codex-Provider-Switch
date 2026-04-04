const test = require('node:test');
const assert = require('node:assert/strict');

let productCatalog = {};

try {
  productCatalog = require('../src/shared/product-catalog');
} catch {
  productCatalog = {};
}

test('product catalog exposes Codex and Claude with distinct capability flags', () => {
  assert.equal(typeof productCatalog.listProducts, 'function');
  assert.equal(typeof productCatalog.getProductById, 'function');

  const ids = productCatalog.listProducts().map((product) => product.id);
  const codex = productCatalog.getProductById('codex');
  const claude = productCatalog.getProductById('claude');

  assert.deepEqual(ids, ['codex', 'claude']);
  assert.equal(codex.supportsProviderTest, true);
  assert.equal(codex.supportsUsageCards, true);
  assert.equal(claude.supportsProviderTest, false);
  assert.equal(claude.supportsUsageCards, false);
  assert.equal(claude.configFileLabel, 'settings.json');
  assert.equal(claude.authFileLabel, '.claude.json patch');
  assert.equal(claude.supportsUsageStats, true);
  assert.equal(claude.usageStatsUrl, 'https://www.bigmodel.cn/usercenter/glm-coding/usage');
});
