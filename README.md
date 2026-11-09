# Hermes Mission Control

Local read-only dashboard for Hermes Agent. No npm packages. No writes to Hermes data.

## Start

```bash
cd C:/Users/User/MissionControl
node MissionControl.js
```

Open http://127.0.0.1:4173.

## Test

```bash
node assert.js
```

Expected output:

```text
MISSION_CONTROL_SMOKE_OK
```

## Data sources

`hermes_reader.py` uses Python stdlib `sqlite3` read-only mode for:

- `%LOCALAPPDATA%/hermes/kanban.db`: tasks
- `%LOCALAPPDATA%/hermes/state.db`: sessions and worker executions
- `%LOCALAPPDATA%/hermes/processes.json` and `spawn-ledger.json`: known agent processes
- `%LOCALAPPDATA%/hermes/cron/`: cron definitions
- `%LOCALAPPDATA%/hermes/memories/`: persistent memory files
- `%LOCALAPPDATA%/hermes/channel_directory.json`: channel metadata

Missing, locked, malformed, or inaccessible sources show `Not Available`; dashboard does not invent data. Agent `Working` state only appears when an actual PID is alive. All other agent states remain `Unknown`.

## Visual 2D Office

The **Visual Office** tab has Workspace and Lounge. It renders known runtime agents only:

- `Working` agents with a verified live PID appear in Workspace.
- `Unknown` agents appear outside the active workspace; no active state is guessed.
- Agent details, activity, and channels use the same read-only adapter.

## Limits

- Polling interval: 5 seconds. No Hermes WebSocket event API is used.
- Dashboard binds only to `127.0.0.1`.
- Local session rows and memory contents can be sensitive. Do not expose this service outside the local machine.
- Hermes does not expose a reliable public agent state/room API here; the office deliberately uses `Unknown` when source data cannot prove state.
