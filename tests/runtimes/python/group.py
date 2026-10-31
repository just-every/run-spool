"""Unmodified sentry-sdk program: an exception group with default integrations."""
import os
import sys
import asyncio

import sentry_sdk

sentry_sdk.init(dsn=os.environ["SPOOL_FIXTURE_DSN"], environment="compatibility")


def settle(order_note):
    pending = [1, 2, 3]
    raise ExceptionGroup("settlement batch failed", [ValueError("synthetic-spool-first"), TypeError("synthetic-spool-second")])


async def fail(error):
    raise error("synthetic-spool-task")


async def parallel():
    async with asyncio.TaskGroup() as tasks:
        tasks.create_task(fail(ValueError))
        tasks.create_task(fail(TypeError))


try:
    if sys.argv[1:] == ["taskgroup"]:
        asyncio.run(parallel())
    else:
        settle("synthetic-spool-note")
except ExceptionGroup:
    sentry_sdk.capture_exception()
sentry_sdk.flush()
