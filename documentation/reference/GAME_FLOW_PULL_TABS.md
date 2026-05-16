# Pull-tabs game flow (config vs session)

## Modes

1. **Config mode** — No `sessionId` in the URL. The game loads a local JS config from `src/config/game/{name}.js` based on `?config=`, or falls back to `DEFAULT_CONFIG` in [`src/config/game/game-config.js`](../../src/config/game/game-config.js) (`mega-monster`). Valid names are listed in `CONFIG_REGISTRY`.

2. **Session mode** — URL includes `?sessionId=...` (optional `?mode=demo` or `?mode=real`). Boot calls `POST /provider/session` and builds runtime config from `gameMetadata` (theme, optional `prizes`, `message`, `type`, etc.). On failure, session is cleared and file config is loaded again when possible.

## URL parameters

| Param | Purpose |
|--------|---------|
| `config` | Config stem, e.g. `?config=disco-kitty`. Read from `window` / `parent` / `top` for iframe runners. |
| `sessionId` | Provider session; enables session mode. Same window/parent/top resolution. |
| `mode` | `demo` (default) or `real`; affects operator balance vs demo balance (minor units from API). |

## Bootstrap order

1. `main.js` `load` handler (async): resolve `window.__selectedGameConfig` (file or session placeholder).
2. Phaser starts; **Boot** `create()` runs:
   - Session: fetch session, merge `gameMetadata`, set registry `preloadSessionId`, `preloadSessionMode`, `preloadUseSessionConfig`, `preloadOperatorBalance` (pennies).
   - Always: `preloadGameConfig` = resolved config object.
3. **Preload** loads theme from `preloadGameConfig.theme` (or `window.__selectedGameConfig`).
4. **Level** / **ServerManager** use `preloadGameConfig` for peel copy; balance uses `preloadOperatorBalance` / `TEST_BALANCE_MINOR` (see [`src/config/Global.js`](../../src/config/Global.js)).

## API base URL

- Localhost / `127.0.0.1`: `GameConfig.api.BASE_URL_LOCAL` (CORS proxy port from `__CORS_PROXY_PORT__`, synced with [`scripts/local-testing/ports.config.js`](../../scripts/local-testing/ports.config.js)).
- Otherwise: `GameConfig.api.BASE_URL_LIVE`.

## Registry keys

| Key | Description |
|-----|-------------|
| `preloadGameConfig` | Resolved game object (theme, prizes, message, …) |
| `preloadUseSessionConfig` | `true` when config came from session |
| `preloadSessionId` | Session id when active |
| `preloadSessionMode` | `demo` or `real` |
| `preloadOperatorBalance` | Balance in **minor units** (pennies) from session |

## Default export `game-config.js`

`import gameConfig from './game-config.js'` is a **Proxy** to `window.__selectedGameConfig` after bootstrap (same pattern as the scratch game).

## Buy / server round-trip

Session-authenticated buy endpoints for pull-tabs are not wired yet; `ServerManager.buy()` remains a local stub. When APIs exist, mirror the scratch pattern (session body vs test path).
