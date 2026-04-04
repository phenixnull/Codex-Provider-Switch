const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let fileStore = {};

try {
  fileStore = require('../src/main/claude-files');
} catch {
  fileStore = {};
}

test('getClaudePaths builds the expected Windows-style Claude file paths', () => {
  assert.equal(typeof fileStore.getClaudePaths, 'function');

  const paths = fileStore.getClaudePaths('C:\\Users\\Administrator');

  assert.equal(paths.claudeDir, 'C:\\Users\\Administrator\\.claude');
  assert.equal(paths.settingsPath, 'C:\\Users\\Administrator\\.claude\\settings.json');
  assert.equal(paths.statsCachePath, 'C:\\Users\\Administrator\\.claude\\stats-cache.json');
  assert.equal(paths.statePath, 'C:\\Users\\Administrator\\.claude.json');
});

test('getClaudePaths builds the expected POSIX-style Claude file paths', () => {
  assert.equal(typeof fileStore.getClaudePaths, 'function');

  const paths = fileStore.getClaudePaths('/Users/example');

  assert.equal(paths.claudeDir, '/Users/example/.claude');
  assert.equal(paths.settingsPath, '/Users/example/.claude/settings.json');
  assert.equal(paths.statsCachePath, '/Users/example/.claude/stats-cache.json');
  assert.equal(paths.statePath, '/Users/example/.claude.json');
});

test('saveClaudeFiles writes settings.json and merges the .claude.json patch without dropping existing state', async () => {
  assert.equal(typeof fileStore.saveClaudeFiles, 'function');
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-provider-switch-claude-'));
  const claudeDir = path.join(tempHome, '.claude');
  const statePath = path.join(tempHome, '.claude.json');

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    statePath,
    '{\n  "hasCompletedOnboarding": false,\n  "projects": {\n    "/existing": {\n      "allowedTools": []\n    }\n  }\n}\n',
    'utf8'
  );

  await fileStore.saveClaudeFiles(
    {
      configText: '{\n  "env": {\n    "ANTHROPIC_AUTH_TOKEN": "token-123",\n    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",\n    "ANTHROPIC_DEFAULT_OPUS_MODEL": "GLM-5.1"\n  }\n}\n',
      authText: '{\n  "hasCompletedOnboarding": true\n}\n'
    },
    tempHome
  );

  const savedSettingsText = fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8');
  const savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));

  assert.match(savedSettingsText, /"ANTHROPIC_BASE_URL": "https:\/\/open\.bigmodel\.cn\/api\/anthropic"/);
  assert.equal(savedState.hasCompletedOnboarding, true);
  assert.deepEqual(savedState.projects, {
    '/existing': {
      allowedTools: []
    }
  });

  fs.rmSync(tempHome, { recursive: true, force: true });
});
