import Config

config :sentry, dsn: System.fetch_env!("SPOOL_FIXTURE_DSN")
