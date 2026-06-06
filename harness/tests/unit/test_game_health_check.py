"""Regression tests for the harness server health check used by wait_for_game.

`wait_for_game` now requires GET /healthz → 200 { ok: true }, matching the game
server's harness-ready probe and Vite's stable healthz gate. A bound server that
still returns 503 must not count as up.
"""
import http.server
import json
import threading
from contextlib import closing, contextmanager

from harness.steps.game import _healthz_ready, _http_ok, _http_responding


class _Status404Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (stdlib naming)
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

    def log_message(self, *args):  # silence test output
        pass


class _Healthz503Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (stdlib naming)
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": False}).encode())

    def log_message(self, *args):  # silence test output
        pass


class _Healthz200Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (stdlib naming)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def log_message(self, *args):  # silence test output
        pass


@contextmanager
def _local_http_server(handler):
    httpd = http.server.HTTPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        yield port
    finally:
        httpd.shutdown()
        t.join(timeout=5)


@contextmanager
def _server_returning_404():
    with _local_http_server(_Status404Handler) as port:
        yield port


def _free_port() -> int:
    import socket

    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_responding_server_with_404_is_up():
    # A server that answers with 404 (no /healthz route) is still up.
    with _server_returning_404() as port:
        assert _http_responding(f"http://127.0.0.1:{port}/healthz") is True


def test_old_strict_check_would_have_missed_404():
    # Documents the regression: the strict 2xx-only check rejects a healthy
    # 404-serving server, which is exactly why wait_for_game timed out.
    with _server_returning_404() as port:
        assert _http_ok(f"http://127.0.0.1:{port}/healthz") is False


def test_unbound_port_is_not_up():
    # Connection refused (nothing listening) must read as not-up.
    port = _free_port()
    assert _http_responding(f"http://127.0.0.1:{port}/healthz") is False
    assert _healthz_ready(f"http://127.0.0.1:{port}/healthz") is False


def test_healthz_503_is_not_ready():
    with _local_http_server(_Healthz503Handler) as port:
        assert _http_responding(f"http://127.0.0.1:{port}/healthz") is True
        assert _healthz_ready(f"http://127.0.0.1:{port}/healthz") is False


def test_healthz_200_ok_is_ready():
    with _local_http_server(_Healthz200Handler) as port:
        assert _healthz_ready(f"http://127.0.0.1:{port}/healthz") is True
