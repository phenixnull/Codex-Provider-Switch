function buildConfigText(lines) {
  return `${lines.join('\n')}\n`;
}

function buildJsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const BUILT_IN_PRESET_DESCRIPTIONS = {
  '92scw': '92scw relay preset with codex provider and sk key auth.',
  gmn: 'GMN 代理，使用 codex provider 和后台生成的 sk 密钥。',
  gwen: 'Gwen relay preset with the gwen provider and cr_ activation keys.',
  openai: '官方 OpenAI 直连配置，使用内置 openai provider。',
  quan2go: 'Quan2Go relay preset with activation-code auth.',
  'claude-glm-5-1':
    'BigModel Claude Code preset using the Anthropic-compatible GLM-5.1 endpoint.',
  'claude-openrouter-qwen3-6-plus-free':
    'OpenRouter Claude Code preset using qwen/qwen3.6-plus:free over the Anthropic-compatible endpoint.'
};

const OPENROUTER_API_KEY_PLACEHOLDER =
  'sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const LEGACY_MOJIBAKE_PRESET_DESCRIPTIONS = {
  '92scw':
    '\u0039\u0032\u0073\u0063\u0077\u0020\u6d60\uff47\u608a\u951b\u5c7c\u5a07\u9422\u003f\u0063\u006f\u0064\u0065\u0078\u0020\u0070\u0072\u006f\u0076\u0069\u0064\u0065\u0072\u0020\u935c\u003f\u0073\u006b\u0020\u5bee\u20ac\u6fb6\u5bf8\u6b91\u699b\u6a3f\ue17b\u7035\u55db\u631c\u9286\u003f',
  gmn:
    '\u0047\u004d\u004e\u0020\u6d60\uff47\u608a\u951b\u5c7c\u5a07\u9422\u003f\u0063\u006f\u0064\u0065\u0078\u0020\u0070\u0072\u006f\u0076\u0069\u0064\u0065\u0072\u0020\u935c\u5c7d\u6097\u9359\u626e\u6553\u93b4\u612e\u6b91\u0020\u0073\u006b\u0020\u7035\u55db\u631c\u9286\u003f',
  gwen:
    '\u0047\u0077\u0065\u006e\u0020\u6d60\uff47\u608a\u951b\u5bb2\u0072\u006f\u0076\u0069\u0064\u0065\u0072\u0020\u6d93\u003f\u0067\u0077\u0065\u006e\u951b\u5c84\u7caf\u7481\u3084\u5a07\u9422\u003f\u0063\u0072\u005f\u0020\u5bee\u20ac\u6fb6\u6751\u7611\u95bd\u30e3\u20ac\u003f',
  openai:
    '\u7039\u6a3b\u67df\u0020\u004f\u0070\u0065\u006e\u0041\u0049\u0020\u9429\u78cb\u7e5b\u95b0\u5d87\u7586\u951b\u5c7c\u5a07\u9422\u3125\u5534\u7f03\u003f\u006f\u0070\u0065\u006e\u0061\u0069\u0020\u0070\u0072\u006f\u0076\u0069\u0064\u0065\u0072\u9286\u003f'
};

function isWindowsPlatform(platform = process.platform) {
  return platform === 'win32';
}

function getBuiltInPresetDescription(id) {
  return BUILT_IN_PRESET_DESCRIPTIONS[id] || '';
}

function isLegacyPresetDescription(id, description) {
  return String(description || '').trim() === LEGACY_MOJIBAKE_PRESET_DESCRIPTIONS[id];
}

function build92scwConfigText(platform) {
  const lines = [
    'model_provider = "codex"',
    'model = "gpt-5.4"',
    'model_reasoning_effort = "xhigh"',
    'network_access = "enabled"',
    'disable_response_storage = true',
    ...(isWindowsPlatform(platform) ? ['windows_wsl_setup_acknowledged = true'] : []),
    'model_verbosity = "high"',
    '',
    '[model_providers.codex]',
    'name = "codex"',
    'base_url = "http://92scw.cn/v1"',
    'wire_api = "responses"',
    'requires_openai_auth = true'
  ];

  if (isWindowsPlatform(platform)) {
    lines.push('', '[windows]', 'sandbox = "elevated"');
  }

  return buildConfigText(lines);
}

function buildGmnConfigText(platform) {
  const lines = [
    'model = "gpt-5.4"',
    'model_reasoning_effort = "xhigh"',
    'disable_response_storage = true',
    'sandbox_mode = "danger-full-access"',
    ...(isWindowsPlatform(platform) ? ['windows_wsl_setup_acknowledged = true'] : []),
    'approval_policy = "never"',
    'profile = "auto-max"',
    'file_opener = "vscode"',
    'model_provider = "codex"',
    'web_search = "cached"',
    'suppress_unstable_features_warning = true',
    '',
    '[history]',
    'persistence = "save-all"',
    '',
    '[tui]',
    'notifications = true',
    '',
    '[shell_environment_policy]',
    'inherit = "all"',
    'ignore_default_excludes = false',
    '',
    '[sandbox_workspace_write]',
    'network_access = true',
    '',
    '[features]',
    'plan_tool = true',
    'apply_patch_freeform = true',
    'view_image_tool = true',
    'unified_exec = false',
    'streamable_shell = false',
    'rmcp_client = true',
    ...(isWindowsPlatform(platform) ? ['elevated_windows_sandbox = true'] : []),
    '',
    '[profiles.auto-max]',
    'approval_policy = "never"',
    'sandbox_mode = "workspace-write"',
    '',
    '[profiles.review]',
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    '',
    '[notice]',
    'hide_gpt5_1_migration_prompt = true',
    '',
    '[model_providers.codex]',
    'name = "codex"',
    'base_url = "https://gmn.chuangzuoli.com"',
    'wire_api = "responses"',
    'requires_openai_auth = true'
  ];

  return buildConfigText(lines);
}

function buildGwenConfigText() {
  return buildConfigText([
    'model_provider = "gwen"',
    'model = "gpt-5.4"',
    'review_model = "gpt-5.4"',
    'model_reasoning_effort = "xhigh"',
    'model_context_window = 1000000',
    'model_auto_compact_token_limit = 350000',
    'service_tier = "fast"',
    'approval_policy = "on-request"',
    'sandbox_mode = "danger-full-access"',
    '',
    '[sandbox_workspace_write]',
    'network_access = true',
    '',
    '[features]',
    'multi_agent = true',
    'memories = true',
    'undo = true',
    'shell_snapshot = true',
    'fast_mode = true',
    'apply_patch_freeform = true',
    'unified_exec = true',
    '',
    '[memories]',
    'extract_model = "gpt-5.4"',
    'consolidation_model = "gpt-5.4"',
    'max_raw_memories_for_consolidation = 512',
    '',
    '[model_providers.gwen]',
    'name = "gwen"',
    'base_url = "https://ai.love-gwen.top/openai"',
    'wire_api = "responses"',
    'requires_openai_auth = true'
  ]);
}

function buildOpenAiConfigText(platform) {
  const lines = [
    'model_provider = "openai"',
    'model = "gpt-5.4"',
    'model_reasoning_effort = "xhigh"',
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    'disable_response_storage = true',
    ...(isWindowsPlatform(platform) ? ['windows_wsl_setup_acknowledged = true'] : []),
    '',
    '[sandbox_workspace_write]',
    'network_access = true'
  ];

  if (isWindowsPlatform(platform)) {
    lines.push('', '[windows]', 'sandbox = "elevated"');
  }

  return buildConfigText(lines);
}

function buildQuan2GoConfigText() {
  return buildConfigText([
    'model_provider = "quan2go"',
    'model = "gpt-5.4"',
    'review_model = "gpt-5.4"',
    'model_context_window = 1000000',
    'model_auto_compact_token_limit = 800000',
    'model_reasoning_effort = "xhigh"',
    'disable_response_storage = true',
    '',
    '[model_providers.quan2go]',
    'name = "Quan2Go"',
    'base_url = "https://capi.quan2go.com/openai"',
    'wire_api = "responses"',
    'requires_openai_auth = true'
  ]);
}

function buildClaudeGlm51ConfigText() {
  return buildJsonText({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'replace-with-zhipu-api-key',
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      API_TIMEOUT_MS: '3000000',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'GLM-4.5-air',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'GLM-5.1',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'GLM-5.1',
      CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '80'
    },
    permissions: {
      allow: [],
      deny: []
    },
    model: 'opus[1m]',
    enabledPlugins: {
      'glm-plan-usage@zai-coding-plugins': true,
      'glm-plan-bug@zai-coding-plugins': true
    },
    skipDangerousModePermissionPrompt: true
  });
}

function buildClaudeOpenRouterQwenFreeConfigText() {
  return buildJsonText({
    env: {
      OPENROUTER_API_KEY: OPENROUTER_API_KEY_PLACEHOLDER,
      ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
      ANTHROPIC_AUTH_TOKEN: OPENROUTER_API_KEY_PLACEHOLDER,
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_MODEL: 'qwen/qwen3.6-plus:free',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen/qwen3.6-plus:free',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen/qwen3.6-plus:free',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen/qwen3.6-plus:free',
      API_TIMEOUT_MS: '3000000',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '80'
    },
    model: 'sonnet'
  });
}

function buildClaudeGlm51StatePatchText() {
  return buildJsonText({
    hasCompletedOnboarding: true
  });
}

function buildPresetDefinitions(platform = process.platform) {
  return [
    {
      productId: 'codex',
      id: '92scw',
      name: '92scw',
      description: getBuiltInPresetDescription('92scw'),
      configText: build92scwConfigText(platform),
      authText: `{
  "OPENAI_API_KEY": "sk-demo-92scw-provider-key-0001"
}
`
    },
    {
      productId: 'codex',
      id: 'gmn',
      name: 'GMN',
      description: getBuiltInPresetDescription('gmn'),
      configText: buildGmnConfigText(platform),
      authText: `{
  "OPENAI_API_KEY": "sk-demo-gmn-provider-key-0001"
}
`
    },
    {
      productId: 'codex',
      id: 'gwen',
      name: 'Gwen',
      description: getBuiltInPresetDescription('gwen'),
      configText: buildGwenConfigText(),
      authText: `{
  "OPENAI_API_KEY": "cr-demo-gwen-provider-key-0001"
}
`
    },
    {
      productId: 'codex',
      id: 'openai',
      name: 'OpenAI Official',
      description: getBuiltInPresetDescription('openai'),
      configText: buildOpenAiConfigText(platform),
      authText: `{
  "OPENAI_API_KEY": "sk-your-openai-api-key"
}
`
    },
    {
      productId: 'codex',
      id: 'quan2go',
      name: 'Quan2Go',
      description: getBuiltInPresetDescription('quan2go'),
      configText: buildQuan2GoConfigText(),
      authText: `{
  "OPENAI_API_KEY": "replace-with-activation-code"
}
`
    },
    {
      productId: 'claude',
      id: 'claude-glm-5-1',
      name: 'GLM-5.1 (Claude Code)',
      description: getBuiltInPresetDescription('claude-glm-5-1'),
      configText: buildClaudeGlm51ConfigText(),
      authText: buildClaudeGlm51StatePatchText()
    },
    {
      productId: 'claude',
      id: 'claude-openrouter-qwen3-6-plus-free',
      name: 'OpenRouter Qwen3.6 Plus Free (Claude Code)',
      description: getBuiltInPresetDescription('claude-openrouter-qwen3-6-plus-free'),
      configText: buildClaudeOpenRouterQwenFreeConfigText(),
      authText: buildClaudeGlm51StatePatchText()
    }
  ];
}

function clonePreset(preset) {
  return {
    ...preset
  };
}

function listPresets(platform = process.platform) {
  return listPresetsByProduct('codex', platform);
}

function listPresetsByProduct(productId = 'codex', platform = process.platform) {
  return buildPresetDefinitions(platform)
    .filter((preset) => preset.productId === productId)
    .map(clonePreset);
}

function getPresetById(id, platform = process.platform) {
  const preset = buildPresetDefinitions(platform).find((item) => item.id === id);

  if (!preset) {
    return null;
  }

  return clonePreset(preset);
}

module.exports = {
  getBuiltInPresetDescription,
  getPresetById,
  isLegacyPresetDescription,
  listPresets,
  listPresetsByProduct
};
