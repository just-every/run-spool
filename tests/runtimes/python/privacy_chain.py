"""Pinned, unmodified SDK program; only the destination DSN changes."""
import os

import sentry_sdk
from sentry_sdk.scrubber import EventScrubber

# Let synthetic canaries reach the collector so Spool must enforce server scrubbing.
sentry_sdk.init(dsn=os.environ["SPOOL_FIXTURE_DSN"], environment="compatibility", event_scrubber=EventScrubber(denylist=[], pii_denylist=[]))


def checkout():
    password = "synthetic-spool-f113-password"
    api_key = "synthetic-spool-f113-api-key"
    quantity = 7
    order_note = "synthetic-spool-f113-ordinary"
    try:
        raise KeyError("checkout account missing")
    except KeyError as failure:
        raise ValueError("checkout failed") from failure


try:
    checkout()
except ValueError:
    sentry_sdk.capture_exception()
sentry_sdk.flush()
