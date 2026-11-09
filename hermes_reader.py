import json
import os
import sqlite3
import sys
from pathlib import Path

HOME = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "hermes"


def unavailable(reason="Not Available"):
    return {"available": False, "reason": reason, "items": []}


def read_json(name):
    path = HOME / name
    try:
        with path.open(encoding="utf-8") as file:
            value = json.load(file)
        return {"available": True, "path": str(path), "value": value}
    except FileNotFoundError:
        return unavailable("Not Available")
    except (OSError, json.JSONDecodeError):
        return unavailable("Unreadable")


def sqlite_rows(filename, table, limit=100):
    path = HOME / filename
    if not path.exists():
        return unavailable("Not Available")
    try:
        uri = path.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True) as connection:
            connection.row_factory = sqlite3.Row
            names = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
            if not names:
                return unavailable("Table Not Available")
            rows = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}" LIMIT ?', (limit,))]
        return {"available": True, "items": rows, "columns": names}
    except sqlite3.Error:
        return unavailable("Unreadable")


def safe_files(folder, suffixes=(".json", ".md", ".txt"), limit=100):
    root = HOME / folder
    if not root.is_dir():
        return unavailable("Not Available")
    items = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in suffixes and len(items) < limit:
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
                items.append({"name": str(path.relative_to(root)), "content": text[:4000]})
            except OSError:
                continue
    return {"available": True, "items": items}


def cron_jobs():
    data = safe_files("cron")
    if not data["available"]:
        return data
    jobs = []
    for item in data["items"]:
        try:
            parsed = json.loads(item["content"])
            values = parsed if isinstance(parsed, list) else [parsed]
            for value in values:
                if isinstance(value, dict):
                    jobs.append({"name": value.get("name") or value.get("id") or item["name"], "schedule": value.get("schedule") or value.get("cron") or "Not Available", "next_run": value.get("next_run") or value.get("nextRun") or "Not Available"})
        except json.JSONDecodeError:
            jobs.append({"name": item["name"], "schedule": "Not Available", "next_run": "Not Available"})
    return {"available": True, "items": jobs}


def agents():
    processes = read_json("processes.json")
    ledger = read_json("spawn-ledger.json")
    items, seen = [], set()
    for source in (processes.get("value"), ledger.get("value")):
        values = source if isinstance(source, list) else (source.values() if isinstance(source, dict) else [])
        for value in values:
            if not isinstance(value, dict):
                continue
            name = str(value.get("name") or value.get("id") or value.get("pid") or "Unknown")
            if name in seen:
                continue
            seen.add(name)
            state = "Working" if value.get("pid") or value.get("status") in ("running", "active") else "Unknown"
            items.append({"name": name, "role": value.get("role") or "Not Available", "state": state, "pid": value.get("pid"), "model": value.get("model") or "Not Available"})
    return {"available": bool(processes["available"] or ledger["available"]), "items": items}


def main():
    tasks = sqlite_rows("kanban.db", "tasks")
    sessions = sqlite_rows("state.db", "sessions")
    workers = sqlite_rows("state.db", "worker_executions")
    channels = read_json("channel_directory.json")
    result = {
        "dashboard": {
            "source_health": {"kanban": tasks["available"], "sessions": sessions["available"], "workers": workers["available"], "processes": read_json("processes.json")["available"], "cron": (HOME / "cron").is_dir()},
            "total_tasks": len(tasks["items"]), "session_count": len(sessions["items"]), "worker_count": len(workers["items"]), "agent_count": len(agents()["items"]), "channel_count": len(channels.get("value", {})) if isinstance(channels.get("value"), dict) else 0,
        },
        "agents": agents(), "tasks": tasks, "calendar": cron_jobs(),
        "activity": {"available": workers["available"] or sessions["available"], "items": (workers["items"] + sessions["items"])[:100]},
        "memory": safe_files("memories"),
    }
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    main()
