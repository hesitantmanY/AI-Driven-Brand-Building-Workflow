"""Shared real-browser acceptance harness with a disposable FastAPI data store.

Only Python source is copied to the disposable server. Existing data, .env and
provider settings are never read by that server. All browser API traffic is
redirected to it; paid LLM calls are blocked.
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "issues/2026-10-06-interaction-implementation/evidence"


class Harness:
    def __init__(self, *, group="all", cases=None):
        self.group = group
        self.selected = set(cases or [])
        self.results = []
        self.requests = []
        self.errors = []
        self._case = None
        self._contexts = []

    def __enter__(self):
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        self.evidence = EVIDENCE
        self._temp = tempfile.TemporaryDirectory(prefix="brand-interaction-acceptance-")
        self.temp = Path(self._temp.name)
        server_dir = self.temp / "server"
        server_dir.mkdir()
        (server_dir / "data").mkdir()
        for source in (ROOT / "server").glob("*.py"):
            if not source.name.startswith("test_"):
                shutil.copy2(source, server_dir / source.name)
        (self.temp / "docs").symlink_to(ROOT / "docs", target_is_directory=True)
        if (ROOT / "fonts").is_dir():
            (self.temp / "fonts").symlink_to(ROOT / "fonts", target_is_directory=True)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.base = f"http://127.0.0.1:{port}"
        self._server_log = open(self.temp / "server.log", "w+")
        # Preserve OS paths/locales, excluding all provider keys and app config.
        environment = {key: value for key, value in os.environ.items()
                       if key in {"PATH", "HOME", "USER", "LANG", "TMPDIR", "SYSTEMROOT"}
                       or key.startswith("LC_")}
        self._server = subprocess.Popen(
            [str(ROOT / "server/.venv/bin/python"), "-m", "uvicorn", "app:app",
             "--host", "127.0.0.1", "--port", str(port)],
            cwd=server_dir, env=environment,
            stdout=self._server_log, stderr=subprocess.STDOUT,
        )
        deadline = time.monotonic() + 45
        while True:
            try:
                if self.api("GET", "/api/health")["status"] == "ok":
                    break
            except (OSError, urllib.error.URLError):
                if self._server.poll() is not None or time.monotonic() >= deadline:
                    self._server_log.seek(0)
                    log = self._server_log.read()
                    self.__exit__(None, None, None)
                    raise RuntimeError("Isolated server failed to start: " + log)
                time.sleep(0.15)
        self._playwright = sync_playwright().start()
        launch = {"headless": True}
        for candidate in (
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ):
            if Path(candidate).exists():
                launch["executable_path"] = candidate
                break
        self.browser = self._playwright.chromium.launch(**launch)
        self.page = self.new_page(viewport={"width": 1440, "height": 900})
        self.page.goto(self.base + "/docs/global-brand-building.html?w=1&s=sbu",
                       wait_until="domcontentloaded")
        self.wait_ready()
        return self

    def __exit__(self, *_args):
        if hasattr(self, "browser"):
            self.browser.close()
        if hasattr(self, "_playwright"):
            self._playwright.stop()
        if hasattr(self, "_server"):
            self._server.terminate()
            try:
                self._server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self._server.kill()
                self._server.wait(timeout=5)
        if hasattr(self, "_server_log"):
            self._server_log.close()
        if hasattr(self, "_temp"):
            self._temp.cleanup()

    def route(self, route):
        request = route.request
        parsed = urllib.parse.urlsplit(request.url)
        path = parsed.path + ("?" + parsed.query if parsed.query else "")
        self.requests.append({"method": request.method, "path": path,
                              "case": self._case["code"] if self._case else None})
        if parsed.path == "/api/llm":
            route.fulfill(status=503, content_type="application/json",
                          body='{"detail":"Paid LLM calls are blocked in acceptance"}',
                          headers={"Access-Control-Allow-Origin": "*"})
            return
        response = route.fetch(url=self.base + path)
        if parsed.path == "/api/config" and request.method == "GET":
            data = response.json()
            data.update(backendUrl=self.base, apiKeyExists=False, legacyKeyPending=False)
            route.fulfill(response=response, json=data)
        else:
            route.fulfill(response=response)

    def new_page(self, *, touch=False, viewport=None):
        context = self.browser.new_context(
            viewport=viewport or {"width": 1440, "height": 900},
            has_touch=touch,
        )
        self._contexts.append(context)
        context.route("**/api/**", self.route)
        page = context.new_page()
        page.set_default_timeout(8000)
        page.on("dialog", lambda dialog: dialog.accept())
        page.on("pageerror", lambda error: self.errors.append({
            "case": self._case["code"] if self._case else None, "error": str(error)}))
        return page

    def wait_ready(self):
        self.page.wait_for_function(
            "window.App && window.Interaction && document.querySelector('.workshop.active .step.active')",
            timeout=20000,
        )

    def api(self, method, path, data=None):
        body = None if data is None else json.dumps(data, ensure_ascii=False).encode()
        encoded_path = urllib.parse.quote(path, safe="/?=&%")
        request = urllib.request.Request(self.base + encoded_path, data=body, method=method,
                                        headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                raw = response.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise

    def seed(self, js="", *, work=1, step="sbu"):
        # Reload resets transient tasks, injected failures and undo timers.
        self.page.goto(self.base + "/docs/global-brand-building.html?w=1&s=sbu",
                       wait_until="domcontentloaded")
        self.wait_ready()
        self.page.evaluate("""async fixture => {
            state = defaultState();
            state.settings.api = {...state.settings.api, backendUrl: fixture.base,
                                  apiKey:'', apiKeyExists:false, manualMode:true};
            state.settings.manualMode = true;
            Interaction.invalidateUndo();
            eval(fixture.js);
            state.meta.currentWork = fixture.work;
            state.meta.currentStep = fixture.step;
            App.renderAll();
            dirty = false;
            if (await saveNow() !== true) throw new Error('Synthetic fixture save failed');
        }""", {"js": js, "work": work, "step": step, "base": self.base})
        self.wait_idle()

    def check(self, label, condition, details=None):
        assertion = {"label": label, "passed": bool(condition)}
        if details is not None:
            assertion["details"] = details
        if self._case:
            self._case["assertions"].append(assertion)
        if not condition:
            raise AssertionError(label + (": " + str(details) if details is not None else ""))

    def case(self, code, title, callback):
        if self.selected and code not in self.selected:
            return
        record = {"code": code, "title": title, "assertions": [], "passed": False}
        self._case = record
        started = time.monotonic()
        error_start = len(self.errors)
        try:
            callback()
            new_errors = self.errors[error_start:]
            self.check("No uncaught browser errors", not new_errors, new_errors or None)
            record["passed"] = True
        except Exception as error:
            record["error"] = str(error)
            record["traceback"] = traceback.format_exc(limit=5)
            try:
                record["screenshot"] = self.screenshot(code + "-failure")
            except Exception:
                pass
        finally:
            record["seconds"] = round(time.monotonic() - started, 2)
            self.results.append(record)
            self._case = None
            print(f"{code} {'PASS' if record['passed'] else 'FAIL'}: {title}", flush=True)
            if not record["passed"]:
                print("  " + record.get("error", "assertion failed"), flush=True)

    def goto(self, work, step):
        self.page.locator(f'.tab[data-work="{work}"]').click()
        target = self.page.locator(f'.subtab[data-target="{step}"]')
        if target.count():
            target.click()
        self.page.wait_for_function(
            "pos => App.currentWork === pos.work && App.currentStep === pos.step",
            arg={"work": work, "step": step},
        )

    def wait_idle(self):
        self.page.wait_for_function("""() => !History._operation && !SavePanel._busy &&
            !App._resetPending && !App._importPending && !Work5._syncPending""", timeout=15000)

    def confirm(self, label):
        self.page.locator('[role="dialog"]:visible').last.get_by_role(
            "button", name=label, exact=True).click()

    def open_history(self):
        self.page.get_by_role("button", name="历史记录", exact=True).click()
        self.page.locator("#historyModal.open").wait_for(state="visible")
        self.page.wait_for_function("!History._operation && History._snapshots")

    def save_version(self, name):
        self.page.locator("#saveBtn").click()
        self.page.locator("#saveName").fill(name)
        self.page.locator("#savePopup button.primary").click()
        self.wait_idle()
        return self.snapshot(name)

    def snapshot(self, name):
        return next((snapshot for snapshot in self.api("GET", "/api/snapshots")
                     if snapshot.get("name") == name), None)

    def clear_archive(self):
        for snapshot in self.api("GET", "/api/snapshots"):
            self.api("DELETE", "/api/snapshots/" + snapshot["id"])

    def screenshot(self, name):
        path = self.evidence / (name + ".png")
        self.page.screenshot(path=str(path), full_page=True)
        return str(path.relative_to(ROOT))

    def write_results(self):
        result = {
            "group": self.group,
            "isolation": "Temporary server source and empty data; no real archives or provider keys",
            "browser": self.browser.version,
            "cases": self.results,
            "passed": sum(record["passed"] for record in self.results),
            "failed": sum(not record["passed"] for record in self.results),
            "api_requests": self.requests,
            "uncaught_errors": self.errors,
        }
        path = self.evidence / ("acceptance-" + self.group + ".json")
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(f"Evidence: {path}", flush=True)
        return result
