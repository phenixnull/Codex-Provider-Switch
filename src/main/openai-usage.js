const { execFile } = require('node:child_process');

const OPENAI_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseAuthJson(authJsonText) {
  if (!authJsonText || !String(authJsonText).trim()) {
    return {};
  }

  return JSON.parse(authJsonText);
}

function extractChatGptAccessToken(authJsonText) {
  const auth = parseAuthJson(authJsonText);
  const authMode = String(auth?.auth_mode || '').trim().toLowerCase();
  const accessToken = String(auth?.tokens?.access_token || '').trim();

  if (authMode !== 'chatgpt' || !accessToken) {
    throw new Error('Official usage requires ChatGPT sign-in auth.');
  }

  return accessToken;
}

function extractApiErrorMessage(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message;
  }

  return '';
}

async function parseResponsePayload(response) {
  if (typeof response.json === 'function') {
    return response.json();
  }

  if (typeof response.text === 'function') {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return null;
}

function normalizeWindow(windowPayload) {
  if (!windowPayload || typeof windowPayload !== 'object') {
    return null;
  }

  const usedPercent = clamp(windowPayload.used_percent, 0, 100);
  const remainingPercent = roundPercent(100 - usedPercent);

  return {
    usedPercent,
    remainingPercent,
    limitWindowSeconds: Math.max(0, Number(windowPayload.limit_window_seconds) || 0),
    resetAfterSeconds: Math.max(0, Number(windowPayload.reset_after_seconds) || 0),
    resetAt: Number(windowPayload.reset_at) || 0
  };
}

function normalizeRateLimitStatus(rateLimit) {
  if (rateLimit?.limit_reached === true) {
    return 'limit reached';
  }

  if (rateLimit?.allowed === false) {
    return 'blocked';
  }

  return 'active';
}

function buildOpenAiUsageOverview(payload) {
  const primaryWindow = normalizeWindow(payload?.rate_limit?.primary_window);
  const secondaryWindow = normalizeWindow(payload?.rate_limit?.secondary_window);
  const codeReviewPrimaryWindow = normalizeWindow(payload?.code_review_rate_limit?.primary_window);
  const codeReviewSecondaryWindow = normalizeWindow(payload?.code_review_rate_limit?.secondary_window);
  const usedQuota = primaryWindow ? primaryWindow.usedPercent : 0;
  const remainingQuota = primaryWindow ? primaryWindow.remainingPercent : 0;

  return {
    usageKind: 'chatgpt_rate_limit',
    authType: 'chatgpt',
    planType: String(payload?.plan_type || '').trim().toLowerCase(),
    status: normalizeRateLimitStatus(payload?.rate_limit),
    totalQuota: 100,
    usedQuota,
    remainingQuota,
    progressPercent: remainingQuota,
    limitWindowSeconds: primaryWindow?.limitWindowSeconds || 0,
    resetAfterSeconds: primaryWindow?.resetAfterSeconds || 0,
    resetAt: primaryWindow?.resetAt || 0,
    secondaryWindow,
    rateLimitAllowed: payload?.rate_limit?.allowed !== false,
    rateLimitReached: payload?.rate_limit?.limit_reached === true,
    codeReviewRateLimit: {
      status: normalizeRateLimitStatus(payload?.code_review_rate_limit),
      primaryWindow: codeReviewPrimaryWindow,
      secondaryWindow: codeReviewSecondaryWindow
    },
    credits: payload?.credits || null,
    spendControlReached: payload?.spend_control?.reached === true,
    updatedAt: new Date().toISOString()
  };
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

async function runPowerShellOpenAiUsageRequest(request, timeoutMs) {
  const endpointExpr = decodeFromBase64InPowerShell(request.endpoint);
  const accessTokenExpr = decodeFromBase64InPowerShell(request.accessToken);
  const timeoutSeconds = Math.max(5, Math.ceil(timeoutMs / 1000));

  const script = `
$endpoint = ${endpointExpr}
$accessToken = ${accessTokenExpr}
$headers = @{
  Authorization = "Bearer $accessToken"
  Accept = 'application/json'
  'User-Agent' = 'CodexProviderSwitch/1.0'
}
try {
  $response = Invoke-RestMethod -Uri $endpoint -Method Get -Headers $headers -TimeoutSec ${timeoutSeconds}
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
      extractApiErrorMessage(parsed.error) || `Official usage request failed (${parsed.status || 0}).`
    );
    error.status = parsed.status || 0;
    throw error;
  }

  return {
    status: parsed.status || 200,
    payload: parsed.payload || null
  };
}

function shouldUsePowerShellFallback({ platform, payload, error }) {
  if (platform !== 'win32') {
    return false;
  }

  if (error) {
    return true;
  }

  return typeof payload === 'string' && /403 Forbidden/i.test(payload) && /openresty/i.test(payload);
}

async function fetchOpenAiUsageOverview(
  authJsonText,
  {
    fetchImpl = fetch,
    platform = process.platform,
    powershellImpl = runPowerShellOpenAiUsageRequest,
    timeoutMs = 20000
  } = {}
) {
  const accessToken = extractChatGptAccessToken(authJsonText);
  const request = {
    endpoint: OPENAI_USAGE_URL,
    accessToken
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(request.endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'CodexProviderSwitch/1.0'
      },
      signal: controller.signal
    });
    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      if (shouldUsePowerShellFallback({ platform, payload })) {
        const fallbackResult = await powershellImpl(request, timeoutMs);
        return buildOpenAiUsageOverview(fallbackResult.payload);
      }

      const error = new Error(
        extractApiErrorMessage(payload) || `Official usage request failed (${response.status}).`
      );
      error.status = response.status || 0;
      throw error;
    }

    return buildOpenAiUsageOverview(payload);
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Official usage request timed out after ${timeoutMs}ms.`);
      timeoutError.status = 0;
      throw timeoutError;
    }

    if (shouldUsePowerShellFallback({ platform, error })) {
      const fallbackResult = await powershellImpl(request, timeoutMs);
      return buildOpenAiUsageOverview(fallbackResult.payload);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  OPENAI_USAGE_URL,
  buildOpenAiUsageOverview,
  fetchOpenAiUsageOverview
};
