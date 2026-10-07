"""FastAPI entry point. Serves the HTML tool and provides API endpoints for config, state, snapshots, LLM proxy, LDA, and Excel parsing."""
from __future__ import annotations

import json
import mimetypes
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Some machines (notably Windows) don't register the woff2 MIME type; without
# it StaticFiles serves the font as application/octet-stream and browsers refuse it.
mimetypes.add_type("font/woff2", ".woff2")

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from config import (
    clear_provider_key,
    discard_legacy_key,
    load_config,
    public_config,
    save_config,
)
from doc_extract import extract_document
from excel_parser import parse_spreadsheet
from lda import run_lda
from llm_proxy import proxy_llm
from llm_validate import validate_llm_request
from storage import (
    create_snapshot,
    delete_snapshot,
    list_snapshots,
    load_snapshot,
    load_state,
    remove_legacy_auto_snapshots,
    rename_snapshot,
    restore_snapshot,
    save_state,
    snapshot_metadata,
)

ROOT = Path(__file__).resolve().parent.parent
HTML_FILE = ROOT / "docs" / "global-brand-building.html"
# project_id becomes a directory name under server/data; only safe basenames
# are allowed (same contract as storage._PROJECT_ID_RE).
PROJECT_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"

app = FastAPI(title="Global Brand Building and Marketing Communication", version="0.2.0")

# The HTML is opened from disk (file://, Origin "null") or served at / — the
# trust gate below still lets both through while blocking remote websites.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Trust gate (SEC01 / SEC05) -------------------------------------------
# The service is unauthenticated and bound to localhost. Without this gate any
# webpage the user visits could drive it cross-origin: rewrite the LLM config
# (baseUrl → attacker), then POST /api/llm so the real API key is sent to the
# attacker, read/rewrite the whole brand plan, and burn LLM quota.
# Allow only loopback origins plus "null" (page opened from disk as file://).
# Requests without an Origin header (curl, same-origin navigations) pass.
# ponytail: file:// and any loopback-served page count as the operator; a
# locally downloaded .html is the same trust level as running the tool.
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}
_MAX_JSON_BODY = 32 * 1024 * 1024  # /api/state + /api/lda body cap


def _origin_allowed(origin: str | None) -> bool:
    if not origin or origin == "null":
        return True
    try:
        return urlparse(origin).hostname in _LOOPBACK_HOSTS
    except ValueError:
        return False


@app.middleware("http")
async def _api_trust_gate(request, call_next):
    path = request.url.path
    if path.startswith("/api/"):
        origin = request.headers.get("origin")
        if not _origin_allowed(origin):
            return JSONResponse(status_code=403,
                                content={"error": "cross-origin request denied"})
        if request.method in ("PUT", "POST") and path in ("/api/state", "/api/lda", "/api/pdf"):
            cl = request.headers.get("content-length")
            if cl and cl.isdigit() and int(cl) > _MAX_JSON_BODY:
                return JSONResponse(status_code=413,
                                    content={"error": "request body too large"})
    return await call_next(request)

# One-time migration: the auto-snapshot feature was removed; delete legacy
# auto_*.json files (idempotent, runs once per process start).
remove_legacy_auto_snapshots()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class LdaRequest(BaseModel):
    documents: list[str]
    k: int = Field(default=5, ge=2, le=15)
    passes: int = Field(default=15, ge=1, le=200)
    iterations: int = Field(default=100, ge=1, le=1000)
    no_below: int = Field(default=2, ge=0, le=50)
    no_above: float = Field(default=0.5, gt=0, le=1.0)
    language: str = "zh"


class PdfRequest(BaseModel):
    html: str = Field(..., min_length=80)
    filename: str = Field(default="brand-client-plan.pdf", max_length=160)

    @field_validator("filename")
    @classmethod
    def _safe_filename(cls, name: str) -> str:
        safe = re.sub(r"[\\/:*?\"<>|\s]+", "-", name).strip(".-") or "brand-client-plan.pdf"
        if not safe.lower().endswith(".pdf"):
            safe += ".pdf"
        return safe[:160]


class ConfigUpdate(BaseModel):
    provider: str = "deepseek"
    baseUrl: str = ""
    model: str = ""
    apiKey: str | None = None  # None or "********" means keep existing
    temperature: float = 1.0
    backendUrl: str = ""


class LlmRequest(BaseModel):
    messages: list[dict[str, Any]]
    opts: dict[str, Any] | None = None
    # Kept for API compatibility only; server ignores it (SEC02) — a
    # client-supplied profile previously overrode baseUrl/model/apiKey and
    # turned /api/llm into an open proxy (SSRF).
    profile: dict[str, Any] | None = None


def _clean_snapshot_name(name: str | None) -> str | None:
    """Strip control characters/newlines and cap length (SEC07).

    Empty-after-clean → None (auto time-based name) for create, error for
    rename (storage requires a real name there).
    """
    if name is None:
        return None
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    return name[:60] if name else None


class SnapshotCreate(BaseModel):
    project_id: str = Field(default="default", pattern=PROJECT_ID_PATTERN)
    name: str | None = None
    overwrite: bool = False  # True = replace same-named version (user confirmed)

    @field_validator("name")
    @classmethod
    def _name_valid(cls, v: str | None) -> str | None:
        return _clean_snapshot_name(v)


class SnapshotRename(BaseModel):
    name: str
    overwrite: bool = False
    copy_source: bool = Field(default=False, alias="copy")

    @field_validator("name")
    @classmethod
    def _name_valid(cls, v: str) -> str:
        cleaned = _clean_snapshot_name(v)
        if cleaned is None:
            raise ValueError("版本名不能为空")
        return cleaned


class StateSave(BaseModel):
    project_id: str = Field(default="default", pattern=PROJECT_ID_PATTERN)
    state: dict[str, Any]


class ProviderAction(BaseModel):
    name: str = Field(pattern=PROJECT_ID_PATTERN)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": "0.2.0"}


@app.post("/api/pdf")
def pdf_endpoint(req: PdfRequest) -> Response:
    """Render a client PDF from the HTML produced by docs/lib/pdf_export.js.

    The page is first opened on the local service origin so the project's
    tokens.css custom properties apply, then the submitted HTML replaces the
    document. Playwright/Chromium is already part of server/.venv; the browser
    binary must be installed once via `playwright install chromium`.
    """
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # pragma: no cover - import error only
        raise HTTPException(status_code=503,
                            detail="Playwright 未安装，请在 server/.venv 执行 pip install playwright") from exc

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={"width": 1440, "height": 1100})
                page.goto("http://127.0.0.1:8765/", wait_until="domcontentloaded")
                page.set_content(req.html, wait_until="networkidle")
                page.wait_for_timeout(1600)  # fonts / SVG / webfont settle
                pdf = page.pdf(
                    format="A4",
                    print_background=True,
                    display_header_footer=False,
                    margin={"top": "14mm", "bottom": "16mm", "left": "15mm", "right": "15mm"},
                )
            finally:
                browser.close()
    except Exception as exc:
        raise HTTPException(status_code=500,
                            detail=f"PDF 渲染失败：{exc}") from exc

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            # ASCII-only header; the browser uses <a download> to set the real
            # Chinese filename, so no RFC5987 dance is needed here.
            "Content-Disposition": 'attachment; filename="brand-client-plan.pdf"',
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@app.get("/api/config")
def get_config() -> dict:
    """Return config without exposing the API key."""
    return public_config()


@app.put("/api/config")
def update_config(cfg: ConfigUpdate) -> dict:
    """Save config to config.yaml + .env."""
    data = cfg.model_dump()
    # SEC06 修订（2026-09-03）：不枚举厂商名——前端 docs/lib/providers.js 才是
    # 厂商清单；枚举会让 qwen/zhipu/moonshot/doubao 等合法厂商保存被 400 拒绝
    # （回归教训）。这里只保形状：yaml 写入已走 safe_dump（注入面封死），
    # provider 值仅用于 gemini 分流，非法形状直接拒。
    provider = str(data.get("provider") or "")
    if not re.match(r"^[A-Za-z][A-Za-z0-9_\-]{0,31}$", provider):
        raise HTTPException(status_code=400, detail=f"provider 非法: {provider}")
    base = data.get("baseUrl") or ""
    if base and not re.match(r"^https?://", base):
        raise HTTPException(status_code=400, detail="baseUrl 必须以 http(s):// 开头")
    # If apiKey is None or masked, don't update the key
    if data.get("apiKey") in (None, "", "********"):
        data.pop("apiKey", None)
    merged = save_config(data)
    merged.pop("apiKey", None)
    merged["apiKeyExists"] = bool(load_config().get("apiKey"))
    return merged


@app.post("/api/config/clear-key")
def clear_key_endpoint(a: ProviderAction) -> dict:
    """清除指定厂商在 .env 里的 Key（多厂商配置，2026-09-03）。"""
    try:
        clear_provider_key(a.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return public_config()


@app.post("/api/config/discard-legacy")
def discard_legacy_endpoint() -> dict:
    """删除旧单槽遗留的裸 LLM_API_KEY 行（不自动归属任何厂商）。"""
    discard_legacy_key()
    return public_config()


# ---------------------------------------------------------------------------
# LLM Proxy
# ---------------------------------------------------------------------------

@app.post("/api/llm")
async def llm_endpoint(req: LlmRequest) -> JSONResponse:
    ok, errors = validate_llm_request(req.model_dump())
    if not ok:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    status, data = await proxy_llm(req.messages, req.opts, req.profile)
    return JSONResponse(status_code=status, content=data)


# ---------------------------------------------------------------------------
# Project state persistence
# ---------------------------------------------------------------------------

@app.get("/api/state")
def get_state(project_id: str = Query("default", pattern=PROJECT_ID_PATTERN)) -> dict | None:
    state = load_state(project_id)
    if state is None:
        raise HTTPException(status_code=404, detail="No saved state")
    return state


@app.put("/api/state")
@app.post("/api/state")  # POST alias for navigator.sendBeacon on page unload
def put_state(body: StateSave) -> dict:
    save_state(body.project_id, body.state)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Snapshots
# ---------------------------------------------------------------------------

@app.get("/api/snapshots")
def get_snapshots(project_id: str = Query("default", pattern=PROJECT_ID_PATTERN)) -> list[dict]:
    return list_snapshots(project_id)


@app.post("/api/snapshots")
def post_snapshot(body: SnapshotCreate) -> dict:
    try:
        snap = create_snapshot(body.project_id, name=body.name, overwrite=body.overwrite)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return snap


@app.get("/api/snapshots/{snapshot_id}")
def get_snapshot(snapshot_id: str, project_id: str = Query("default", pattern=PROJECT_ID_PATTERN)) -> dict:
    data = load_snapshot(project_id, snapshot_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return data


@app.post("/api/snapshots/{snapshot_id}/restore")
def restore_snapshot_endpoint(snapshot_id: str, project_id: str = Query("default", pattern=PROJECT_ID_PATTERN)) -> dict:
    meta = snapshot_metadata(project_id, snapshot_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    try:
        data = restore_snapshot(project_id, snapshot_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if data is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    response = {"ok": True, "state": data, "snapshot": meta}
    json.dumps(response, ensure_ascii=False)
    return response


@app.delete("/api/snapshots/{snapshot_id}")
def delete_snapshot_endpoint(snapshot_id: str, project_id: str = Query("default", pattern=PROJECT_ID_PATTERN)) -> dict:
    if not delete_snapshot(project_id, snapshot_id):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"ok": True}


@app.post("/api/snapshots/{snapshot_id}/rename")
def rename_snapshot_endpoint(snapshot_id: str, body: SnapshotRename, project_id: str = Query("default", pattern=PROJECT_ID_PATTERN)) -> dict:
    try:
        snap = rename_snapshot(project_id, snapshot_id, body.name, overwrite=body.overwrite, copy=body.copy_source)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if snap is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    json.dumps(snap, ensure_ascii=False)
    return snap


# ---------------------------------------------------------------------------
# LDA
# ---------------------------------------------------------------------------

@app.post("/api/lda")
def lda_endpoint(req: LdaRequest) -> dict:
    if not req.documents:
        raise HTTPException(status_code=400, detail="documents is empty")
    if len(req.documents) > 500 or sum(len(d) for d in req.documents) > 5_000_000:
        raise HTTPException(status_code=400,
                            detail="documents 过大（上限 500 条 / 总计 5MB）")
    return run_lda(
        documents=req.documents,
        k=req.k,
        passes=req.passes,
        iterations=req.iterations,
        no_below=req.no_below,
        no_above=req.no_above,
        language=req.language,
    )


# ---------------------------------------------------------------------------
# Excel parsing
# ---------------------------------------------------------------------------

@app.post("/api/parse-excel")
async def parse_excel_endpoint(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (max 20MB)")
    result = parse_spreadsheet(file.filename or "upload.xlsx", data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/extract-doc")
async def extract_doc_endpoint(file: UploadFile = File(...)) -> dict:
    """Extract plain text from an uploaded context file (txt/md/csv/docx/pdf).

    Used by the global file drawer so users can feed their own documents
    (research notes, reports, transcripts) into AI prompts. 5MB per file.
    """
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件过大（单文件上限 5MB）")
    result = extract_document(file.filename or "upload.txt", data)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "解析失败"))
    return result


# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

@app.get("/")
def index() -> FileResponse:
    if not HTML_FILE.exists():
        raise HTTPException(status_code=404, detail="HTML file not found")
    return FileResponse(HTML_FILE, media_type="text/html",
                        headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


# Serve workshop JS modules and demo data from docs/.
# The HTML references them by bare filename (same-origin), so serve them at root.
DOCS_DIR = ROOT / "docs"
if DOCS_DIR.exists():
    app.mount("/docs", StaticFiles(directory=str(DOCS_DIR)), name="docs")
    FONTS_DIR = DOCS_DIR / "fonts"
    if FONTS_DIR.exists():
        app.mount("/fonts", StaticFiles(directory=str(FONTS_DIR)), name="fonts")

    @app.get("/{filename}")
    def docs_file(filename: str) -> FileResponse:
        candidate = DOCS_DIR / filename
        if candidate.is_file() and filename.endswith((".js", ".css", ".png", ".jpg", ".svg", ".ico", ".json", ".html")):
            media = "text/javascript" if filename.endswith(".js") else None
            return FileResponse(str(candidate), media_type=media,
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        raise HTTPException(status_code=404, detail="not found")

    # Nested lib/ scripts (e.g. lib/demo_notes.js) — the single-segment route
    # above cannot match a slash, so serve them explicitly.
    @app.get("/lib/{filename}")
    def lib_file(filename: str) -> FileResponse:
        candidate = DOCS_DIR / "lib" / filename
        if candidate.is_file() and filename.endswith((".js", ".css")):
            media = "text/javascript" if filename.endswith(".js") else None
            return FileResponse(str(candidate), media_type=media,
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        raise HTTPException(status_code=404, detail="not found")

    # Nested cases/ scripts (e.g. cases/douya-mama/work1.js) — demo case data.
    @app.get("/cases/{filename}")
    def cases_root_file(filename: str) -> FileResponse:
        import re
        if not re.fullmatch(r"[a-zA-Z0-9\-_]+\.\w+", filename):
            raise HTTPException(status_code=404, detail="not found")
        candidate = DOCS_DIR / "cases" / filename
        if candidate.is_file() and filename.endswith((".js", ".css")):
            media = "text/javascript" if filename.endswith(".js") else None
            return FileResponse(str(candidate), media_type=media,
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        raise HTTPException(status_code=404, detail="not found")

    @app.get("/cases/{brand}/{filename}")
    def case_file(brand: str, filename: str) -> FileResponse:
        import re
        if not re.fullmatch(r"[a-zA-Z0-9\-_]+", brand) or not re.fullmatch(r"[a-zA-Z0-9\-_]+\.\w+", filename):
            raise HTTPException(status_code=404, detail="not found")
        candidate = DOCS_DIR / "cases" / brand / filename
        if candidate.is_file() and filename.endswith((".js", ".css")):
            media = "text/javascript" if filename.endswith(".js") else None
            return FileResponse(str(candidate), media_type=media,
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        raise HTTPException(status_code=404, detail="not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8765)
