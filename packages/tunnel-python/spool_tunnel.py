"""Server-side tunnel for the Sentry browser SDK's standard `tunnel` option, for Python servers.

Ad-blockers block requests to ingest hosts and paths. The page posts its envelope to a same-origin route
instead and this module forwards it to the Spool project it is configured for. Standard library only.

    from spool_tunnel import Tunnel
    tunnel = Tunnel(dsn=os.environ["SPOOL_DSN"])
    # WSGI (Flask, Django, Pyramid, plain wsgiref): mount tunnel.wsgi at the tunnel path, POST only.
    # Any other framework: status, headers, body = tunnel.forward(body, request_headers, client_address)
"""
import json
import urllib.error
import urllib.request
import zlib
from urllib.parse import urlsplit

LIMIT = 1_048_576
FORWARDED = ("content-type", "content-encoding", "user-agent", "origin", "referer")
RETURNED = ("content-type", "retry-after", "x-sentry-rate-limits", "x-sentry-error")


def _target(dsn):
    url = urlsplit(dsn)
    project = url.path.lstrip("/")
    if url.scheme not in ("http", "https") or not url.username or url.password or not project.isdigit():
        raise ValueError("A Spool DSN names an HTTP(S) origin, a public key and a numeric project")
    return (url.username, f"{url.scheme}://{url.netloc.rpartition('@')[2]}", project)


def _refuse(status, error):
    return status, {"content-type": "application/json"}, json.dumps({"error": error}).encode()


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect is never followed: the envelope goes to the configured Spool origin or nowhere."""

    def redirect_request(self, *args):
        return None


def _decode(body, encoding):
    """The decoded envelope, inflated at most one byte past LIMIT so a decompression bomb is never expanded."""
    if encoding == "identity":
        return body
    inflater = zlib.decompressobj({"gzip": 16 + zlib.MAX_WBITS, "deflate": zlib.MAX_WBITS}[encoding])
    plain = inflater.decompress(body, LIMIT + 1)
    if len(plain) <= LIMIT and not inflater.eof:
        raise zlib.error("truncated")
    return plain


class Tunnel:
    def __init__(self, dsn):
        """`dsn` is one Spool project DSN or a list of them; an envelope naming any other is refused."""
        self.allowed = [_target(value) for value in ([dsn] if isinstance(dsn, str) else dsn)]
        if not self.allowed:
            raise ValueError("At least one Spool DSN is required")
        self.opener = urllib.request.build_opener(_NoRedirect)

    def forward(self, body, headers, client_address=None):
        """Forward one envelope. `headers` maps lower-case request header names to values."""
        if not body or len(body) > LIMIT:
            return _refuse(413 if body else 400, "Envelope too large" if body else "Empty envelope")
        encoding = (headers.get("content-encoding") or "identity").lower()
        if encoding not in ("gzip", "deflate", "identity"):
            return _refuse(415, "Unsupported content encoding")
        try:
            plain = _decode(body, encoding)
        except zlib.error:
            return _refuse(400, "Envelope could not be decoded")
        if len(plain) > LIMIT:
            return _refuse(413, "Envelope too large")
        # The envelope's first line is its header; its DSN decides where, and whether, the envelope goes.
        try:
            named = _target(json.loads(plain.split(b"\n", 1)[0].decode())["dsn"])
        except (ValueError, KeyError, TypeError, AttributeError):
            return _refuse(400, "Envelope header names no valid DSN")
        if named not in self.allowed:
            return _refuse(403, "Envelope DSN is not served by this tunnel")
        out = {"content-type": "application/x-sentry-envelope"}
        out.update({name: headers[name] for name in FORWARDED if headers.get(name)})
        if client_address:
            out["x-forwarded-for"] = client_address
        request = urllib.request.Request(f"{named[1]}/api/{named[2]}/envelope/", data=body, headers=out, method="POST")
        try:
            response = self.opener.open(request, timeout=10)
        except urllib.error.HTTPError as failure:
            response = failure
        except OSError:
            return _refuse(502, "Spool could not be reached")
        with response:
            status = response.status if hasattr(response, "status") else response.code
            if 300 <= status < 400:
                return _refuse(502, "Spool answered with a redirect, which the tunnel does not follow")
            reply = response.read(LIMIT + 1)
        if len(reply) > LIMIT:
            return _refuse(502, "Spool could not be reached")
        returned = {name: response.headers[name] for name in RETURNED if response.headers.get(name)}
        return status, returned, reply

    def wsgi(self, environ, start_response):
        length = environ.get("CONTENT_LENGTH") or "0"
        if environ["REQUEST_METHOD"] != "POST":
            status, headers, body = _refuse(405, "Tunnel accepts POST only")
        elif not length.isdigit():
            status, headers, body = _refuse(400, "Envelope length is not a number")
        elif int(length) > LIMIT:
            status, headers, body = _refuse(413, "Envelope too large")
        else:
            size = int(length)
            headers_in = {key[5:].replace("_", "-").lower(): value for key, value in environ.items() if key.startswith("HTTP_")}
            headers_in["content-type"] = environ.get("CONTENT_TYPE", "")
            forwarded = headers_in.get("x-forwarded-for", "").split(",")[0].strip()
            status, headers, body = self.forward(environ["wsgi.input"].read(size), headers_in, forwarded or environ.get("REMOTE_ADDR"))
        start_response(f"{status} {'OK' if status == 200 else 'Refused'}", list(headers.items()))
        return [body]
