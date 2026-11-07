"""Unmodified sentry-sdk program: the DSN is the only value that changes between runs."""
import os
import sys

import sentry_sdk
from sentry_sdk import logger as sentry_logger
from sentry_sdk.crons import capture_checkin


def drop_marked(event, hint):
    return None if event.get("message") == "synthetic-spool-discard" else event


sentry_sdk.init(
    dsn=os.environ["SPOOL_FIXTURE_DSN"],
    before_send=drop_marked,
    environment="compatibility",
    traces_sample_rate=1.0,
    enable_logs=True,
)
# A command-line program tracks one application-mode session (release health needs a release).
sentry_sdk.start_session()
sentry_sdk.set_tag("tenant", "acme")
sentry_sdk.set_context("checkout", {"stage": "payment", "items": 3})
sentry_sdk.set_extra("cart_items", 3)
sentry_sdk.add_breadcrumb(category="checkout", message="cart reviewed", level="info")
mode = sys.argv[1]


def charge(order_note):
    password = "synthetic-spool-1"
    api_key = "synthetic-spool-2"
    quantity = 0
    try:
        return 10 / quantity
    except ZeroDivisionError as failure:
        raise ValueError("checkout quantity rejected") from failure


with sentry_sdk.start_transaction(name="checkout", op="task"):
    with sentry_sdk.start_span(op="db", name="load cart"):
        sentry_logger.info("cart loaded")
    sentry_sdk.add_attachment(bytes=b"synthetic-spool-attachment", filename="cart.txt")
    if mode == "handled":
        try:
            charge("synthetic-spool-note")
        except ValueError:
            sentry_sdk.capture_exception()
        sentry_sdk.capture_message("synthetic-spool-discard")
        capture_checkin(monitor_slug="nightly-sync", status="ok", duration=1)
        sentry_sdk.end_session()
        sentry_sdk.flush()
    else:
        charge("synthetic-spool-note")
