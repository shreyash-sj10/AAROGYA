import json
import os
from urllib import request, error


LLM_ENDPOINT = os.getenv("AI_LLM_ENDPOINT", "").strip()
LLM_TIMEOUT_SEC = float(os.getenv("AI_LLM_TIMEOUT_SEC", "2.5"))


def _extract_text(parsed):
    if isinstance(parsed, dict):
        for key in ["text", "output", "response", "content"]:
            value = parsed.get(key)
            if isinstance(value, str):
                return value
        choices = parsed.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                for key in ["text", "message", "content"]:
                    value = first.get(key)
                    if isinstance(value, str):
                        return value
                message = first.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str):
                        return content
    return ""


def llm_health_status():
    if not LLM_ENDPOINT:
        return {
            "ok": False,
            "reason": "AI_LLM_ENDPOINT is not configured",
            "endpoint": "",
        }

    req = request.Request(LLM_ENDPOINT, method="GET")
    try:
        with request.urlopen(req, timeout=LLM_TIMEOUT_SEC) as response:
            return {
                "ok": 200 <= int(getattr(response, "status", 200)) < 500,
                "reason": "reachable",
                "endpoint": LLM_ENDPOINT,
            }
    except error.HTTPError as http_error:
        return {
            "ok": True,
            "reason": f"reachable_http_{http_error.code}",
            "endpoint": LLM_ENDPOINT,
        }
    except (error.URLError, TimeoutError, ValueError):
        return {
            "ok": False,
            "reason": "endpoint_unreachable",
            "endpoint": LLM_ENDPOINT,
        }


def call_llm(prompt: str) -> str:
    safe_prompt = (prompt or "").strip()
    if not safe_prompt:
        return ""

    if not LLM_ENDPOINT:
        return ""

    payload = json.dumps({"prompt": safe_prompt}).encode("utf-8")
    req = request.Request(
        LLM_ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=LLM_TIMEOUT_SEC) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw)
            return _extract_text(parsed).strip()
    except (error.URLError, error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError):
        return ""
