# Unmodified sentry-elixir program: the DSN is the only value that changes between runs.
require Logger
require OpenTelemetry.Tracer, as: Tracer

defmodule Checkout do
  # Sentry context is per process, so the process that runs the checkout attaches the cart.
  # sentry 14.0.0's logger handler turns a crashed process's caller context into capture
  # options (lib/sentry/logger_utils.ex:30), and an attachment there makes
  # Sentry.Event.create_event/1 raise (lib/sentry/event.ex:196), which the handler swallows
  # (lib/sentry/logger_handler.ex:475): an attachment held by the caller loses the crash.
  def charge(_note) do
    Sentry.Context.add_attachment(%Sentry.Attachment{filename: "cart.txt", data: "synthetic-spool-attachment"})
    password = "synthetic-spool-1"
    _ = password
    div(10, String.to_integer("0"))
  end
end

[mode] = System.argv()

Tracer.with_span "checkout" do
  Tracer.with_span "load cart" do
    Logger.info("cart loaded")
  end
end

case mode do
  "handled" ->
    try do
      Checkout.charge("synthetic-spool-note")
    rescue
      error -> Sentry.capture_exception(error, stacktrace: __STACKTRACE__)
    end

    # sentry 14.0.0 records no client report for a before_send exclusion, so the SDK's own
    # per-call sampling discards this message instead.
    Sentry.capture_message("synthetic-spool-discard", sample_rate: 0.0)
    Sentry.capture_check_in(status: :ok, monitor_slug: "nightly-sync", duration: 1)
    Sentry.flush()
    # Client reports leave on the SDK's 30-second timer (lib/sentry/client_report/sender.ex).
    Process.sleep(31_000)

  "crash" ->
    # A crashing process is Elixir's uncaught failure; the SDK's logger handler reports it.
    {:ok, pid} = Task.start(fn -> Checkout.charge("synthetic-spool-note") end)
    ref = Process.monitor(pid)

    receive do
      {:DOWN, ^ref, :process, ^pid, _reason} -> :ok
    end

    Sentry.flush()
    System.halt(1)
end
