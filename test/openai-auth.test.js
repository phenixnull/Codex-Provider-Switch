const test = require('node:test');
const assert = require('node:assert/strict');

let openAiAuth = {};

try {
  openAiAuth = require('../src/renderer/openai-auth');
} catch {
  openAiAuth = {};
}

test('resolveEditorAuthText prefers the live ChatGPT auth when the official preset only carries the placeholder key', () => {
  assert.equal(typeof openAiAuth.resolveEditorAuthText, 'function');

  const resolved = openAiAuth.resolveEditorAuthText(
    'openai',
    '{\n  "OPENAI_API_KEY": "sk-your-openai-api-key"\n}\n',
    `{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "access_token": "access-123",
    "refresh_token": "refresh-456"
  }
}
`
  );

  assert.match(resolved, /"auth_mode": "chatgpt"/);
  assert.match(resolved, /"access_token": "access-123"/);
});

test('resolveEditorAuthText keeps a real preset API key instead of replacing it with the live auth', () => {
  assert.equal(typeof openAiAuth.resolveEditorAuthText, 'function');

  const resolved = openAiAuth.resolveEditorAuthText(
    'openai',
    '{\n  "OPENAI_API_KEY": "sk-real-key"\n}\n',
    `{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "access_token": "access-123"
  }
}
`
  );

  assert.equal(resolved, '{\n  "OPENAI_API_KEY": "sk-real-key"\n}\n');
});
