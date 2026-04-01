# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # one-time setup
npm start            # launch the Electron app locally
npm test             # run all tests (node --test)
npm run build        # unpacked Electron build → dist/
npm run dist         # portable Windows package → dist/
```

To run a single test file:
```bash
node --test test/config-service.test.js
```

## Architecture

This is an **Electron desktop app** (Windows) for switching Codex provider presets and editing `~/.codex/` credentials. There is no bundler — all source is plain CommonJS loaded directly by Electron.

### Process boundaries

```
src/main/       — Node.js main process (file I/O, IPC handlers, external HTTP)
src/preload/    — contextBridge bridge; exposes window.codexApp to renderer
src/renderer/   — Browser context UI (index.html, renderer JS)
src/shared/     — Pure logic with no Electron or Node side-effects (imported by both main and tests)
test/           — node:test suite mirroring src module names
```

### IPC contract

Every `ipcMain.handle` in `main.js` wraps its work in `runIpcTask()` (`src/main/ipc-response.js`), which normalises all results to `{ ok: true, data }` or `{ ok: false, error }`. The renderer always checks `.ok` before consuming `.data`.

The preload exposes exactly one global: `window.codexApp`, with methods that map 1-to-1 to IPC channel names:

| Channel | Purpose |
|---|---|
| `app:bootstrap` | Initial load — returns merged presets, live config/auth, active provider |
| `app:read-live-files` | Re-read `~/.codex/` config.toml + auth.json |
| `app:get-preset` / `app:save-preset` | Read/write a single preset (applies config+auth to `~/.codex/`) |
| `app:create-custom-preset` | Persist a new user-defined preset |
| `app:save-files` | Write raw config.toml / auth.json text without preset logic |
| `app:test-provider` | Connectivity check against a provider's base URL |
| `app:gmn-login` / `app:gmn-logout` / `app:gmn-refresh` | GMN session lifecycle |
| `app:92scw-refresh` / `app:gwen-refresh` | Fetch usage/quota for 92scw / GWEN |
| `app:open-codex-dir` | Open `~/.codex/` in the system file manager |

### Preset system

Built-in presets are hardcoded in `src/shared/presets.js` (ids: `92scw`, `gmn`, `gwen`, `openai`). User overrides and custom presets are persisted to `<userData>/preset-overrides.json` with the shape `{ overrides: { [id]: {...} }, customPresets: [...] }`. `mergePresetsWithOverrides()` in `preset-overrides.js` produces the final merged list by overlaying stored overrides onto built-ins and appending custom presets.

### Config file targets

The app reads and writes two files in `~/.codex/`:
- `config.toml` — parsed with `@iarna/toml`; must remain valid TOML before any write
- `auth.json` — must be a plain JSON object; always written as `{ "OPENAI_API_KEY": "..." }`

`mergePresetWithExistingConfig()` in `src/shared/config-service.js` preserves the user's existing `projects` table when applying a preset config.

### Provider usage modules

Each third-party provider has its own usage-fetching module in `src/main/`:
- `gmn-account.js` — session-based auth (login → JWT → auto-refresh); session stored in `<userData>/gmn-session.json`
- `gwen-usage.js` — single GET to `https://ai.love-gwen.top/v1/usage` with Bearer key
- `newapi-token-usage.js` — hits `<baseUrl>/api/status` then `<baseUrl>/api/usage/token`; quota units are configurable; used by the `92scw` preset (the `build92scwProviderUsage` function in `main.js` delegates to this module)

### Windows-specific TLS fallback

`provider-tester.js` detects 403 responses with an OpenResty HTML body on `win32` and re-runs the request via an encoded PowerShell `Invoke-RestMethod` script to bypass Windows TLS interception.

### UI notes

The renderer UI is in Chinese. `renderer.js` is the main orchestrator; `gmn-display.js` handles GMN-specific account/usage display logic in the sidebar. The layout uses CSS Grid (fixed 348px sidebar + flexible main area).

## Style conventions

- CommonJS (`require`/`module.exports`), semicolons, single quotes, 2-space indent
- `camelCase` functions/variables, `UPPER_SNAKE_CASE` constants, `kebab-case` filenames
- Keep pure parsing/transform logic in `src/shared/`; keep Electron APIs and `fs` usage in `src/main/`
- Tests use `node:test` + `node:assert/strict`; inject `fetchImpl` / `platform` / `powershellImpl` dependencies to avoid real network calls
