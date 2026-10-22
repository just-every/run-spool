defmodule SpoolRuntime.MixProject do
  use Mix.Project

  def project do
    [app: :spool_runtime, version: "1.0.0", elixir: "~> 1.17", deps: deps()]
  end

  def application, do: [extra_applications: [:logger]]

  # The official sentry Hex package at a pinned version; OpenTelemetry carries its tracing.
  defp deps do
    [
      {:sentry, "== 14.0.0"},
      {:finch, "== 0.24.0"},
      {:jason, "== 1.4.5"},
      {:opentelemetry, "== 1.7.0"},
      {:opentelemetry_api, "== 1.5.0"},
      {:opentelemetry_exporter, "== 1.10.0"},
      {:opentelemetry_semantic_conventions, "== 1.27.0"}
    ]
  end
end
