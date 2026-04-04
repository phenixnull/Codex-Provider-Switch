const fs = require('node:fs/promises');
const path = require('node:path');

const { maskKey } = require('../shared/config-service');

const EMPTY_BIGMODEL_AUTH = Object.freeze({
  username: '',
  password: '',
  apiKey: '',
  organizationId: '',
  projectId: ''
});

function getBigModelAuthStorePath(userDataDir) {
  return path.join(userDataDir, 'bigmodel-auth.json');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripUtf8Bom(text) {
  return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
}

function normalizeBigModelAuth(parsed) {
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return {
      ...EMPTY_BIGMODEL_AUTH
    };
  }

  return {
    username: normalizeString(parsed.username),
    password: normalizeString(parsed.password),
    apiKey: normalizeString(parsed.apiKey),
    organizationId: normalizeString(parsed.organizationId),
    projectId: normalizeString(parsed.projectId)
  };
}

async function readBigModelAuth(storePath) {
  try {
    const text = stripUtf8Bom(await fs.readFile(storePath, 'utf8'));
    return normalizeBigModelAuth(JSON.parse(text));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return normalizeBigModelAuth(null);
    }

    throw error;
  }
}

function mergeSecretField(currentValue, nextValue) {
  const normalizedNextValue = normalizeString(nextValue);
  return normalizedNextValue || normalizeString(currentValue);
}

async function saveBigModelAuth(patch, storePath) {
  const current = await readBigModelAuth(storePath);
  const normalizedPatch = normalizeBigModelAuth(patch);
  const next = {
    username: normalizedPatch.username || current.username,
    password: mergeSecretField(current.password, normalizedPatch.password),
    apiKey: mergeSecretField(current.apiKey, normalizedPatch.apiKey),
    organizationId: normalizedPatch.organizationId || current.organizationId,
    projectId: normalizedPatch.projectId || current.projectId
  };

  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  return next;
}

function summarizeBigModelAuth(auth) {
  const normalized = normalizeBigModelAuth(auth);

  return {
    username: normalized.username,
    hasPassword: !!normalized.password,
    maskedApiKey: maskKey(normalized.apiKey),
    organizationId: normalized.organizationId,
    projectId: normalized.projectId
  };
}

module.exports = {
  EMPTY_BIGMODEL_AUTH,
  getBigModelAuthStorePath,
  normalizeBigModelAuth,
  readBigModelAuth,
  saveBigModelAuth,
  stripUtf8Bom,
  summarizeBigModelAuth
};
