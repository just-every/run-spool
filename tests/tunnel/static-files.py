"""HTTP regression for the Python tunnel journey's static-file boundary."""
import http.client
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest


class StaticFiles(unittest.TestCase):
    def test_static_reads_stay_inside_the_root(self):
        with tempfile.TemporaryDirectory(prefix="spool-tunnel-static-") as temporary:
            root = Path(temporary) / "site"
            root.mkdir()
            sibling = Path(temporary) / "site-other"
            sibling.mkdir()
            public = b"<title>synthetic-spool-static</title>"
            (root / "page.html").write_bytes(public)
            (root / "page.js").write_bytes(b"// synthetic-spool-static\n")
            (root / "directory").mkdir()
            (sibling / "outside.txt").write_bytes(b"synthetic-spool-outside-root")
            (root / "outside.txt").symlink_to(sibling / "outside.txt")
            (root / "alias.html").symlink_to(root / "page.html")
            with socket.socket() as reservation:
                reservation.bind(("127.0.0.1", 0))
                port = reservation.getsockname()[1]
            server = subprocess.Popen(
                [sys.executable, str(Path(__file__).with_name("server.py")), str(port), str(root),
                 "http://synthetic-spool-1@127.0.0.1:1/9"],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )
            try:
                def request(path):
                    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
                    try:
                        connection.request("GET", path)
                        response = connection.getresponse()
                        return response.status, response.getheader("content-type"), response.read()
                    finally:
                        connection.close()

                deadline = time.monotonic() + 5
                while True:
                    try:
                        status, _, body = request("/page.html")
                        break
                    except ConnectionRefusedError:
                        if server.poll() is not None or time.monotonic() >= deadline:
                            self.fail("Python tunnel test server did not start")
                        time.sleep(0.05)
                self.assertEqual((status, body), (200, public))
                for path in ("/page.html", "/nested/page.html", "/alias.html"):
                    with self.subTest(path=path):
                        self.assertEqual(request(path), (200, "text/html", public))
                self.assertEqual(request("/page.js"), (200, "text/javascript", b"// synthetic-spool-static\n"))
                for path in ("/outside.txt", "/../outside.txt", "/%2e%2e/outside.txt",
                             "/directory", "/missing.html", "/", "/.."):
                    with self.subTest(path=path):
                        status, _, body = request(path)
                        self.assertEqual((status, body), (404, b""))
                status, _, body = request("/peak-rss")
                self.assertEqual(status, 200)
                self.assertEqual(json.loads(body)["pid"], server.pid)
                self.assertEqual(request("/monitoring")[0], 405)
                self.assertEqual(request("/page.html")[0], 200)
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)
                server.stderr.close()


if __name__ == "__main__":
    unittest.main()
