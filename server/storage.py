"""File-based state persistence with manual version snapshots.

Model (single save concept):
- 保存 = persist current.json + explicitly create ONE version.
- Versions are manual. Empty name → time-named (type "time"), pruned to the
  newest MAX_TIME_SNAPSHOTS. Custom name → type "named", kept forever.
- No auto snapshots: the legacy auto_* files are removed by
  remove_legacy_auto_snapshots() at server startup.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
# Time-named versions (quick saves with no custom name) are pruned to the
# newest MAX_TIME_SNAPSHOTS; custom-named versions are permanent.
MAX_TIME_SNAPSHOTS = 10
# project_id is an API-facing filesystem directory name. Only accept safe
# basenames: no path separators, no leading dot, no absolute paths.
_PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def _project_dir(project_id: str) -> Path:
    if not isinstance(project_id, str) or not _PROJECT_ID_RE.fullmatch(project_id):
        raise ValueError("Invalid project_id")
    return DATA_DIR / project_id


def _snapshots_dir(project_id: str) -> Path:
    return _project_dir(project_id) / "snapshots"


def _current_file(project_id: str) -> Path:
    return _project_dir(project_id) / "current.json"


def _atomic_write(path: Path, data: str) -> None:
    """Write to a temp file then rename for atomicity."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(data)
    os.replace(tmp, path)


def load_state(project_id: str = "default") -> dict[str, Any] | None:
    """Load current state. Returns None if no saved state exists."""
    f = _current_file(project_id)
    if not f.exists():
        return None
    try:
        with open(f, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return None


def _strip_saved_at(state: Any) -> Any:
    """Return a copy of state with meta.savedAt nulled, for content comparison."""
    if not isinstance(state, dict):
        return state
    meta = dict(state.get("meta") or {})
    meta["savedAt"] = None
    return {**state, "meta": meta}


def _canonical(state: Any) -> str:
    return json.dumps(_strip_saved_at(state), sort_keys=True, ensure_ascii=False)


def save_state(project_id: str, state: dict[str, Any]) -> dict[str, Any]:
    """Persist current state. No snapshot is created here — versions are
    created explicitly via POST /api/snapshots (create_snapshot)."""
    _atomic_write(_current_file(project_id), json.dumps(state, ensure_ascii=False, indent=2))
    return {"ok": True}


def _time_display(ts_str: str) -> str | None:
    """Convert a 15-char %Y%m%d_%H%M%S timestamp to 'YYYY-MM-DD HH:MM:SS'."""
    try:
        t = time.mktime(time.strptime(ts_str, "%Y%m%d_%H%M%S"))
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t))
    except (ValueError, OSError):
        return None


def _snapshot_metadata(f: Path) -> dict[str, Any]:
    stem = f.stem
    is_time = stem.startswith("time_")
    is_auto = stem.startswith("auto_")
    display_name = stem[6:] if stem.startswith("named_") else stem
    if is_time or is_auto:
        ts_display = _time_display(stem[5:20])
        if ts_display is not None:
            suffix = stem[20:]
            if suffix.startswith("_") and suffix[1:].isdigit():
                ts_display += f" ({int(suffix[1:])})"
            display_name = ts_display
    return {
        "id": stem,
        "name": display_name,
        "type": "time" if is_time else ("auto" if is_auto else "named"),
        "created_at": f.stat().st_mtime,
    }


def snapshot_metadata(project_id: str, snapshot_id: str) -> dict[str, Any] | None:
    """Read the actual display name and metadata for a selected version."""
    f = _snapshots_dir(project_id) / f"{Path(snapshot_id).name}.json"
    try:
        return _snapshot_metadata(f)
    except OSError:
        return None


def list_snapshots(project_id: str = "default") -> list[dict[str, Any]]:
    """List snapshots, newest first. Types: 'time' (time-named, prunable),
    'named' (custom name, permanent)."""
    snap_dir = _snapshots_dir(project_id)
    if not snap_dir.exists():
        return []

    snapshots = []
    for f in snap_dir.glob("*.json"):
        try:
            snapshots.append(_snapshot_metadata(f))
        except OSError:
            continue

    snapshots.sort(key=lambda s: s["created_at"], reverse=True)
    return snapshots


def create_snapshot(
    project_id: str,
    name: str | None = None,
    state: dict[str, Any] | None = None,
    overwrite: bool = False,
) -> dict[str, Any]:
    """Create a version snapshot.

    - name empty/None → time-named (type 'time'); pruned to newest
      MAX_TIME_SNAPSHOTS after creation.
    - name given → custom-named (type 'named'); permanent.
    - Name collisions: overwrite=True replaces the same-named version in place
      (old content gone — caller has already asked the user); otherwise the
      collision gets a (1), (2), … suffix.
    - 2026-08-27：取消"内容相同则跳过"——以用户给出的语义名称为主，
      同一内容也允许起多个名字存档（典型场景：用户为同一份策划起多个
      里程碑名称如 step1_done / step2_done / 终版）。
    """
    if state is None:
        state = load_state(project_id)
        if state is None:
            raise ValueError("No state to snapshot")

    snap_dir = _snapshots_dir(project_id)
    snap_dir.mkdir(parents=True, exist_ok=True)

    name = (name or "").strip()
    if name:
        safe_name = re.sub(r'[<>:"/\\|?*]', "_", name).strip()
        snap_id = "named_" + safe_name
        if not overwrite:
            counter = 1
            while (snap_dir / f"{snap_id}.json").exists():
                snap_id = f"named_{safe_name}({counter})"
                counter += 1
    else:
        base = time.strftime("%Y%m%d_%H%M%S")
        snap_id = "time_" + base
        counter = 1
        while (snap_dir / f"{snap_id}.json").exists():
            counter += 1
            snap_id = f"time_{base}_{counter}"

    _atomic_write(snap_dir / f"{snap_id}.json", json.dumps(state, ensure_ascii=False, indent=2))
    _cleanup_time_snapshots(project_id)

    return _snapshot_metadata(snap_dir / f"{snap_id}.json")


def load_snapshot(project_id: str, snapshot_id: str) -> dict[str, Any] | None:
    """Load a snapshot's full state."""
    # Prevent path traversal
    safe_id = Path(snapshot_id).name
    f = _snapshots_dir(project_id) / f"{safe_id}.json"
    if not f.exists():
        return None
    try:
        with open(f, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return None


def restore_snapshot(project_id: str, snapshot_id: str) -> dict[str, Any] | None:
    """Restore a snapshot, replacing the live state directly.
    2026-08-26: 不再自动创建「恢复前备份」（用户决策：一键直载 + 不要备份）。"""
    snapshot_state = load_snapshot(project_id, snapshot_id)
    if snapshot_state is None:
        return None
    if not isinstance(snapshot_state, dict) or not any(
        isinstance(snapshot_state.get(f"work{n}"), dict) for n in range(1, 6)
    ):
        raise ValueError("Snapshot state is invalid")
    source_meta = snapshot_state.get("meta") or {}
    if not isinstance(source_meta, dict):
        raise ValueError("Snapshot metadata is invalid")
    meta = snapshot_metadata(project_id, snapshot_id)
    if meta is None:
        return None
    snapshot_state = {
        **snapshot_state,
        "meta": {
            **source_meta,
            "loadedFrom": meta["name"],
            "loadedFromId": meta["id"],
            "isDemo": False,
            "demoCase": None,
            "demoSnapshot": None,
        },
    }

    _atomic_write(
        _current_file(project_id),
        json.dumps(snapshot_state, ensure_ascii=False, indent=2),
    )
    return snapshot_state


def delete_snapshot(project_id: str, snapshot_id: str) -> bool:
    """Delete a snapshot. Returns True if it existed and was removed."""
    safe_id = Path(snapshot_id).name
    f = _snapshots_dir(project_id) / f"{safe_id}.json"
    try:
        f.unlink()
        return True
    except OSError:
        return False


def rename_snapshot(
    project_id: str,
    snapshot_id: str,
    new_name: str,
    overwrite: bool = False,
    copy: bool = False,
) -> dict[str, Any] | None:
    """Rename a snapshot (any type becomes custom-named / permanent).
    On name collision: overwrite=True atomically replaces the target version;
    otherwise the target gets a (1), (2), … suffix. copy=True duplicates the
    selected snapshot, preserving both the source and any conflicting target.
    Returns new metadata; None if the snapshot doesn't exist.
    Raises ValueError when the new name is empty after sanitizing."""
    new_name = (new_name or "").strip()
    if not new_name:
        raise ValueError("Name is empty")
    safe_name = re.sub(r'[<>:"/\\|?*]', "_", new_name).strip()
    if not safe_name:
        raise ValueError("Name is empty")
    if copy and overwrite:
        raise ValueError("Copy cannot overwrite a snapshot")

    safe_id = Path(snapshot_id).name
    snap_dir = _snapshots_dir(project_id)
    src = snap_dir / f"{safe_id}.json"
    if not src.exists():
        return None

    target = "named_" + safe_name
    if not overwrite:
        counter = 1
        while (snap_dir / f"{target}.json").exists() and (copy or (snap_dir / f"{target}.json") != src):
            target = f"named_{safe_name}({counter})"
            counter += 1
    dst = snap_dir / f"{target}.json"
    if copy:
        # Never use current.json: "另存" duplicates the selected historical state.
        _atomic_write(dst, src.read_text(encoding="utf-8"))
    elif dst != src:
        os.replace(src, dst)

    return _snapshot_metadata(dst)


def _cleanup_time_snapshots(project_id: str, keep: int = MAX_TIME_SNAPSHOTS) -> None:
    """Keep only the N most recent time-named versions. Named ones are untouched."""
    snap_dir = _snapshots_dir(project_id)
    if not snap_dir.exists():
        return

    time_files = sorted(
        snap_dir.glob("time_*.json"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    for old in time_files[keep:]:
        try:
            old.unlink()
        except OSError:
            pass


def remove_legacy_auto_snapshots() -> None:
    """One-time migration: delete legacy auto_*.json snapshots (the auto-snapshot
    feature was removed). Idempotent — safe to call on every startup."""
    # 启动时 server/data 可能尚不存在（首次运行/清理后）；迁移本身要先把
    # 数据根目录建出来，不能让启动被 FileNotFoundError 打断。
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for proj in DATA_DIR.iterdir():
        snap_dir = proj / "snapshots"
        if not snap_dir.is_dir():
            continue
        for f in snap_dir.glob("auto_*.json"):
            try:
                f.unlink()
            except OSError:
                pass
