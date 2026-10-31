"""Unmodified sentry-sdk program: a nested asyncio.TaskGroup failure with default integrations."""
import asyncio
import os

import sentry_sdk

sentry_sdk.init(dsn=os.environ["SPOOL_FIXTURE_DSN"], environment="compatibility")


async def reserve(sku):
    raise KeyError(sku)


async def charge(card):
    raise ValueError(card)


async def notify(channel):
    raise TypeError(channel)


async def settle():
    async with asyncio.TaskGroup() as payments:
        payments.create_task(reserve("synthetic-spool-sku"))
        payments.create_task(charge("synthetic-spool-card"))


async def checkout():
    async with asyncio.TaskGroup() as order:
        order.create_task(settle())
        order.create_task(notify("synthetic-spool-channel"))


try:
    asyncio.run(checkout())
except ExceptionGroup:
    sentry_sdk.capture_exception()
sentry_sdk.flush()
