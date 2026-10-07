#!/usr/bin/env python3
"""Deterministic browser smoke scan for all five workshops.

Serves docs/ locally and mocks /api/* so the scan never touches saved project
data. It checks that every workshop/step mounts without console/page errors and
exercises representative fill/create interactions.

Run:
    server/.venv/bin/python scripts/ui_smoke.py
"""
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
PORT = 8777
BASE = f"http://127.0.0.1:{PORT}"
STEPS = {
    1: ["sbu", "environment", "personas", "metrics", "survey", "analysis", "values", "recommendations"],
    2: ["framework", "evaluate", "decision"],
    3: ["scenarios", "mining", "candidates", "matrix", "proposition", "identity"],
    4: ["route", "product", "price", "place", "promotion"],
    5: ["plan"],
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def api_route(route):
    url = route.request.url
    method = route.request.method.upper()
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if method == "OPTIONS":
        route.fulfill(status=204, headers=headers)
        return
    if url.endswith("/api/health"):
        route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}', headers=headers)
        return
    if url.endswith("/api/config"):
        route.fulfill(status=200, content_type="application/json", body=(
            '{"provider":"deepseek","baseUrl":"https://api.deepseek.com","model":"test",'
            f'"temperature":1.0,"backendUrl":"{BASE}","apiKeyExists":false,"active":"deepseek",'
            '"providers":[],"legacyKeyPending":false}'
        ), headers=headers)
        return
    if "/api/state" in url and method == "GET":
        route.fulfill(status=200, content_type="application/json", body="null", headers=headers)
        return
    if "/api/state" in url and method in {"POST", "PUT"}:
        route.fulfill(status=200, content_type="application/json", body='{"ok":true}', headers=headers)
        return
    if "/api/snapshots" in url and method == "GET":
        route.fulfill(status=200, content_type="application/json", body="[]", headers=headers)
        return
    route.fulfill(status=200, content_type="application/json", body="{}", headers=headers)


def main() -> None:
    handler = functools.partial(QuietHandler, directory=str(DOCS))
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    failures: list[str] = []
    console_errors: list[str] = []
    with sync_playwright() as p:
        launch = {"headless": True}
        for candidate in (
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ):
            if Path(candidate).exists():
                launch["executable_path"] = candidate
                break
        browser = p.chromium.launch(**launch)
        page = browser.new_page()
        page.route("**/api/**", api_route)
        page.on("console", lambda msg: console_errors.append(f"console {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(f"pageerror {exc}"))
        page.on("response", lambda res: console_errors.append(f"http {res.status} {res.url}") if res.status >= 400 else None)

        for work, steps in STEPS.items():
            for step in steps:
                page.goto(f"{BASE}/global-brand-building.html?w={work}&s={step}", wait_until="domcontentloaded")
                page.wait_for_function("document.querySelector('#sumSbu') && document.querySelector('.workshop.active .step.active')", timeout=5000)
                active = page.locator(".workshop.active .step.active")
                if active.count() != 1:
                    failures.append(f"W{work}/{step}: active step count={active.count()}")
                heading = active.locator("h2, h3").first
                if heading.count() and not heading.inner_text().strip():
                    failures.append(f"W{work}/{step}: blank heading")

        page.goto(f"{BASE}/global-brand-building.html?w=1&s=sbu", wait_until="domcontentloaded")
        page.get_by_placeholder("例：豆芽妈妈母婴洗护 / 问渠书院素质培训").fill("UI扫描品牌")
        if "UI扫描品牌" not in page.locator("#sumSbu").inner_text():
            failures.append("W1 SBU input did not update masthead")

        page.goto(f"{BASE}/global-brand-building.html?w=1&s=environment", wait_until="domcontentloaded")
        page.get_by_role("button", name="+ 添加竞品").click()
        page.get_by_placeholder("竞品名称").fill("UI竞品")
        if page.get_by_placeholder("竞品名称").input_value() != "UI竞品":
            failures.append("W1 competitor create/fill failed")

        page.goto(f"{BASE}/global-brand-building.html?w=1&s=personas", wait_until="domcontentloaded")
        page.get_by_role("button", name="+ 添加画像").click()
        if page.get_by_role("button", name="删除").count() == 0:
            failures.append("W1 persona create did not render")

        page.goto(f"{BASE}/global-brand-building.html?w=2&s=framework", wait_until="domcontentloaded")
        page.get_by_role("button", name="+ 添加候选市场").click()
        candidate = page.locator("table.data tbody tr input").first
        candidate.fill("UI市场")
        if candidate.input_value() != "UI市场":
            failures.append("W2 candidate create/fill failed")

        page.goto(f"{BASE}/global-brand-building.html?w=3&s=scenarios", wait_until="domcontentloaded")
        page.get_by_role("button", name="+ 添加场景").click()
        page.get_by_placeholder("场景名（≤12 字）").first.fill("UI场景")
        if page.get_by_placeholder("场景名（≤12 字）").first.input_value() != "UI场景":
            failures.append("W3 scenario create/fill failed")

        page.goto(f"{BASE}/global-brand-building.html?w=3&s=mining", wait_until="domcontentloaded")
        checkbox_widths = page.locator(".workshop.active .step.active input[type=checkbox]:visible").evaluate_all("els => els.map(e => e.getBoundingClientRect().width)")
        if any(width > 28 for width in checkbox_widths):
            failures.append(f"W3 checkbox controls too wide: {checkbox_widths}")
        page.get_by_placeholder("粘贴评论/访谈/工单，每行一条或空行分隔…").fill("第一条测试语料\n第二条测试语料\n第三条测试语料")
        page.get_by_role("button", name="添加到语料").click()
        page.wait_for_timeout(50)
        if "本地真实 3 条" not in page.locator("#steps3 .step.active").inner_text():
            failures.append("W3 corpus count did not refresh after add")

        page.goto(f"{BASE}/global-brand-building.html?w=4&s=place", wait_until="domcontentloaded")
        partner = page.get_by_placeholder("输入伙伴名称回车添加")
        partner.fill("UI伙伴")
        partner.press("Enter")
        if "UI伙伴" not in page.locator("#steps4 .step.active").inner_text():
            failures.append("W4 partner create failed")

        page.goto(f"{BASE}/global-brand-building.html?w=4&s=promotion", wait_until="domcontentloaded")
        add_labels = page.locator(".workshop.active .step.active button").all_inner_texts()
        if any(label.strip() == "+ 添加" for label in add_labels):
            failures.append("W4 has generic + 添加 buttons without object labels")

        page.goto(f"{BASE}/global-brand-building.html?w=5&s=plan", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelector('#steps5 .step.active') && document.querySelector('#steps5 .step.active').innerText.includes('业务与市场')", timeout=5000)
        readiness_labels = page.locator(".readiness button").all_inner_texts()
        if any(label.strip() == "去完成 →" for label in readiness_labels):
            failures.append("W5 readiness buttons are not target-specific")
        w5_text = page.locator("#steps5").inner_text()
        if "业务与市场" not in w5_text:
            failures.append("W5 plan chapter did not render: " + w5_text[:500].replace("\n", " / "))

        browser.close()
    server.shutdown()
    server.server_close()

    failures.extend(f"console: {msg}" for msg in console_errors)
    if failures:
        print("UI SMOKE FAIL")
        for item in failures:
            print(" -", item)
        raise SystemExit(1)
    print(f"UI SMOKE PASS: {sum(map(len, STEPS.values()))} workshop steps + representative fill/create interactions")


if __name__ == "__main__":
    main()
