#!/usr/bin/env python3
"""Exercise the packaged shell probe against real HTTP responses and failures."""
import http.server
import os
import pathlib
import socket
import subprocess
import tempfile
import threading
import time
import unittest

PROBE = pathlib.Path(__file__).resolve().parents[1] / "apps/api/docker/healthcheck.sh"


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/slow":
            time.sleep(3)
        status = {"/ok": 200, "/empty": 204, "/redirect": 302, "/unhealthy": 503}.get(self.path, 200)
        self.send_response(status)
        if self.path == "/redirect":
            self.send_header("Location", "/ok")
        self.send_header("Content-Length", "0")
        try:
            self.end_headers()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *_args):
        pass


class HealthcheckTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join()

    def probe(self, endpoint, env=None):
        return subprocess.run(
            ["/bin/sh", str(PROBE), endpoint], capture_output=True, text=True,
            timeout=5, env=env,
        )

    def test_accepts_http_200(self):
        result = self.probe(self.base + "/ok")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_other_success_status(self):
        self.assertEqual(self.probe(self.base + "/empty").returncode, 1)

    def test_rejects_redirect_to_healthy_endpoint(self):
        self.assertEqual(self.probe(self.base + "/redirect").returncode, 1)

    def test_rejects_http_503(self):
        self.assertEqual(self.probe(self.base + "/unhealthy").returncode, 1)

    def test_rejects_connection_refusal(self):
        with socket.socket() as bound:
            bound.bind(("127.0.0.1", 0))
            endpoint = f"http://127.0.0.1:{bound.getsockname()[1]}/health"
            self.assertEqual(self.probe(endpoint).returncode, 1)

    def test_bounds_slow_response(self):
        started = time.monotonic()
        self.assertEqual(self.probe(self.base + "/slow").returncode, 1)
        self.assertLess(time.monotonic() - started, 3)

    def test_ignores_proxy_environment(self):
        env = {**os.environ, "http_proxy": "http://127.0.0.1:1", "no_proxy": "", "NO_PROXY": ""}
        result = self.probe(self.base + "/ok", env)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_ignores_curlrc_redirect_setting(self):
        with tempfile.TemporaryDirectory() as directory:
            pathlib.Path(directory, ".curlrc").write_text("location\n", encoding="utf-8")
            env = {**os.environ, "CURL_HOME": directory}
            self.assertEqual(self.probe(self.base + "/redirect", env).returncode, 1)


if __name__ == "__main__":
    unittest.main()
