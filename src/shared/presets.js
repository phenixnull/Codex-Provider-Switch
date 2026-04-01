function buildConfigText(lines) {
  return `${lines.join('\n')}\n`;
}

function isWindowsPlatform(platform = process.platform) {
  return platform === 'win32';
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
      description: '92scw 浠ｇ悊锛屼娇鐢?codex provider 鍜?sk 寮€澶寸殑榛樿瀵嗛挜銆?',
      configText: build92scwConfigText(platform),
      authText: `{
  "OPENAI_API_KEY": "sk-demo-92scw-provider-key-0001"
}
`
    },
    {
      id: 'gmn',
      name: 'GMN',
      description: 'GMN 浠ｇ悊锛屼娇鐢?codex provider 鍜屽悗鍙扮敓鎴愮殑 sk 瀵嗛挜銆?',
      configText: buildGmnConfigText(platform),
      authText: `{
  "OPENAI_API_KEY": "sk-demo-gmn-provider-key-0001"
}
`
    },
    {
      id: 'gwen',
      name: 'Gwen',
      description: 'Gwen 浠ｇ悊锛宲rovider 涓?gwen锛岄粯璁や娇鐢?cr_ 寮€澶村瘑閽ャ€?',
      configText: buildGwenConfigText(),
      authText: `{
  "OPENAI_API_KEY": "cr-demo-gwen-provider-key-0001"
}
`
    },
    {
      id: 'openai',
      name: 'OpenAI Official',
      description: '瀹樻柟 OpenAI 鐩磋繛閰嶇疆锛屼娇鐢ㄥ唴缃?openai provider銆?',
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
  getPresetById,
  listPresets
};
