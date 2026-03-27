const fs = require('node:fs/promises');
const path = require('node:path');

function getPresetOverrideStorePath(userDataDir) {
  return path.join(userDataDir, 'preset-overrides.json');
}

function normalizePresetStore(parsed) {
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return {
      overrides: {},
      customPresets: []
    };
  }

  if ('overrides' in parsed || 'customPresets' in parsed) {
    return {
      overrides:
        parsed.overrides && !Array.isArray(parsed.overrides) && typeof parsed.overrides === 'object'
          ? parsed.overrides
          : {},
      customPresets: Array.isArray(parsed.customPresets) ? parsed.customPresets : []
    };
  }

  return {
    overrides: parsed,
    customPresets: []
  };
}

async function readPresetStore(storePath) {
  try {
    const text = await fs.readFile(storePath, 'utf8');
    return normalizePresetStore(JSON.parse(text));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return normalizePresetStore(null);
    }

    throw error;
  }
}

async function writePresetStore(storePath, store) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

async function readPresetOverrides(storePath) {
  const store = await readPresetStore(storePath);
  return store.overrides;
}

async function savePresetOverride({ id, name, description, configText, authText }, storePath) {
  const store = await readPresetStore(storePath);
  const next = {
    ...store,
    overrides: {
      ...store.overrides,
      [id]: {
        name,
        description,
        configText,
        authText
      }
    }
  };

  await writePresetStore(storePath, next);
  return next.overrides;
}

async function saveCustomPreset(preset, storePath) {
  const store = await readPresetStore(storePath);
  const nextPreset = {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    configText: preset.configText,
    authText: preset.authText,
    isBuiltIn: false
  };
  const customPresets = store.customPresets.filter((item) => item.id !== preset.id);

  customPresets.push(nextPreset);

  const next = {
    ...store,
    customPresets
  };

  await writePresetStore(storePath, next);
  return next;
}

function createCustomPresetId(name, existingPresets = []) {
  const base =
    String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-preset';
  const existingIds = new Set(existingPresets.map((preset) => preset.id));

  if (!existingIds.has(base)) {
    return base;
  }

  let index = 2;
  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

function mergePresetsWithOverrides(presets, storeOrOverrides) {
  const store = normalizePresetStore(storeOrOverrides);
  const mergedBuiltIns = presets.map((preset) => {
    const override = store.overrides[preset.id];

    if (!override) {
      return { ...preset };
    }

    return {
      ...preset,
      name: override.name || preset.name,
      description: override.description || preset.description,
      configText: override.configText,
      authText: override.authText
    };
  });

  return [
    ...mergedBuiltIns,
    ...store.customPresets.map((preset) => ({
      ...preset,
      isBuiltIn: false
    }))
  ];
}

module.exports = {
  createCustomPresetId,
  getPresetOverrideStorePath,
  mergePresetsWithOverrides,
  normalizePresetStore,
  readPresetOverrides,
  readPresetStore,
  saveCustomPreset,
  savePresetOverride
};
