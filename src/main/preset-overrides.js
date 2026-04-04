const fs = require('node:fs/promises');
const path = require('node:path');
const { sanitizePresetAuthTextForStorage } = require('../shared/config-service');
const { sanitizeClaudeStatePatchForStorage } = require('../shared/claude-config-service');
const { isLegacyPresetDescription } = require('../shared/presets');

function getPresetOverrideStorePath(userDataDir) {
  return path.join(userDataDir, 'preset-overrides.json');
}

function normalizePresetStore(parsed) {
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return {
      overrides: {},
      customPresets: [],
      presetOrder: []
    };
  }

  if ('overrides' in parsed || 'customPresets' in parsed || 'presetOrder' in parsed) {
    return {
      overrides:
        parsed.overrides && !Array.isArray(parsed.overrides) && typeof parsed.overrides === 'object'
          ? parsed.overrides
          : {},
      customPresets: Array.isArray(parsed.customPresets) ? parsed.customPresets : [],
      presetOrder: Array.isArray(parsed.presetOrder) ? parsed.presetOrder : []
    };
  }

  return {
    overrides: parsed,
    customPresets: [],
    presetOrder: []
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

async function savePresetOverride(
  { id, productId, name, description, configText, authText },
  storePath
) {
  const store = await readPresetStore(storePath);
  const safeAuthText =
    productId === 'claude'
      ? sanitizeClaudeStatePatchForStorage(authText)
      : sanitizePresetAuthTextForStorage({
          configText,
          authJsonText: authText
        });
  const next = {
    ...store,
    overrides: {
      ...store.overrides,
      [id]: {
        name,
        description,
        configText,
        authText: safeAuthText,
        ...(productId ? { productId } : {})
      }
    }
  };

  await writePresetStore(storePath, next);
  return next.overrides;
}

async function saveCustomPreset(preset, storePath) {
  const store = await readPresetStore(storePath);
  const productId = preset.productId || 'codex';
  const safeAuthText =
    productId === 'claude'
      ? sanitizeClaudeStatePatchForStorage(preset.authText)
      : sanitizePresetAuthTextForStorage({
          configText: preset.configText,
          authJsonText: preset.authText
        });
  const nextPreset = {
    id: preset.id,
    productId,
    name: preset.name,
    description: preset.description,
    configText: preset.configText,
    authText: safeAuthText,
    isBuiltIn: false
  };
  const customPresets = store.customPresets.filter(
    (item) => !(item.id === preset.id && (item.productId || 'codex') === productId)
  );

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

async function savePresetOrder(order, storePath) {
  const store = await readPresetStore(storePath);
  const next = {
    ...store,
    presetOrder: Array.isArray(order) ? order : []
  };

  await writePresetStore(storePath, next);
  return next.presetOrder;
}

function mergePresetsWithOverrides(presets, storeOrOverrides) {
  const store = normalizePresetStore(storeOrOverrides);
  const targetProductIds = new Set(
    presets.map((preset) => preset.productId).filter((productId) => !!productId)
  );
  const builtInPresetKeys = new Set(
    presets.map((preset) => `${preset.productId || 'codex'}:${preset.id}`)
  );
  const mergedBuiltIns = presets.map((preset) => {
    const override = store.overrides[preset.id];
    const overrideProductId = override?.productId || 'codex';

    if (
      !override ||
      (targetProductIds.size > 0 && preset.productId && !targetProductIds.has(overrideProductId))
    ) {
      return { ...preset };
    }

    return {
      ...preset,
      name: override.name || preset.name,
      description:
        override.description && !isLegacyPresetDescription(preset.id, override.description)
          ? override.description
          : preset.description,
      configText: override.configText,
      authText: override.authText
    };
  });

  return [
    ...mergedBuiltIns,
    ...store.customPresets
      .filter((preset) => {
        const productId = preset.productId || 'codex';

        if (targetProductIds.size === 0) {
          return !builtInPresetKeys.has(`${productId}:${preset.id}`);
        }

        return targetProductIds.has(productId) && !builtInPresetKeys.has(`${productId}:${preset.id}`);
      })
      .map((preset) => ({
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
  savePresetOrder,
  savePresetOverride
};
