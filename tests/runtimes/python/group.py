"""Unmodified sentry-sdk program: an exception group with default integrations."""
import os

import sentry_sdk

sentry_sdk.init(dsn=os.environ["SPOOL_FIXTURE_DSN"], environment="compatibility")


def settle(order_note):
    pending = [1, 2, 3]
    raise ExceptionGroup("settlement batch failed", [ValueError("synthetic-spool-first"), TypeError("synthetic-spool-second")])


try:
    settle("synthetic-spool-note")
except ExceptionGroup:
    sentry_sdk.capture_exception()
sentry_sdk.flush()
