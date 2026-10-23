import json
import os
import sentry_sdk
sentry_sdk.init(dsn=os.environ['SPOOL_FIXTURE_DSN'], release='synthetic-spool-identity@1', environment='production', send_default_pii=True)
sentry_sdk.set_user(json.loads(os.environ['SPOOL_IDENTITY_USER']))
def capture():
    raise ValueError('synthetic-spool-identity-checkout')
try:
    capture()
except ValueError:
    sentry_sdk.capture_exception()
sentry_sdk.flush(timeout=10)
