const DEFAULT_PRODUCT_ID = 'codex';

const PRODUCT_CATALOG = [
  {
    id: 'codex',
    name: 'Codex',
    displayName: 'Codex',
    folderName: '.codex',
    configFileLabel: 'config.toml',
    authFileLabel: 'auth.json',
    supportsProviderTest: true,
    supportsUsageCards: true,
    supportsUsageStats: false,
    usageStatsUrl: ''
  },
  {
    id: 'claude',
    name: 'Claude Code',
    displayName: 'Claude',
    folderName: '.claude',
    configFileLabel: 'settings.json',
    authFileLabel: '.claude.json patch',
    supportsProviderTest: false,
    supportsUsageCards: false,
    supportsUsageStats: true,
    usageStatsUrl: 'https://www.bigmodel.cn/usercenter/glm-coding/usage'
  }
];

function cloneProduct(product) {
  return {
    ...product
  };
}

function listProducts() {
  return PRODUCT_CATALOG.map(cloneProduct);
}

function getProductById(productId = DEFAULT_PRODUCT_ID) {
  const product = PRODUCT_CATALOG.find((item) => item.id === productId);
  return product ? cloneProduct(product) : null;
}

module.exports = {
  DEFAULT_PRODUCT_ID,
  getProductById,
  listProducts
};
