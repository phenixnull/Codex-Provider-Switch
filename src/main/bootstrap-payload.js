const { DEFAULT_PRODUCT_ID, getProductById } = require('../shared/product-catalog');

function createInitialProviderUsage(productId = DEFAULT_PRODUCT_ID) {
  if (productId !== 'codex') {
    return {};
  }

  return {
    '92scw': {
      keyOverview: null
    },
    gmn: {
      account: '',
      overview: null,
      keyOverview: null
    },
    gwen: {
      keyOverview: null
    },
    openai: {
      keyOverview: null
    },
    quan2go: {
      keyOverview: null
    }
  };
}

async function buildBootstrapPayload({
  productId = DEFAULT_PRODUCT_ID,
  readMergedPresets,
  readLiveFiles,
  getCodexPaths,
  readBigModelAuthSummary = async () => null
}) {
  const { presets, presetStore } = await readMergedPresets();
  const live = await readLiveFiles();
  const providerUsage = createInitialProviderUsage(productId);
  const bigmodelAuth =
    productId === 'claude' ? await readBigModelAuthSummary() : null;

  return {
    productId,
    product: getProductById(productId),
    paths: getCodexPaths(),
    presets,
    presetOrder: presetStore.presetOrder || [],
    live,
    bigmodelAuth,
    gmn: providerUsage.gmn,
    providerUsage
  };
}

module.exports = {
  buildBootstrapPayload,
  createInitialProviderUsage
};
