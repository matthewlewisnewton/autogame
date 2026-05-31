"""Regression tests for the harness server health check used by wait_for_game.

Guards the infra failure where the game server was fully booted ("Server
listening on port 3000") but `wait_for_game` still timed out and escalated the
run as an infra failure. Cause: the server's `/healthz` route was removed (game
commit f9668ea), so polling `/healthz` returned 404; the old 2xx-only check
never recognised the healthy server as up. The fix treats any HTTP response
(including 404) as "server is up", and only a connection-level failure as down.
"""
import http.server
import threading
from contextlib import closing, contextmanager

from harness.steps.game import _http_ok, _http_responding


class _Status404Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (stdlib naming)
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

    def log_message(self, *args):  # silence test output
        pass


@contextmanager
def _server_returning_404():
    httpd = http.server.HTTPServer(("127.0.0.1", 0), _Status404Handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        yield port
    finally:
        httpd.shutdown()
        t.join(timeout=5)


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
