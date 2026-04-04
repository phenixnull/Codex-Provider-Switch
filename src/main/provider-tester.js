const TOML = require('@iarna/toml');
const { execFile } = require('node:child_process');

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const TEST_PROMPT = 'Reply with exactly: provider test ok';

function parseConfigAndAuth({ configText, authText }) {
  const config = TOML.parse(configText);
  const auth = JSON.parse(authText);

  return { config, auth };
}

function trimTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}

function resolveBaseUrl(config) {
  const providerId = config.model_provider;
  const providerMap = config.model_providers || {};
  const provider = providerMap[providerId];

  if (provider && provider.base_url) {
    return trimTrailingSlashes(provider.base_url);
  }

  if (providerId === 'openai') {
    return DEFAULT_OPENAI_BASE_URL;
  }

  throw new Error(`Unsupported provider "${providerId}" for online test.`);
}

function resolveWireApi(config) {
  const providerId = config.model_provider;
  const providerMap = config.model_providers || {};
  const provider = providerMap[providerId];

  if (!provider || !provider.wire_api) {
    return 'responses';
  }

  return provider.wire_api;
}

function resolveQuan2GoTestEndpoint(baseUrl) {
  try {
    return new URL('/v1/chat/completions', `${baseUrl}/`).toString();
  } catch {
    return `${trimTrailingSlashes(baseUrl).replace(/\/openai$/i, '')}/v1/chat/completions`;
  }
}

function buildProviderTestRequest({ configText, authText }) {
  const { config, auth } = parseConfigAndAuth({ configText, authText });
  const apiKey = auth.OPENAI_API_KEY;

  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('auth.json must contain OPENAI_API_KEY.');
  }

  if (!config.model || typeof config.model !== 'string') {
    throw new Error('config.toml must contain model.');
  }

  const wireApi = resolveWireApi(config);
  const baseUrl = resolveBaseUrl(config);
  const providerId = config.model_provider || 'unknown';

  if (providerId === 'quan2go') {
    return {
      providerId,
      baseUrl,
      endpoint: resolveQuan2GoTestEndpoint(baseUrl),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: TEST_PROMPT
          }
        ],
        temperature: 0,
        stream: false
      }
    };
  }

  if (wireApi !== 'responses') {
    throw new Error(`Only responses wire_api is supported for online test. Got "${wireApi}".`);
  }

  return {
    providerId,
    baseUrl,
    endpoint: `${baseUrl}/responses`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: {
      model: config.model,
      input: TEST_PROMPT
    }
  };
}

function extractProviderResponseText(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chatCompletionsText = extractChatCompletionsText(payload);

  if (chatCompletionsText) {
    return chatCompletionsText;
  }

  if (!Array.isArray(payload.output)) {
    return '';
  }

  const parts = [];

  for (const item of payload.output) {
    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        parts.push(contentItem.text.trim());
      }
    }
  }

  return parts.join('\n').trim();
}

function extractChatCompletionsText(payload) {
  if (!Array.isArray(payload?.choices)) {
    return '';
  }

  const parts = [];

  for (const choice of payload.choices) {
    if (typeof choice?.message?.content === 'string' && choice.message.content) {
      parts.push(choice.message.content);
      continue;
    }

    if (typeof choice?.delta?.content === 'string' && choice.delta.content) {
      parts.push(choice.delta.content);
    }
  }

  return parts.join('').trim();
}

function extractErrorMessage(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload?.error?.message === 'string') {
    return payload.error.message;
  }

  if (typeof payload?.message === 'string') {
    return payload.message;
  }

  return JSON.stringify(payload);
}

function buildSuccessResult({ request, payload, status }) {
  return {
    ok: true,
    status,
    endpoint: request.endpoint,
    model: request.body.model,
    providerId: request.providerId,
    responseId: payload && typeof payload === 'object' ? payload.id || '' : '',
    outputText: extractProviderResponseText(payload),
    raw: payload
  };
}

function parseEventStreamPayload(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }

  const events = text.split(/\r?\n\r?\n/);
  const contentParts = [];
  let responseId = '';
  let model = '';

  for (const event of events) {
    const lines = event
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const dataLines = lines.filter((line) => line.startsWith('data:'));

    if (dataLines.length === 0) {
      continue;
    }

    for (const line of dataLines) {
      const data = line.slice(5).trim();

      if (!data || data === '[DONE]') {
        continue;
      }

      let payload = null;

      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }

      if (!responseId && typeof payload.id === 'string') {
        responseId = payload.id;
      }

      if (!model && typeof payload.model === 'string') {
        model = payload.model;
      }

      if (Array.isArray(payload.choices)) {
        for (const choice of payload.choices) {
          if (typeof choice?.message?.content === 'string' && choice.message.content) {
            contentParts.push(choice.message.content);
            continue;
          }

          if (typeof choice?.delta?.content === 'string' && choice.delta.content) {
            contentParts.push(choice.delta.content);
          }
        }
      }
    }
  }

  if (!responseId && !model && contentParts.length === 0) {
    return null;
  }

  return {
    id: responseId,
    model,
    output_text: contentParts.join('').trim()
  };
}

function isOpenRestyHtmlBlock(payload) {
  return typeof payload === 'string' && /403 Forbidden/i.test(payload) && /openresty/i.test(payload);
}

function shouldUsePowerShellFallback({ platform, status, payload }) {
  return platform === 'win32' && status === 403 && isOpenRestyHtmlBlock(payload);
}

function encodePowerShellCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function decodeFromBase64InPowerShell(value) {
  return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${Buffer.from(
    value,
    'utf8'
  ).toString('base64')}'))`;
}

function execFileAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runPowerShellProviderTest(request, timeoutMs) {
  const endpointExpr = decodeFromBase64InPowerShell(request.endpoint);
  const apiKeyExpr = decodeFromBase64InPowerShell(
    request.headers.Authorization.replace(/^Bearer\s+/i, '')
  );
  const modelExpr = decodeFromBase64InPowerShell(request.body.model);
  const inputExpr = decodeFromBase64InPowerShell(request.body.input);
  const timeoutSeconds = Math.max(5, Math.ceil(timeoutMs / 1000));

  const script = `
$endpoint = ${endpointExpr}
$apiKey = ${apiKeyExpr}
$model = ${modelExpr}
$input = ${inputExpr}
$headers = @{
  Authorization = "Bearer $apiKey"
  'Content-Type' = 'application/json'
}
$body = @{
  model = $model
  input = $input
} | ConvertTo-Json -Depth 10
try {
  $response = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $body -TimeoutSec ${timeoutSeconds}
  @{
    ok = $true
    status = 200
    payload = $response
  } | ConvertTo-Json -Depth 100 -Compress
} catch {
  $status = 0
  try {
    $status = [int]$_.Exception.Response.StatusCode.value__
  } catch {
  }
  $detail = $_.ErrorDetails.Message
  if (-not $detail) {
    $detail = $_.Exception.Message
  }
  @{
    ok = $false
    status = $status
    error = $detail
  } | ConvertTo-Json -Depth 20 -Compress
  exit 1
}
`.trim();

  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    encodePowerShellCommand(script)
  ];

  let stdout = '';

  try {
    const result = await execFileAsync('powershell.exe', args, {
      windowsHide: true,
      timeout: timeoutMs + 2000,
      maxBuffer: 1024 * 1024 * 5
    });

    stdout = result.stdout;
  } catch (error) {
    stdout = error.stdout || '';

    if (!stdout.trim()) {
      throw error;
    }
  }

  const parsed = JSON.parse(stdout.trim());

  if (!parsed.ok) {
    const error = new Error(
      `Provider test failed (${parsed.status || 0}): ${parsed.error || 'Unknown provider error.'}`
    );
    error.status = parsed.status || 0;
    error.outputText = parsed.error || '';
    throw error;
  }

  return {
    status: parsed.status || 200,
    payload: parsed.payload || null
  };
}

async function parseResponsePayload(response) {
  if (typeof response.text === 'function') {
    const text = await response.text();

    if (!text) {
      return null;
    }

    const contentType =
      typeof response?.headers?.get === 'function' ? String(response.headers.get('content-type')) : '';

    if (contentType.includes('text/event-stream') || text.trim().startsWith('data:')) {
      const parsedEventStream = parseEventStreamPayload(text);

      if (parsedEventStream) {
        return parsedEventStream;
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (typeof response.json === 'function') {
    return response.json();
  }

  return null;
}

async function testProviderConnection({
  configText,
  authText,
  fetchImpl = fetch,
  platform = process.platform,
  powershellImpl = runPowerShellProviderTest,
  timeoutMs = 20000
}) {
  const request = buildProviderTestRequest({ configText, authText });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(request.endpoint, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      if (shouldUsePowerShellFallback({ platform, status: response.status, payload })) {
        const fallbackResult = await powershellImpl(request, timeoutMs);

        return buildSuccessResult({
          request,
          payload: fallbackResult.payload,
          status: fallbackResult.status || 200
        });
      }

      const errorDetail = extractErrorMessage(payload) || 'Unknown provider error.';
      const error = new Error(`Provider test failed (${response.status}): ${errorDetail}`);
      error.status = response.status;
      error.endpoint = request.endpoint;
      error.model = request.body.model;
      error.providerId = request.providerId;
      error.outputText = typeof errorDetail === 'string' ? errorDetail : '';
      throw error;
    }

    return buildSuccessResult({
      request,
      payload,
      status: response.status
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Provider test timed out after ${timeoutMs}ms.`);
      timeoutError.endpoint = request.endpoint;
      timeoutError.model = request.body.model;
      timeoutError.providerId = request.providerId;
      throw timeoutError;
    }

    if (!error.endpoint) {
      error.endpoint = request.endpoint;
    }

    if (!error.model) {
      error.model = request.body.model;
    }

    if (!error.providerId) {
      error.providerId = request.providerId;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  buildProviderTestRequest,
  extractProviderResponseText,
  testProviderConnection
};
