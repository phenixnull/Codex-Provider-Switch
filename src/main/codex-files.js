const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const TOML = require('@iarna/toml');

const { summarizeCurrentState } = require('../shared/config-service');

function getCodexPaths(homeDir = os.homedir()) {
  const codexDir = path.join(homeDir, '.codex');

  return {
    codexDir,
    configPath: path.join(codexDir, 'config.toml'),
    authPath: path.join(codexDir, 'auth.json')
  };
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function validateConfigText(configText) {
  TOML.parse(configText);
}

function validateAuthText(authText) {
  const parsed = JSON.parse(authText);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('auth.json must contain a JSON object.');
  }
}

async function readCodexFiles(homeDir = os.homedir()) {
  const paths = getCodexPaths(homeDir);
  const [configText, authText] = await Promise.all([
    readTextIfExists(paths.configPath),
    readTextIfExists(paths.authPath)
  ]);

  return {
    paths,
    configText,
    authText,
    summary: summarizeCurrentState({ configText, authJsonText: authText })
  };
}

async function saveCodexFiles({ configText, authText }, homeDir = os.homedir()) {
  validateConfigText(configText);
  validateAuthText(authText);

  const paths = getCodexPaths(homeDir);
  await fs.mkdir(paths.codexDir, { recursive: true });

  await Promise.all([
    fs.writeFile(paths.configPath, configText, 'utf8'),
    fs.writeFile(paths.authPath, authText, 'utf8')
  ]);

  return readCodexFiles(homeDir);
}

module.exports = {
  getCodexPaths,
  readCodexFiles,
  saveCodexFiles,
  validateAuthText,
  validateConfigText
};
