# Changelog

All notable changes to this project are documented in this file.

## 2026-04-04

### Added

- Added app-level `Codex` / `Claude` product switching with separate preset catalogs and live preset detection for Claude startup cards.
- Added the built-in Claude `GLM-5.1 (BigModel)` preset, Claude config merge helpers, and local-only preset override support for Claude auth/config state.
- Added BigModel local auth storage plus official usage fetching for `每5小时使用额度` and `MCP 每月额度`, rendered directly inside the GLM-5.1 Claude card.
- Added the OpenRouter Claude preset path for `qwen/qwen3.6-plus:free` with a simplified free-tier card that shows the fixed daily limit copy and animation-only refresh behavior.
- Added new tests for BigModel auth/web usage, Claude file/config helpers, OpenRouter usage handling, product catalog separation, and usage-stat links.
- Added a redacted live UI screenshot to the GitHub README hero section so the repo landing page shows the current Claude workspace.
- Added full README coverage for Claude Code, including product positioning, file boundaries, preset tables, workflow notes, and runtime/test coverage.
- Added a refreshed README cover illustration that brands the app as a Codex plus Claude Code preset switch instead of the old Codex-only hero art.

### Changed

- Renamed the README hero title to `CC Provider Switch (Codex/Claude Code)` so the landing page branding matches the dual-product scope.
- Changed the startup preset ordering so the currently active Claude preset is pinned to the top by matching the live Claude base URL and model.
- Expanded renderer/main/preload wiring so Claude usage cards, preset save flows, and live bootstrap data share the same app shell as Codex presets.
- Preserved the repo-wide secret boundary: tracked files keep placeholders only, while real Claude/OpenRouter credentials stay in local override storage.
- Changed the Windows window chrome to a light integrated title area and unified the app window, taskbar, and packaged build icon to the `Codex Provider Switch` desktop shortcut icon.

## 2026-04-03

### Added

- Added the Quan2Go preset, quota usage integration, and provider-aware usage refresh messaging.
- Added source-mode live reload for renderer/preload edits and restart-aware handling for main-process source changes.

### Changed

- Kept Quan2Go activation codes scoped to local preset storage and replaced tracked fixture values with placeholders.
