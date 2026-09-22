"""Deterministic, local ticket analysis for the support application."""

from __future__ import annotations

import json
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY_BYTES = 16_384
MAX_TEXT_CHARS = 6_000
METHOD = "rules-v1: deterministic keywords and extractive summary"

CATEGORIES = {
    "billing": ("factura", "facturación", "cobro", "pago", "precio", "invoice", "billing", "charged", "payment", "refund"),
    "technical": ("error", "fallo", "no funciona", "problema", "bug", "crash", "login", "cannot", "can't", "broken"),
    "account": ("cuenta", "contraseña", "usuario", "acceso", "account", "password", "profile", "sign in"),
    "shipping": ("envío", "entrega", "pedido", "reparto", "shipping", "delivery", "order", "tracking"),
}


def classify(text: str) -> str:
    """Choose the category with the most keyword matches; ties keep this order."""
    normalized = text.casefold()
    winner, score = "general", 0
    for category, keywords in CATEGORIES.items():
        matches = sum(keyword in normalized for keyword in keywords)
        if matches > score:
            winner, score = category, matches
    return winner


def summarize(text: str, limit: int = 480) -> str:
    """Return up to two original sentences without inventing text."""
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if part.strip()]
    summary = ""
    for sentence in sentences[:2]:
        candidate = f"{summary} {sentence}".strip()
        if len(candidate) > limit:
            break
        summary = candidate
        if len(summary) >= 160:
            break
    return summary or text.strip()[:limit]


def analyze(payload: object) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise ValueError("JSON must be an object.")
    text = payload.get("text")
    language = payload.get("language")
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT_CHARS:
        raise ValueError("text must contain 1 to 6000 characters.")
    if not isinstance(language, str) or language not in {"es", "en"}:
        raise ValueError("language must be es or en.")
    clean = text.strip()
    return {"category": classify(clean), "language": language, "summary": summarize(clean), "method": METHOD}


class AnalyzerHandler(BaseHTTPRequestHandler):
    server_version = "SupportAnalyzer/1.0"

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, format: str, *args: object) -> None:
        return

    def respond(self, status: HTTPStatus, body: dict[str, str]) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.respond(HTTPStatus.OK, {"ok": "true"})
        else:
            self.respond(HTTPStatus.NOT_FOUND, {"error": "Route not found."})

    def do_POST(self) -> None:
        if self.path != "/analyze":
            self.respond(HTTPStatus.NOT_FOUND, {"error": "Route not found."})
            return
        if self.headers.get_content_type() != "application/json":
            self.respond(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "Send JSON."})
            return
        try:
            length = int(self.headers.get("Content-Length", ""))
            if length < 1 or length > MAX_BODY_BYTES:
                raise ValueError("Request body is too large or invalid.")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("Request body is incomplete.")
            self.respond(HTTPStatus.OK, analyze(json.loads(raw)))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            self.respond(HTTPStatus.BAD_REQUEST, {"error": str(error) or "Invalid JSON."})


def serve(host: str = "127.0.0.1", port: int = 8001) -> None:
    ThreadingHTTPServer((host, port), AnalyzerHandler).serve_forever()


if __name__ == "__main__":
    serve()
