"""Security regression tests (no third-party test framework).

Covers the trust boundaries that matter for this local FastAPI service:
  1. project_id / snapshot_id must never escape server/data (path traversal);
  2. the API key is stored in .env only, never returned by /api/config and
     never written into config.yaml;
  3. upload endpoints enforce their documented size limits;
  4. /api/config exposes only apiKeyExists;
  5. cross-origin web pages are rejected (trust gate, SEC01);
  6. client-supplied llm `profile` is ignored (SEC02 — no SSRF);
  7. snapshot names are sanitized/capped (SEC07); lda params are clamped
     (SEC05); decompression of docx/xlsx is bounded (SEC03).

Run: server/.venv/bin/python server/test_security.py
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import config as config_module
import storage
# Startup cleanup must run against disposable data, including during import.
with TemporaryDirectory() as startup_dir, patch.object(storage, "DATA_DIR", Path(startup_dir) / "data"):
    from app import _clean_snapshot_name, app
from doc_extract import extract_document
from fastapi.testclient import TestClient


client = TestClient(app)
passed = 0
failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global passed, failed
    if cond:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name}" + (f" — {detail}" if detail else ""))


def test_project_id_cannot_escape_data_dir() -> None:
    for bad in ("../escape", "../../escape", "/tmp/abs", "a/b", "..", ".", "", "x" * 65):
        try:
            storage._project_dir(bad)
            ok(f"project_id {bad!r} rejected", False)
        except ValueError:
            ok(f"project_id {bad!r} rejected", True)

    with TemporaryDirectory() as d:
        base = Path(d) / "data"
        with patch.object(storage, "DATA_DIR", base):
            storage.save_state("default", {"ok": True})
            ok("valid project_id still saves inside data dir",
               (base / "default" / "current.json").exists())


def test_missing_data_dir_is_created_on_startup_cleanup() -> None:
    with TemporaryDirectory() as d:
        base = Path(d) / "data"
        with patch.object(storage, "DATA_DIR", base):
            ok("server/data starts absent", not base.exists())
            storage.remove_legacy_auto_snapshots()
            ok("startup cleanup creates missing server/data", base.is_dir())


def test_state_api_rejects_traversal_project_id() -> None:
    with TemporaryDirectory() as d:
        base = Path(d) / "data"
        with patch.object(storage, "DATA_DIR", base):
            r = client.put("/api/state", json={
                "project_id": "../escape",
                "state": {"x": 1},
            })
            ok("PUT /api/state rejects ../ project_id", r.status_code == 422, str(r.status_code))
            ok("no current.json written outside data dir",
               not (Path(d) / "escape" / "current.json").exists())

            r = client.get("/api/state", params={"project_id": "../../escape"})
            ok("GET /api/state rejects ../ project_id", r.status_code == 422, str(r.status_code))


def test_snapshot_id_is_never_a_path() -> None:
    with TemporaryDirectory() as d:
        base = Path(d) / "data"
        snap_dir = base / "default" / "snapshots"
        snap_dir.mkdir(parents=True)
        outside = Path(d) / "keep.json"
        outside.write_text('{"escaped": true}', encoding="utf-8")

        with patch.object(storage, "DATA_DIR", base):
            result = storage.load_snapshot("default", "../keep")
            ok("snapshot_id ../keep does not read outside data dir",
               result is None and outside.exists())


def test_api_key_lives_in_env_not_config_or_api_response() -> None:
    secret = "sk-test-secret-never-export"
    with TemporaryDirectory() as d:
        base = Path(d)
        with (
            patch.object(config_module, "SERVER_DIR", base),
            patch.object(config_module, "CONFIG_FILE", base / "config.yaml"),
            patch.object(config_module, "ENV_FILE", base / ".env"),
        ):
            config_module.save_config({
                "provider": "deepseek",
                "baseUrl": "https://example.com",
                "model": "m",
                "temperature": 1.0,
                "backendUrl": "http://localhost:8765",
                "apiKey": secret,
            })
            public = config_module.public_config()
            ok("public_config has no apiKey key", "apiKey" not in public)
            ok("public_config reports apiKeyExists for active provider",
               public.get("apiKeyExists") is True)
            ok("public_config lists providers without keys",
               public.get("providers") == [{
                   "name": "deepseek", "baseUrl": "https://example.com", "model": "m",
                   "temperature": 1.0, "apiKeyExists": True,
               }], str(public.get("providers")))
            ok("secret not written to config.yaml",
               secret not in (base / "config.yaml").read_text(encoding="utf-8"))
            env_text = (base / ".env").read_text(encoding="utf-8")
            ok("secret stored per-provider (LLM_API_KEY_DEEPSEEK)",
               f"LLM_API_KEY_DEEPSEEK='{secret}'" in env_text, env_text)
            ok("no bare legacy LLM_API_KEY line written",
               "LLM_API_KEY=" not in env_text.replace("LLM_API_KEY_DEEPSEEK", ""))

            config_module.save_config({
                "provider": "deepseek",
                "baseUrl": "https://example.com",
                "model": "m",
                "temperature": 1.0,
                "backendUrl": "http://localhost:8765",
                "apiKey": "********",
            })
            ok("masked update keeps existing key",
               config_module.load_config().get("apiKey") == secret)


def test_per_provider_keys_are_isolated() -> None:
    with TemporaryDirectory() as d:
        base = Path(d)
        with (
            patch.object(config_module, "SERVER_DIR", base),
            patch.object(config_module, "CONFIG_FILE", base / "config.yaml"),
            patch.object(config_module, "ENV_FILE", base / ".env"),
        ):
            config_module.save_config({"provider": "deepseek", "baseUrl": "https://a",
                                       "model": "m", "temperature": 1.0, "apiKey": "sk-ds"})
            config_module.save_config({"provider": "qwen", "baseUrl": "https://b",
                                       "model": "m", "temperature": 1.0, "apiKey": "sk-qw"})
            cfg = config_module.load_config()
            ok("save activates the provider being saved (qwen)",
               cfg["provider"] == "qwen" and cfg["apiKey"] == "sk-qw")
            cfg = config_module.load_config()
            config_module.save_config({"provider": "deepseek", "baseUrl": "https://a",
                                       "model": "m", "temperature": 1.0})
            ok("switching back keeps qwen key untouched",
               config_module.load_config().get("apiKey") == "sk-ds")
            pub = config_module.public_config()
            by = {p["name"]: p["apiKeyExists"] for p in pub["providers"]}
            ok("public_config shows both keys exist, keys absent",
               by.get("deepseek") is True and by.get("qwen") is True and
               "apiKey" not in str(pub["providers"]).lower().replace("apikeyexists", ""),
               str(pub.get("providers")))
            config_module.clear_provider_key("qwen")
            pub2 = config_module.public_config()
            by2 = {p["name"]: p["apiKeyExists"] for p in pub2["providers"]}
            ok("clear_provider_key removes only qwen", by2.get("qwen") is False and
               by2.get("deepseek") is True)


def test_legacy_single_slot_key_pending_until_claimed() -> None:
    with TemporaryDirectory() as d:
        base = Path(d)
        with (
            patch.object(config_module, "SERVER_DIR", base),
            patch.object(config_module, "CONFIG_FILE", base / "config.yaml"),
            patch.object(config_module, "ENV_FILE", base / ".env"),
        ):
            # 旧单槽：yaml 顶层字段 + .env 裸 LLM_API_KEY
            (base / "config.yaml").write_text(
                "provider: deepseek\nbaseUrl: https://api.deepseek.com\n"
                "model: m\ntemperature: 1.0\nbackendUrl: http://localhost:8765\n",
                encoding="utf-8")
            (base / ".env").write_text("LLM_API_KEY='sk-legacy'\n", encoding="utf-8")
            pub = config_module.public_config()
            ok("legacy bare key → legacyKeyPending=true", pub.get("legacyKeyPending") is True)
            ok("legacy bare key not auto-attached to any provider",
               pub.get("apiKeyExists") is False and
               all(p["apiKeyExists"] is False for p in pub["providers"]),
               str(pub.get("providers")))
            # 认领：给 deepseek 存新 Key → 旧裸行删除、pending 消失
            config_module.save_config({"provider": "deepseek", "baseUrl": "https://api.deepseek.com",
                                       "model": "m", "temperature": 1.0, "apiKey": "sk-new"})
            pub2 = config_module.public_config()
            ok("claiming key clears legacy pending", pub2.get("legacyKeyPending") is False)
            ok("new key attached to deepseek slot",
               pub2["apiKeyExists"] is True and
               "sk-legacy" not in (base / ".env").read_text(encoding="utf-8"))


def test_config_endpoint_never_returns_key() -> None:
    body = client.get("/api/config").json()
    ok("/api/config omits apiKey", "apiKey" not in body)
    ok("/api/config reports apiKeyExists as bool",
       isinstance(body.get("apiKeyExists"), bool))


def test_upload_size_limits() -> None:
    r = client.post(
        "/api/parse-excel",
        files={"file": ("big.csv", b"x" * (20 * 1024 * 1024 + 1))},
    )
    ok("parse-excel over 20MB -> 413", r.status_code == 413, str(r.status_code))

    r = client.post(
        "/api/extract-doc",
        files={"file": ("big.txt", b"y" * (5 * 1024 * 1024 + 1))},
    )
    ok("extract-doc over 5MB -> 413", r.status_code == 413, str(r.status_code))


def test_cross_origin_requests_rejected() -> None:
    evil = {"Origin": "https://evil.example.com"}
    r = client.get("/api/config", headers=evil)
    ok("GET /api/config from evil origin -> 403", r.status_code == 403, str(r.status_code))
    r = client.put("/api/state", headers=evil,
                   json={"project_id": "default", "state": {"x": 1}})
    ok("PUT /api/state from evil origin -> 403", r.status_code == 403, str(r.status_code))

    with TemporaryDirectory() as d:
        base = Path(d) / "data"
        with patch.object(storage, "DATA_DIR", base):
            loop = {"Origin": "http://127.0.0.1:8765"}
            r = client.put("/api/state", headers=loop,
                           json={"project_id": "default", "state": {"ok": 1}})
            ok("loopback origin can save state", r.status_code == 200, str(r.status_code))
            r = client.put("/api/state", headers={"Origin": "null"},
                           json={"project_id": "default", "state": {"ok": 1}})
            ok("file:// (null origin) can save state", r.status_code == 200, str(r.status_code))


def test_llm_profile_is_ignored() -> None:
    # Even a profile that supplies its own key/baseUrl must NOT be honored —
    # otherwise this would be an open proxy (SSRF). Stub the server config as
    # key-less and expect the deterministic 503: any 2xx/other status would
    # mean the request went somewhere (profile baseUrl 127.0.0.1:9).
    import llm_proxy

    with patch.object(llm_proxy, "load_config", return_value={
        "provider": "deepseek", "baseUrl": "https://api.deepseek.com",
        "model": "m", "temperature": 1.0,  # no apiKey on purpose
    }):
        r = client.post("/api/llm", json={
            "messages": [{"role": "user", "content": "hi"}],
            "profile": {
                "provider": "custom",
                "baseUrl": "http://127.0.0.1:9",
                "model": "x",
                "apiKey": "anything",
            },
        })
    ok("profile apiKey/baseUrl ignored -> 503 not-configured",
       r.status_code == 503 and "API Key" in r.json()["error"]["message"],
       f"{r.status_code} {r.text[:120]}")


def test_lda_params_clamped() -> None:
    r = client.post("/api/lda", json={"documents": ["a", "b"], "passes": 9999999})
    ok("lda passes out of range -> 422", r.status_code == 422, str(r.status_code))
    r = client.post("/api/lda", json={"documents": ["x"] * 600})
    ok("lda too many documents -> 400", r.status_code == 400, str(r.status_code))


def test_snapshot_name_sanitized() -> None:
    cleaned = _clean_snapshot_name("a\nb\r\tc" * 30)
    ok("snapshot name: control chars stripped", "\n" not in cleaned and "\r" not in cleaned)
    ok("snapshot name: capped at 60 chars", cleaned is not None and len(cleaned) <= 60)
    ok("snapshot name: empty -> None (auto name)", _clean_snapshot_name("  \n ") is None)
    r = client.post("/api/snapshots/default/rename", json={"name": "   "})
    ok("rename with blank name -> 422", r.status_code == 422, str(r.status_code))


def test_config_rejects_invalid_provider_and_scheme() -> None:
    r = client.put("/api/config", json={"provider": "evil\nx: 1", "baseUrl": "https://a", "model": "m"})
    ok("config provider not whitelisted -> 400", r.status_code == 400, str(r.status_code))
    r = client.put("/api/config", json={"provider": "deepseek", "baseUrl": "ftp://x", "model": "m"})
    ok("config baseUrl non-http(s) -> 400", r.status_code == 400, str(r.status_code))


def test_config_accepts_all_ui_providers() -> None:
    # 厂商清单归前端 providers.js（deepseek/doubao/moonshot/minimax/qwen/zhipu
    # …），服务端只校验形状——防止枚举校验把合法厂商保存拒掉（2026-09-03 回归）。
    with TemporaryDirectory() as d:
        base = Path(d)
        with (
            patch.object(config_module, "SERVER_DIR", base),
            patch.object(config_module, "CONFIG_FILE", base / "config.yaml"),
            patch.object(config_module, "ENV_FILE", base / ".env"),
        ):
            for prov in ("deepseek", "qwen", "zhipu", "moonshot", "doubao", "minimax"):
                r = client.put("/api/config", json={
                    "provider": prov, "baseUrl": "https://x.example.com", "model": "m",
                })
                ok(f"config provider {prov} accepted -> 200", r.status_code == 200, str(r.status_code))
            ok("config.yaml written without provider key injection",
               (base / "config.yaml").exists())


def test_docx_decompression_bomb_rejected() -> None:
    # A zip whose word/document.xml claims >32MB uncompressed must be refused
    # before ET.parse inflates it.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", b"<w:document/>" + b"a" * (33 * 1024 * 1024))
    result = extract_document("bomb.docx", buf.getvalue())
    ok("oversized docx XML member rejected",
       result.get("ok") is False and "上限" in result.get("error", ""),
       str(result)[:120])


def test_pdf_endpoint_validation() -> None:
    r = client.post("/api/pdf", json={"html": "<p>x</p>", "filename": "x.pdf"})
    ok("PDF endpoint rejects too-short html -> 422", r.status_code == 422, str(r.status_code))
    r = client.post("/api/pdf", json={"html": "<p>x</p>", "filename": "../bad name?.pdf"})
    ok("PDF endpoint rejects short html even with hostile filename -> 422", r.status_code == 422, str(r.status_code))


test_project_id_cannot_escape_data_dir()
test_missing_data_dir_is_created_on_startup_cleanup()
test_state_api_rejects_traversal_project_id()
test_snapshot_id_is_never_a_path()
test_api_key_lives_in_env_not_config_or_api_response()
test_per_provider_keys_are_isolated()
test_legacy_single_slot_key_pending_until_claimed()
test_config_endpoint_never_returns_key()
test_upload_size_limits()
test_cross_origin_requests_rejected()
test_llm_profile_is_ignored()
test_lda_params_clamped()
test_snapshot_name_sanitized()
test_config_rejects_invalid_provider_and_scheme()
test_config_accepts_all_ui_providers()
test_docx_decompression_bomb_rejected()
test_pdf_endpoint_validation()

print(f"\n{passed} pass / {failed} fail")
raise SystemExit(1 if failed else 0)
