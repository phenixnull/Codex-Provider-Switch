const test = require('node:test');
const assert = require('node:assert/strict');

const { getPresetById } = require('../src/shared/presets');

let providerTester = {};

try {
  providerTester = require('../src/main/provider-tester');
} catch {
  providerTester = {};
}

test('buildProviderTestRequest builds a responses endpoint from custom provider config', () => {
  assert.equal(typeof providerTester.buildProviderTestRequest, 'function');

  const preset = getPresetById('92scw');
  const request = providerTester.buildProviderTestRequest({
    configText: preset.configText,
    authText: preset.authText
  });

  assert.equal(request.endpoint, 'http://92scw.cn/v1/responses');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization.startsWith('Bearer sk-'), true);
  assert.equal(request.body.model, 'gpt-5.4');
  assert.match(request.body.input, /provider test ok/i);
});

test('buildProviderTestRequest falls back to official OpenAI endpoint for openai provider', () => {
  assert.equal(typeof providerTester.buildProviderTestRequest, 'function');

  const preset = getPresetById('openai');
  const request = providerTester.buildProviderTestRequest({
    configText: preset.configText,
    authText: preset.authText
  });

  assert.equal(request.endpoint, 'https://api.openai.com/v1/responses');
  assert.equal(request.body.model, 'gpt-5.4');
});

test('testProviderConnection returns output_text on success', async () => {
  assert.equal(typeof providerTester.testProviderConnection, 'function');

  const preset = getPresetById('gmn');
  const result = await providerTester.testProviderConnection({
    configText: preset.configText,
    authText: preset.authText,
    fetchImpl: async (url, options) => {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 'resp_123',
            output_text: 'provider test ok'
          };
        }
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.outputText, 'provider test ok');
  assert.equal(result.responseId, 'resp_123');
});

test('testProviderConnection surfaces HTTP errors with provider response details', async () => {
  assert.equal(typeof providerTester.testProviderConnection, 'function');

  const preset = getPresetById('gwen');

  await assert.rejects(
    providerTester.testProviderConnection({
      configText: preset.configText,
      authText: preset.authText,
      fetchImpl: async () => {
        return {
          ok: false,
          status: 401,
          async json() {
            return {
              error: {
                message: 'invalid api key'
              }
            };
          }
        };
      }
    }),
    /401.*invalid api key/i
  );
});

test('testProviderConnection falls back to PowerShell on Windows when Node fetch is blocked by openresty', async () => {
  assert.equal(typeof providerTester.testProviderConnection, 'function');

  const preset = getPresetById('gwen');
  let powershellCalls = 0;

  const result = await providerTester.testProviderConnection({
    configText: preset.configText,
    authText: preset.authText,
    platform: 'win32',
    fetchImpl: async () => {
      return {
        ok: false,
        status: 403,
        async text() {
          return '<html><center><h1>403 Forbidden</h1></center><hr><center>openresty</center></html>';
        }
      };
    },
    powershellImpl: async (request) => {
      powershellCalls += 1;
      assert.equal(request.endpoint, 'https://ai.love-gwen.top/openai/responses');

      return {
        status: 200,
        payload: {
          id: 'resp_ps_123',
          output_text: 'provider test ok'
        }
      };
    }
  });

  assert.equal(powershellCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.responseId, 'resp_ps_123');
  assert.equal(result.outputText, 'provider test ok');
});
