const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const {
  buildClaudeStatePatchText,
  mergeClaudeStatePatch,
  parseJsonObjectSafe,
  sanitizeClaudeStatePatchForStorage,
  summarizeClaudeState
} = require('../shared/claude-config-service');

function getPathApi(homeDir) {
  return String(homeDir || '').includes('\\') ? path.win32 : path.posix;
}

function getClaudePaths(homeDir = os.homedir()) {
  const pathApi = getPathApi(homeDir);
  const claudeDir = pathApi.join(homeDir, '.claude');

  return {
    claudeDir,
    settingsPath: pathApi.join(claudeDir, 'settings.json'),
    statsCachePath: pathApi.join(claudeDir, 'stats-cache.json'),
    statePath: pathApi.join(homeDir, '.claude.json'),
    configPath: pathApi.join(claudeDir, 'settings.json'),
    authPath: pathApi.join(homeDir, '.claude.json')
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

function validateSettingsText(configText) {
  parseJsonObjectSafe(configText);
}

function validateStatePatchText(authText) {
  parseJsonObjectSafe(authText);
}

async function readClaudeFiles(homeDir = os.homedir()) {
  const paths = getClaudePaths(homeDir);
  const [settingsText, stateText] = await Promise.all([
    readTextIfExists(paths.settingsPath),
    readTextIfExists(paths.statePath)
  ]);

  return {
    paths,
    configText: settingsText,
    authText: buildClaudeStatePatchText(stateText),
    summary: summarizeClaudeState({
      settingsText
    })
  };
}

async function saveClaudeFiles({ configText, authText }, homeDir = os.homedir()) {
  validateSettingsText(configText);
  validateStatePatchText(authText);

  const paths = getClaudePaths(homeDir);
  const existingStateText = await readTextIfExists(paths.statePath);
  const nextStateText = mergeClaudeStatePatch({
    existingStateText,
    patchText: sanitizeClaudeStatePatchForStorage(authText)
  });

  await fs.mkdir(paths.claudeDir, { recursive: true });

  await Promise.all([
    fs.writeFile(paths.settingsPath, configText, 'utf8'),
    fs.writeFile(paths.statePath, nextStateText, 'utf8')
  ]);

  return readClaudeFiles(homeDir);
}

module.exports = {
  getClaudePaths,
  readClaudeFiles,
  saveClaudeFiles,
  validateSettingsText,
  validateStatePatchText
};
