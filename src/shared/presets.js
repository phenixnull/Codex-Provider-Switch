const presets = [
  {
    id: '92scw',
    name: '92scw',
    description: '92scw 代理，使用 codex provider 和 sk 开头的默认密钥。',
    configText: `model_provider = "codex"
model = "gpt-5.4"
model_reasoning_effort = "high"
network_access = "enabled"
disable_response_storage = true
windows_wsl_setup_acknowledged = true
model_verbosity = "high"

[model_providers.codex]
name = "codex"
base_url = "http://92scw.cn/v1"
wire_api = "responses"
requires_openai_auth = true

[windows]
sandbox = "elevated"
`,
    authText: `{
  "OPENAI_API_KEY": "sk-demo-92scw-provider-key-0001"
}
`
  },
  {
    id: 'gmn',
    name: 'GMN',
    description: 'GMN 代理，使用 codex provider 和后台生成的 sk 密钥。',
    configText: `model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
sandbox_mode = "danger-full-access"
windows_wsl_setup_acknowledged = true
approval_policy = "never"
profile = "auto-max"
file_opener = "vscode"
model_provider = "codex"
web_search = "cached"
suppress_unstable_features_warning = true

[history]
persistence = "save-all"

[tui]
notifications = true

[shell_environment_policy]
inherit = "all"
ignore_default_excludes = false

[sandbox_workspace_write]
network_access = true

[features]
plan_tool = true
apply_patch_freeform = true
view_image_tool = true
unified_exec = false
streamable_shell = false
rmcp_client = true
elevated_windows_sandbox = true

[profiles.auto-max]
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.review]
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[notice]
hide_gpt5_1_migration_prompt = true

[model_providers.codex]
name = "codex"
base_url = "https://gmn.chuangzuoli.com"
wire_api = "responses"
requires_openai_auth = true
`,
    authText: `{
  "OPENAI_API_KEY": "sk-demo-gmn-provider-key-0001"
}
`
  },
  {
    id: 'gwen',
    name: 'Gwen',
    description: 'Gwen 代理，provider 为 gwen，默认使用 cr_ 开头密钥。',
    configText: `model_provider = "gwen"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "high"
model_context_window = 1000000
model_auto_compact_token_limit = 350000
service_tier = "fast"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = true

[features]
multi_agent = true
memories = true
undo = true
shell_snapshot = true
fast_mode = true
apply_patch_freeform = true
unified_exec = true

[memories]
extract_model = "gpt-5.4"
consolidation_model = "gpt-5.4"
max_raw_memories_for_consolidation = 512

[model_providers.gwen]
name = "gwen"
base_url = "https://ai.love-gwen.top/openai"
wire_api = "responses"
requires_openai_auth = true
`,
    authText: `{
  "OPENAI_API_KEY": "cr-demo-gwen-provider-key-0001"
}
`
  },
  {
    id: 'openai',
    name: 'OpenAI Official',
    description: '官方 OpenAI 直连配置，使用内置 openai provider。',
    configText: `model_provider = "openai"
model = "gpt-5.4"
model_reasoning_effort = "high"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
disable_response_storage = true
windows_wsl_setup_acknowledged = true

[sandbox_workspace_write]
network_access = true
`,
    authText: `{
  "OPENAI_API_KEY": "sk-your-openai-api-key"
}
`
  }
];

function clonePreset(preset) {
  return {
    ...preset
  };
}

function listPresets() {
  return presets.map(clonePreset);
}

function getPresetById(id) {
  const preset = presets.find((item) => item.id === id);

  if (!preset) {
    return null;
  }

  return clonePreset(preset);
}

module.exports = {
  getPresetById,
  listPresets
};
