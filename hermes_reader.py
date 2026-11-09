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


def channels():
    source = read_json("channel_directory.json")
    value = source.get("value")
    if not source["available"]:
        return unavailable()
    platforms = value.get("platforms") if isinstance(value, dict) else None
    if not isinstance(platforms, dict):
        return {"available": True, "items": []}
    return {"available": True, "items": [
        {"name": name, "status": "Connected" if isinstance(info, dict) and info.get("connected") else "Offline", "session_count": info.get("session_count", "Not Available") if isinstance(info, dict) else "Not Available"}
        for name, info in platforms.items()
    ]}


def process_alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def agents():
    processes, ledger = read_json("processes.json"), read_json("spawn-ledger.json")
    items, seen = [], set()
    for source in (processes.get("value"), ledger.get("value")):
        values = source if isinstance(source, list) else (source.values() if isinstance(source, dict) else [])
        for item in values:
            if not isinstance(item, dict):
                continue
            ident = str(item.get("name") or item.get("id") or item.get("pid") or "Unknown")
            if ident in seen:
                continue
            seen.add(ident)
            pid = item.get("pid")
            alive = process_alive(pid)
            state = "Working" if alive else "Unknown"
            items.append({
                "name": item.get("name") or ident,
                "role": item.get("role") or "Not Available",
                "state": state,
                "room": "Workspace" if state == "Working" else "Unknown",
                "pid": pid,
                "model": item.get("model") or "Not Available",
                "current_task": item.get("current_task") or "Not Available",
                "recent_activity": item.get("recent_activity") or "Not Available",
                "avatar": "tech_worker",
            })
    return {"available": bool(processes["available"] or ledger["available"]), "items": items}


def main():
    tasks, sessions, workers = sqlite_rows("kanban.db", "tasks"), sqlite_rows("state.db", "sessions"), sqlite_rows("state.db", "worker_executions")
    agent_data, channel_data = agents(), channels()
    result = {
        "dashboard": {"source_health": {"kanban": tasks["available"], "sessions": sessions["available"], "workers": workers["available"], "processes": read_json("processes.json")["available"], "cron": (HOME / "cron").is_dir()}, "total_tasks": len(tasks["items"]), "session_count": len(sessions["items"]), "worker_count": len(workers["items"]), "agent_count": len(agent_data["items"]), "channel_count": len(channel_data["items"])},
        "agents": agent_data,
        "crew_summary": {state.lower(): sum(1 for agent in agent_data["items"] if agent["state"] == state) for state in ("Working", "Idle", "Offline", "Unknown")},
        "channels": channel_data,
        "tasks": tasks,
        "calendar": cron_jobs(),
        "activity": {"available": workers["available"] or sessions["available"], "items": (workers["items"] + sessions["items"])[:50]},
        "memory": safe_files("memories"),
    }
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    main()
