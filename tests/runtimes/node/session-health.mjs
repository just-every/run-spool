import * as Sentry from '@sentry/node';
// Default process-session integration stays enabled. Only DSN differs between collectors.
Sentry.init({dsn:process.env.SPOOL_FIXTURE_DSN,release:process.env.SENTRY_RELEASE,environment:'production'});
Sentry.setUser({id:process.env.SPOOL_SESSION_USER});
if(process.argv[2]==='crash')setTimeout(()=>{throw new Error('synthetic-spool-session-crash')},0);
else {Sentry.endSession();await Sentry.flush(10000);await Sentry.close(10000)}
