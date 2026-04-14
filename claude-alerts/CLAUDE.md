# Claude Alerts

A local HTTP server that displays Claude Code session activity as stream overlays in OBS. When Claude finishes responding or needs input, a notification bar slides in from the right side of the stream.

## How it works

1. Claude Code fires hooks on `Stop` and `Notification` events (configured in `../.claude/settings.json`)
2. The hooks call `notify.sh`, which POSTs the raw hook JSON to this server
3. The server broadcasts the event over SSE to any connected overlay pages
4. The OBS Browser Source (`/overlay`) receives the event and animates a notification bar

## Running the server

```
bun server.ts
```

Runs on port 3001. The existing overlays server (in `../overlays/`) runs on port 3000 — these are intentionally separate.

## Pages

| URL | Purpose |
|---|---|
| `http://localhost:3001/` | Admin panel — fire test events, burst test, event log |
| `http://localhost:3001/overlay` | OBS Browser Source (1920×1080 transparent) |
| `http://localhost:3001/playground` | Visual design tool for tuning bar appearance |

## Notification types

- **Stop** — Claude finished responding, your turn. Amber accent.
- **Notification** — Claude needs input or permission (permission_prompt, elicitation_dialog only). Amber accent.

Multiple sessions stack as separate bars. Each bar shows the event type, a short session ID, and the project name derived from `cwd`.

## Audio

Each notification plays a random butler voice snippet from `sounds/`. The server serves these at `/butler-sounds/<filename>` (URL-encoded). The old overlays sounds proxy (`/sounds/`) is still present but unused.

The 10 phrases are recorded as `.mp4` files:
- `alert - your attention if you please.mp4`
- `alert - when you're quite ready.mp4`
- `alert - I beg your pardon.mp4`
- `alert - Your input is needed.mp4`
- `alert - I await your instruction.mp4`
- `alert - at your earliest convenience.mp4`
- `alert - a moment of your time.mp4`
- `alert - pardon the interuption.mp4`
- `alert - you presence is required.mp4`
- `alert - if i may trouble you.mp4`

## Hook configuration

Hooks are in `../.claude/settings.json` — project-scoped to this repo only. The `notify.sh` script forwards stdin to `POST /claude/notify`.

The `Notification` hook uses a matcher so only `permission_prompt` and `elicitation_dialog` events fire — idle timeouts and auth events are silently dropped. `notify.sh` has a secondary guard for the same filter in case the matcher doesn't apply.

## Tip: overlay page caching

The overlay page runs in OBS as a browser source. After restarting the server, the page must be manually refreshed to pick up code changes — the SSE connection reconnects automatically but the page HTML/JS does not reload. In OBS: right-click the browser source → **Refresh cache of current page**.
