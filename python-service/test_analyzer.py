import json
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from analyzer import AnalyzerHandler, MAX_TEXT_CHARS, analyze  # noqa: E402
from http.server import ThreadingHTTPServer


class AnalyzerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), AnalyzerHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request(method, path, body, headers or {})
        response = connection.getresponse()
        payload = json.loads(response.read())
        connection.close()
        return response.status, payload

    def test_rules_classify_and_extract_without_translation(self):
        result = analyze({"text": "Mi factura tiene un cobro duplicado. Necesito ayuda hoy.", "language": "es"})
        self.assertEqual(result["category"], "billing")
        self.assertEqual(result["language"], "es")
        self.assertEqual(result["summary"], "Mi factura tiene un cobro duplicado. Necesito ayuda hoy.")
        self.assertEqual(result["method"], "rules-v1: deterministic keywords and extractive summary")

    def test_analyze_rejects_invalid_values(self):
        for payload in ({}, {"text": "", "language": "es"}, {"text": "ok", "language": "pt"}, {"text": "ok", "language": []}, {"text": "ok", "language": {}}, {"text": "ok", "language": None}, {"text": "x" * (MAX_TEXT_CHARS + 1), "language": "en"}):
            with self.assertRaises(ValueError):
                analyze(payload)

    def test_http_validates_json_type_and_body_size(self):
        status, payload = self.request("POST", "/analyze", "not json", {"Content-Type": "application/json", "Content-Length": "8"})
        self.assertEqual(status, 400)
        self.assertIn("error", payload)
        status, payload = self.request("POST", "/analyze", json.dumps({"text": "hello", "language": []}), {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        self.assertIn("error", payload)
        status, _ = self.request("POST", "/analyze", json.dumps({"text": "hello", "language": "en"}), {"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        status, _ = self.request("POST", "/analyze", "{}", {"Content-Type": "application/json", "Content-Length": "999999"})
        self.assertEqual(status, 400)

    def test_health_and_unknown_path(self):
        status, body = self.request("GET", "/health")
        self.assertEqual((status, body), (200, {"ok": "true"}))
        status, _ = self.request("POST", "/missing", "{}", {"Content-Type": "application/json"})
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
