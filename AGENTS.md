# Repository Guidelines

## Project Structure & Module Organization
`src/main/` contains Electron main-process code for window setup, IPC handlers, provider checks, and `.codex` file I/O. `src/preload/` exposes the safe renderer bridge. `src/renderer/` holds the desktop UI (`index.html`, `renderer.js`, `styles.css`). `src/shared/` is for reusable pure logic such as preset definitions and TOML/JSON config helpers. Tests live in `test/` and mirror module names. Treat `dist/` and `node_modules/` as generated output, not source.

## Build, Test, and Development Commands
Run `npm install` once to install Electron and build tooling. Use `npm start` to launch the app locally. Use `npm test` to run the built-in Node test suite with `node --test`. Use `npm run build` to create an unpacked Electron build in `dist/`. Use `npm run dist` to produce the portable Windows package defined in `package.json`.

## Coding Style & Naming Conventions
Follow the existing JavaScript style: CommonJS modules, semicolons, single quotes, and 2-space indentation. Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants such as `NEW_PRESET_ID`, and kebab-case filenames such as `provider-tester.js`. Keep pure parsing/merge logic in `src/shared/`; keep Electron-specific side effects in `src/main/` or `src/preload/`.

## Testing Guidelines
Tests use `node:test` plus `node:assert/strict`. Name files `*.test.js` and align them with the module under test, for example `test/config-service.test.js`. Add or update tests for any behavior change involving config parsing, preset merging, `.codex` file writes, IPC result wrapping, or provider request generation. No coverage threshold is configured, so rely on behavior-focused tests before shipping.

## Commit & Pull Request Guidelines
This workspace snapshot does not include `.git`, so local history is unavailable. Use short imperative commit subjects, preferably Conventional Commit style, for example `fix: preserve trusted projects during preset merge`. Pull requests should summarize user-visible changes, list validation steps such as `npm test`, and include screenshots when `src/renderer/` is changed.

## Security & Configuration Tips
Never commit real API keys, `auth.json`, or copied contents from `~/.codex/`. Use redacted fixtures in tests. Preserve machine-specific trusted project settings when updating config and validate TOML/JSON before writing files.
