const test = require('node:test');
const assert = require('node:assert/strict');
const TOML = require('@iarna/toml');

let service = {};

try {
  service = require('../src/shared/config-service');
} catch {
  service = {};
}

const config92scw = `
model_provider = "codex"
model = "gpt-5.4"

[model_providers.codex]
name = "codex"
base_url = "http://92scw.cn/v1"
wire_api = "responses"
requires_openai_auth = true
`;

const configGmn = `
model_provider = "codex"
model = "gpt-5.4"

[model_providers.codex]
name = "codex"
base_url = "https://gmn.chuangzuoli.com"
wire_api = "responses"
requires_openai_auth = true
`;

const configGwen = `
model_provider = "gwen"
model = "gpt-5.4"

[model_providers.gwen]
name = "gwen"
base_url = "https://ai.love-gwen.top/openai"
wire_api = "responses"
requires_openai_auth = true
`;

const configOpenAi = `
model_provider = "openai"
model = "gpt-5.4"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
`;

const configQuan2Go = `
model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"

[model_providers.OpenAI]
name = "OpenAI"
base_url = "https://capi.quan2go.com/openai"
wire_api = "responses"
requires_openai_auth = true
`;

const existingConfigWithProjects = `
model_provider = "codex"
model = "gpt-5.4"

[model_providers.codex]
name = "codex"
base_url = "http://92scw.cn/v1"
wire_api = "responses"
requires_openai_auth = true

[projects.'C:\\\\Users\\\\Administrator']
trust_level = "trusted"

[projects.'D:\\\\Users\\\\Administrator\\\\Desktop\\\\2025-CommercialOrder\\\\OnGoingOrders\\\\Codex-Provider-Switch']
trust_level = "trusted"
`;

const presetWithoutProjects = `
model_provider = "openai"
model = "gpt-5.4"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
`;

test('detectActiveProviderId identifies the 92scw preset', () => {
  assert.equal(typeof service.detectActiveProviderId, 'function');
  assert.equal(service.detectActiveProviderId(config92scw), '92scw');
});

test('detectActiveProviderId identifies the GMN preset', () => {
  assert.equal(typeof service.detectActiveProviderId, 'function');
  assert.equal(service.detectActiveProviderId(configGmn), 'gmn');
});

test('detectActiveProviderId identifies the Gwen preset', () => {
  assert.equal(typeof service.detectActiveProviderId, 'function');
  assert.equal(service.detectActiveProviderId(configGwen), 'gwen');
});

test('detectActiveProviderId identifies the official OpenAI preset', () => {
  assert.equal(typeof service.detectActiveProviderId, 'function');
  assert.equal(service.detectActiveProviderId(configOpenAi), 'openai');
});

test('detectActiveProviderId identifies the Quan2Go relay preset by base URL', () => {
  assert.equal(typeof service.detectActiveProviderId, 'function');
  assert.equal(service.detectActiveProviderId(configQuan2Go), 'quan2go');
});

test('mergePresetWithExistingConfig preserves existing trusted projects', () => {
  assert.equal(typeof service.mergePresetWithExistingConfig, 'function');
  const merged = service.mergePresetWithExistingConfig(
    presetWithoutProjects,
    existingConfigWithProjects
  );
  const parsed = TOML.parse(merged);
  const projectKeys = Object.keys(parsed.projects || {});
  const projectValues = Object.values(parsed.projects || {});

  assert.equal(projectKeys.length, 2);
  assert.ok(projectValues.every((entry) => entry.trust_level === 'trusted'));
  assert.match(merged, /model_provider = "openai"/);
  assert.doesNotMatch(merged, /base_url = "http:\/\/92scw\.cn\/v1"/);
});

test('buildAuthJson serializes the selected key into auth.json format', () => {
  assert.equal(typeof service.buildAuthJson, 'function');
  assert.equal(
    service.buildAuthJson('sk-example-key'),
    '{\n  "OPENAI_API_KEY": "sk-example-key"\n}\n'
  );
});

test('extractApiKey returns the OPENAI_API_KEY from auth.json text', () => {
  assert.equal(typeof service.extractApiKey, 'function');
  assert.equal(
    service.extractApiKey('{\n  "OPENAI_API_KEY": "sk-1234567890abcdef"\n}\n'),
    'sk-1234567890abcdef'
  );
  assert.equal(service.extractApiKey('{\n  "OTHER": "value"\n}\n'), '');
});

test('summarizeCurrentState exposes provider, model and masked key', () => {
  assert.equal(typeof service.summarizeCurrentState, 'function');
  const summary = service.summarizeCurrentState({
    configText: config92scw,
    authJsonText: '{\n  "OPENAI_API_KEY": "sk-1234567890abcdef"\n}'
  });

  assert.equal(summary.providerId, '92scw');
  assert.equal(summary.model, 'gpt-5.4');
  assert.equal(summary.maskedKey, 'sk-1234...cdef');
});

test('resolveAuthJsonForSave preserves an existing ChatGPT sign-in auth.json for official OpenAI when the incoming auth is only a placeholder key', () => {
  assert.equal(typeof service.resolveAuthJsonForSave, 'function');

  const existingAuthJsonText = `{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "access_token": "access-123",
    "refresh_token": "refresh-456"
  }
}
`;

  const resolved = service.resolveAuthJsonForSave({
    configText: configOpenAi,
    authJsonText: '{\n  "OPENAI_API_KEY": "sk-your-openai-api-key"\n}\n',
    existingAuthJsonText
  });

  assert.equal(resolved, existingAuthJsonText);
});

test('sanitizePresetAuthTextForStorage strips ChatGPT sign-in tokens before preset persistence', () => {
  assert.equal(typeof service.sanitizePresetAuthTextForStorage, 'function');

  const sanitized = service.sanitizePresetAuthTextForStorage({
    configText: configOpenAi,
    authJsonText: `{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "access_token": "access-123",
    "refresh_token": "refresh-456"
  }
}
`
  });

  assert.equal(sanitized, '{\n  "OPENAI_API_KEY": "sk-your-openai-api-key"\n}\n');
});
