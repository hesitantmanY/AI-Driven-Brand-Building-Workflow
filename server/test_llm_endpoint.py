"""Regression: /api/llm 的校验与 Gemini 请求构建必须走被测试的模块。

背景（2026-09-01 架构评审）：llm_validate.py 与 gemini_body.py 曾长期
只有自测、从未被生产 import——测试在测死代码。本测试锁死两条接缝：
  1. llm_endpoint 先过 validate_llm_request，非法请求 400；
  2. _proxy_gemini 用 build_gemini_body 构建请求体（system_instruction /
     responseMimeType 真正上线）。

Run: server/.venv/bin/python server/test_llm_endpoint.py
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import storage
with TemporaryDirectory() as startup_dir, patch.object(storage, "DATA_DIR", Path(startup_dir) / "data"):
    from app import app
import llm_proxy


client = TestClient(app)


def test_invalid_messages_rejected() -> None:
    r = client.post("/api/llm", json={"messages": []})
    assert r.status_code == 400
    assert "at least" in r.json()["detail"]
    print("PASS: empty messages → 400")


def test_temperature_out_of_range_rejected() -> None:
    r = client.post(
        "/api/llm",
        json={"messages": [{"role": "user", "content": "hi"}], "opts": {"temperature": 3.0}},
    )
    assert r.status_code == 400
    assert "temperature" in r.json()["detail"]
    print("PASS: temperature 3.0 → 400")


def test_valid_request_reaches_proxy() -> None:
    captured: dict = {}

    async def fake_proxy(messages, opts, profile):
        captured["messages"] = messages
        captured["opts"] = opts
        return 200, {"ok": True}

    with patch("app.proxy_llm", side_effect=fake_proxy):
        r = client.post(
            "/api/llm",
            json={"messages": [{"role": "user", "content": "hi"}], "opts": {"temperature": 0.7}},
        )
    assert r.status_code == 200
    assert captured["messages"] == [{"role": "user", "content": "hi"}]
    print("PASS: valid request passes validation and reaches proxy")


def test_gemini_proxy_uses_build_gemini_body() -> None:
    captured: dict = {}

    class FakeResp:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}

    async def fake_post(url, headers=None, params=None, json=None):
        captured["json"] = json
        return FakeResp()

    http_client = AsyncMock()
    http_client.post = AsyncMock(side_effect=fake_post)
    client_cls = MagicMock()
    client_cls.return_value.__aenter__ = AsyncMock(return_value=http_client)
    client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("llm_proxy.httpx.AsyncClient", client_cls):
        status, data = asyncio.run(
            llm_proxy._proxy_gemini(
                "https://example.com/v1beta",
                "gemini-2.0-flash",
                "test-key",
                [
                    {"role": "system", "content": "你是品牌顾问"},
                    {"role": "user", "content": "hi"},
                ],
                0.5,
                {"response_format": {"type": "json_object"}},
            )
        )

    body = captured["json"]
    assert status == 200
    assert data["_text"] == "ok"
    assert body["system_instruction"] == {"parts": [{"text": "你是品牌顾问"}]}
    assert body["contents"] == [{"role": "user", "parts": [{"text": "hi"}]}]
    assert body["generationConfig"] == {
        "temperature": 0.5,
        "responseMimeType": "application/json",
    }
    print("PASS: _proxy_gemini uses build_gemini_body (system_instruction + JSON mode)")


if __name__ == "__main__":
    test_invalid_messages_rejected()
    test_temperature_out_of_range_rejected()
    test_valid_request_reaches_proxy()
    test_gemini_proxy_uses_build_gemini_body()
    print("\nAll llm endpoint seam tests passed")
