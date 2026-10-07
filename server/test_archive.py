"""Archive API/storage acceptance regressions using synthetic temporary data only.

Run: server/.venv/bin/python server/test_archive.py
The app import's startup cleanup is also redirected before it can touch data.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import storage
from fastapi.testclient import TestClient


class ArchiveTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with TemporaryDirectory() as d, patch.object(storage, "DATA_DIR", Path(d) / "startup"):
            from app import app
        cls.client = TestClient(app, raise_server_exceptions=False)

    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.data_dir = Path(self.temp.name) / "data"
        patcher = patch.object(storage, "DATA_DIR", self.data_dir)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.source_state = {
            "meta": {"loadedFrom": "old", "loadedFromId": "named_old", "isDemo": True, "demoCase": "synthetic", "demoSnapshot": {}},
            "settings": {"api": {"backendUrl": "http://synthetic-local"}},
            "work1": {"marker": "historical source"},
            "work2": {}, "work3": {}, "work4": {}, "work5": {},
        }
        self.live_state = {"meta": {}, "work1": {"marker": "live edits"}}
        self.source = storage.create_snapshot("default", "源版本", state=self.source_state)
        self.target_state = {"work1": {"marker": "target old content"}}
        self.target = storage.create_snapshot("default", "终版", state=self.target_state)
        storage.save_state("default", self.live_state)

    def rename(self, **body):
        return self.client.post(f"/api/snapshots/{self.source['id']}/rename", json={"name": "终版", **body})

    def test_rename_copy_uses_selected_history_and_preserves_both_versions(self) -> None:
        storage.create_snapshot("default", "终版(1)", state={"work1": {"marker": "suffix already used"}})
        response = self.rename(copy=True)
        self.assertEqual(response.status_code, 200)
        meta = response.json()
        self.assertEqual(meta["name"], "终版(2)")
        self.assertEqual(storage.load_snapshot("default", meta["id"]), self.source_state)
        self.assertEqual(storage.load_snapshot("default", self.source["id"]), self.source_state)
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.target_state)
        self.assertEqual(storage.load_state(), self.live_state)
        self.assertEqual(len(storage.list_snapshots()), 4)
        json.dumps(meta)

    def test_rename_overwrite_moves_source_and_atomically_replaces_target(self) -> None:
        response = self.rename(overwrite=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.target["id"])
        self.assertIsNone(storage.load_snapshot("default", self.source["id"]))
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.source_state)
        self.assertEqual(storage.load_state(), self.live_state)
        self.assertEqual(len(storage.list_snapshots()), 1)

    def test_failed_atomic_overwrite_keeps_source_and_target(self) -> None:
        with patch.object(storage.os, "replace", side_effect=OSError("synthetic write denied")):
            response = self.rename(overwrite=True)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(storage.load_snapshot("default", self.source["id"]), self.source_state)
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.target_state)
        self.assertEqual(storage.load_state(), self.live_state)

    def test_failed_copy_keeps_all_existing_versions(self) -> None:
        with patch.object(storage, "_atomic_write", side_effect=OSError("synthetic write denied")):
            response = self.rename(copy=True)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(storage.load_snapshot("default", self.source["id"]), self.source_state)
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.target_state)
        self.assertEqual(len(storage.list_snapshots()), 2)
        self.assertEqual(storage.load_state(), self.live_state)

    def test_normal_rename_and_same_name_copy_have_distinct_semantics(self) -> None:
        response = self.rename(name="源版本", copy=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "源版本(1)")
        self.assertEqual(storage.load_snapshot("default", self.source["id"]), self.source_state)
        response = self.rename(name="新名")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "新名")
        self.assertIsNone(storage.load_snapshot("default", self.source["id"]))
        self.assertEqual(storage.load_snapshot("default", response.json()["id"]), self.source_state)

    def test_blank_rename_and_incompatible_copy_are_rejected_without_writes(self) -> None:
        self.assertEqual(self.rename(name="   ").status_code, 422)
        self.assertEqual(self.rename(copy=True, overwrite=True).status_code, 400)
        self.assertEqual(len(storage.list_snapshots()), 2)
        self.assertEqual(storage.load_snapshot("default", self.source["id"]), self.source_state)

    def test_create_conflict_uses_live_state_and_keeps_or_overwrites_target(self) -> None:
        response = self.client.post("/api/snapshots", json={"name": "终版"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "终版(1)")
        self.assertEqual(storage.load_snapshot("default", response.json()["id"]), self.live_state)
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.target_state)
        response = self.client.post("/api/snapshots", json={"name": "终版", "overwrite": True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "终版")
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.live_state)

    def test_restore_replaces_only_live_file_and_persists_actual_source_metadata(self) -> None:
        before_ids = {meta["id"] for meta in storage.list_snapshots()}
        response = self.client.post(f"/api/snapshots/{self.source['id']}/restore")
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["ok"])
        self.assertEqual(result["snapshot"]["name"], "源版本")
        self.assertEqual(result["state"]["work1"]["marker"], "historical source")
        self.assertEqual(result["state"]["meta"]["loadedFromId"], self.source["id"])
        self.assertEqual(result["state"]["meta"]["loadedFrom"], self.source["name"])
        self.assertFalse(result["state"]["meta"]["isDemo"])
        self.assertIsNone(result["state"]["meta"]["demoCase"])
        self.assertEqual(storage.load_state(), result["state"])
        self.assertEqual({meta["id"] for meta in storage.list_snapshots()}, before_ids)
        self.assertEqual(storage.load_snapshot("default", self.source["id"]), self.source_state)
        json.dumps(result)

    def test_missing_or_corrupt_restore_never_changes_live_workspace(self) -> None:
        self.assertEqual(self.client.post("/api/snapshots/missing/restore").status_code, 404)
        for value in ([], {}, {"meta": {}, "settings": {}}, {"work1": False}, {"work1": {}, "meta": ["invalid"]}):
            bad = self.data_dir / "default" / "snapshots" / "named_bad.json"
            bad.write_text(json.dumps(value), encoding="utf-8")
            response = self.client.post("/api/snapshots/named_bad/restore")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(storage.load_state(), self.live_state)

    def test_time_names_are_consistent_across_create_list_and_restore(self) -> None:
        original = storage.time.strftime
        def frozen(fmt, value=None):
            if fmt == "%Y%m%d_%H%M%S":
                return "20261006_120000"
            return original(fmt, value) if value is not None else original(fmt)
        with patch.object(storage.time, "strftime", side_effect=frozen):
            first = self.client.post("/api/snapshots", json={"name": "   "}).json()
            second = self.client.post("/api/snapshots", json={"name": None}).json()
        self.assertEqual(first["type"], "time")
        self.assertEqual(second["name"], first["name"] + " (2)")
        listed = {meta["id"]: meta for meta in storage.list_snapshots()}
        self.assertEqual(listed[first["id"]]["name"], first["name"])
        self.assertEqual(listed[second["id"]]["name"], second["name"])
        restored = self.client.post(f"/api/snapshots/{second['id']}/restore").json()
        self.assertEqual(restored["snapshot"]["name"], second["name"])
        self.assertEqual(storage.load_state()["meta"]["loadedFrom"], second["name"])

    def test_delete_only_removes_selected_snapshot_and_keeps_live_workspace(self) -> None:
        response = self.client.delete(f"/api/snapshots/{self.source['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        self.assertIsNone(storage.load_snapshot("default", self.source["id"]))
        self.assertEqual(storage.load_snapshot("default", self.target["id"]), self.target_state)
        self.assertEqual(storage.load_state(), self.live_state)


if __name__ == "__main__":
    unittest.main(verbosity=2)
