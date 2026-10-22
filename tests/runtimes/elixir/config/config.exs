import Config

config :sentry,
  environment_name: "compatibility",
  traces_sample_rate: 1.0,
  logs: [level: :info]

config :opentelemetry,
  span_processor: {Sentry.OpenTelemetry.SpanProcessor, []},
  sampler: {Sentry.OpenTelemetry.Sampler, []}
