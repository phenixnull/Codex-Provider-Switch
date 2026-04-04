const test = require('node:test');
const assert = require('node:assert/strict');

let service = {};

try {
  service = require('../src/shared/claude-config-service');
} catch {
  service = {};
}

const claudeSettingsText = `{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "abc1234567890secret",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "GLM-5.1",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "GLM-5.1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "GLM-4.5-air",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
`;

const claudeStateText = `{
  "hasCompletedOnboarding": true,
  "numStartups": 42,
  "projects": {
    "/work/example": {
      "allowedTools": []
    }
  }
}
`;

test('detectActiveClaudePresetId identifies the BigModel GLM-5.1 Claude preset', () => {
  assert.equal(typeof service.detectActiveClaudePresetId, 'function');
  assert.equal(service.detectActiveClaudePresetId(claudeSettingsText), 'claude-glm-5-1');
});

test('buildClaudeStatePatchText keeps only the safe onboarding patch for preset storage', () => {
  assert.equal(typeof service.buildClaudeStatePatchText, 'function');
  assert.equal(service.buildClaudeStatePatchText(claudeStateText), '{\n  "hasCompletedOnboarding": true\n}\n');
});

test('mergeClaudeStatePatch preserves existing local state while applying the incoming patch', () => {
  assert.equal(typeof service.mergeClaudeStatePatch, 'function');

  const merged = JSON.parse(
    service.mergeClaudeStatePatch({
      existingStateText: claudeStateText,
      patchText: '{\n  "hasCompletedOnboarding": false\n}\n'
    })
  );

  assert.equal(merged.hasCompletedOnboarding, false);
  assert.equal(merged.numStartups, 42);
  assert.deepEqual(merged.projects, {
    '/work/example': {
      allowedTools: []
    }
  });
});

test('summarizeClaudeState exposes the active model and masked auth token', () => {
  assert.equal(typeof service.summarizeClaudeState, 'function');

  const summary = service.summarizeClaudeState({
    settingsText: claudeSettingsText,
    stateText: claudeStateText
  });

  assert.equal(summary.providerId, 'claude-glm-5-1');
  assert.equal(summary.model, 'GLM-5.1');
  assert.equal(summary.maskedKey, 'abc1234...cret');
});
