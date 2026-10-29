"""Test server for the Python tunnel: static files from a directory, the tunnel at POST /monitoring and this process's
id and peak resident memory (KiB) at /peak-rss, so the journey can bound what one request costs the host."""
import json
import os
import resource
import sys
from werkzeug.serving import WSGIRequestHandler, make_server

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "packages", "tunnel-python"))
from spool_tunnel import Tunnel

port, root, dsns = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
tunnel = Tunnel(dsn=dsns)
types = {".html": "text/html", ".js": "text/javascript"}


def app(environ, start_response):
    if environ["PATH_INFO"] == "/monitoring":
        return tunnel.wsgi(environ, start_response)
    if environ["PATH_INFO"] == "/peak-rss":
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        start_response("200 OK", [("content-type", "application/json")])
        return [json.dumps({"pid": os.getpid(), "maxRSS": peak // 1024 if sys.platform == "darwin" else peak}).encode()]
    path = os.path.join(root, os.path.basename(environ["PATH_INFO"]))
    if not os.path.isfile(path):
        start_response("404 Not Found", [])
        return [b""]
    start_response("200 OK", [("content-type", types.get(os.path.splitext(path)[1], "text/plain"))])
    return [open(path, "rb").read()]


class Quiet(WSGIRequestHandler):
    def log(self, *args):
        pass


print("listening", flush=True)
make_server("127.0.0.1", port, app, request_handler=Quiet).serve_forever()
