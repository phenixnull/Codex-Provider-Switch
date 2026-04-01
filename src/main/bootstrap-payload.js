function createInitialProviderUsage() {
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
    }
  };
}

async function buildBootstrapPayload({ readMergedPresets, readLiveFiles, getCodexPaths }) {
  const { presets, presetStore } = await readMergedPresets();
  const live = await readLiveFiles();
  const providerUsage = createInitialProviderUsage();

  return {
    paths: getCodexPaths(),
    presets,
    presetOrder: presetStore.presetOrder || [],
    live,
    gmn: providerUsage.gmn,
    providerUsage
  };
}

module.exports = {
  buildBootstrapPayload,
  createInitialProviderUsage
};
