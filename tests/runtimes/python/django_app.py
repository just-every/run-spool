"""Unmodified sentry-sdk program: Django request data through a real WSGI request."""
import os
import sys
import threading
import urllib.error
import urllib.request
from wsgiref.simple_server import WSGIRequestHandler, make_server

import sentry_sdk
from sentry_sdk.scrubber import EventScrubber

sys.path.insert(0, os.path.dirname(__file__))
os.environ["DJANGO_SETTINGS_MODULE"] = "shop.settings"
# Let synthetic canaries reach the collector so Spool must enforce server scrubbing.
sentry_sdk.init(dsn=os.environ["SPOOL_FIXTURE_DSN"], environment="compatibility", event_scrubber=EventScrubber(denylist=[], pii_denylist=[]), send_default_pii=True)

from django.core.wsgi import get_wsgi_application


class Quiet(WSGIRequestHandler):
    def log_message(self, *args):
        pass


server = make_server("127.0.0.1", 0, get_wsgi_application(), handler_class=Quiet)
threading.Thread(target=server.handle_request).start()
request = urllib.request.Request(
    f"http://127.0.0.1:{server.server_port}/checkout?token=synthetic-spool-3&page=2",
    headers={"Cookie": "session=synthetic-spool-cookie", "User-Agent": "spool-runtime-qualification", "Authorization": "Bearer synthetic-spool-f113-authorization"},
)
try:
    urllib.request.urlopen(request)
except urllib.error.HTTPError as failure:
    assert failure.code == 500
sentry_sdk.flush()
