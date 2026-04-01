function buildConfigText(lines) {
  return `${lines.join('\n')}\n`;
}

const BUILT_IN_PRESET_DESCRIPTIONS = {
  '92scw': '92scw 代理，使用 codex provider 和 sk 开头的默认密钥。',
  gmn: 'GMN 代理，使用 codex provider 和后台生成的 sk 密钥。',
  gwen: 'Gwen 代理，provider 为 gwen，默认使用 cr_ 开头密钥。',
  openai: '官方 OpenAI 直连配置，使用内置 openai provider。'
};

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
    'model_reasoning_effort = "high"',
    'network_access = "enabled"',
    'disable_response_storage = true',
    'model_verbosity = "high"',
    '',
    '[model_providers.codex]',
    'name = "codex"',
    'base_url = "http://92scw.cn/v1"',
    'wire_api = "responses"',
    'requires_openai_auth = true'
  ];

  if (isWindowsPlatform(platform)) {
    lines.push(
      '',
      'windows_wsl_setup_acknowledged = true',
      '',
      '[windows]',
      'sandbox = "elevated"'
    );
  }

  return buildConfigText(lines);
}

function buildGmnConfigText(platform) {
  const lines = [
    'model = "gpt-5.4"',
    'model_reasoning_effort = "xhigh"',
    'disable_response_storage = true',
    'sandbox_mode = "danger-full-access"',
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

  if (isWindowsPlatform(platform)) {
    lines.splice(4, 0, 'windows_wsl_setup_acknowledged = true');
    lines.splice(lines.indexOf('[profiles.auto-max]') - 1, 0, 'elevated_windows_sandbox = true');
  }

  return buildConfigText(lines);
}

function buildGwenConfigText() {
  return buildConfigText([
    'model_provider = "gwen"',
    'model = "gpt-5.4"',
    'review_model = "gpt-5.4"',
    'model_reasoning_effort = "high"',
    'model_context_window = 1000000',
    'model_auto_compact_token_limit = 350000',
    'service_tier = "fast"',
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
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
    'model_reasoning_effort = "high"',
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    'disable_response_storage = true',
    '',
    '[sandbox_workspace_write]',
    'network_access = true'
  ];

  if (isWindowsPlatform(platform)) {
    lines.splice(6, 0, 'windows_wsl_setup_acknowledged = true');
  }

  return buildConfigText(lines);
}

function buildPresetDefinitions(platform = process.platform) {
  return [
    {
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
      id: 'openai',
      name: 'OpenAI Official',
      description: getBuiltInPresetDescription('openai'),
      configText: buildOpenAiConfigText(platform),
      authText: `{
  "OPENAI_API_KEY": "sk-your-openai-api-key"
}
`
    }
  ];
}

function clonePreset(preset) {
  return {
    ...preset
  };
}

function listPresets(platform = process.platform) {
  return buildPresetDefinitions(platform).map(clonePreset);
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
  listPresets
};
