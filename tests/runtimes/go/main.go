// Unmodified sentry-go program: the DSN is the only value that changes between runs.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

type causeError struct{ detail string }

func (e *causeError) Error() string { return e.detail }

type checkoutError struct{ cause error }

func (e *checkoutError) Error() string { return "checkout quantity rejected: " + e.cause.Error() }
func (e *checkoutError) Unwrap() error { return e.cause }

func charge(note string) error {
	password := "synthetic-spool-1"
	_ = password
	return &checkoutError{cause: &causeError{detail: "division by zero"}}
}

func main() {
	err := sentry.Init(sentry.ClientOptions{
		Dsn:              os.Getenv("SPOOL_FIXTURE_DSN"),
		Environment:      "compatibility",
		EnableTracing:    true,
		TracesSampleRate: 1.0,
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			if event.Message == "synthetic-spool-discard" {
				return nil
			}
			return event
		},
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(3)
	}
	defer sentry.Flush(5 * time.Second)

	ctx := context.Background()
	span := sentry.StartSpan(ctx, "task", sentry.WithTransactionName("checkout"))
	child := span.StartChild("db")
	child.Description = "load cart"
	child.Finish()
	logger := sentry.NewLogger(span.Context())
	logger.Info().Emit("cart loaded")
	sentry.ConfigureScope(func(scope *sentry.Scope) {
		scope.AddAttachment(&sentry.Attachment{Filename: "cart.txt", ContentType: "text/plain", Payload: []byte("synthetic-spool-attachment")})
	})

	if os.Args[1] == "handled" {
		sentry.CaptureException(charge("synthetic-spool-note"))
		sentry.CaptureMessage("synthetic-spool-discard")
		sentry.CaptureCheckIn(&sentry.CheckIn{MonitorSlug: "nightly-sync", Status: sentry.CheckInStatusOK, Duration: time.Second}, nil)
		span.Finish()
		return
	}
	span.Finish()
	defer func() {
		if recovered := recover(); recovered != nil {
			sentry.CurrentHub().Recover(recovered)
			sentry.Flush(5 * time.Second)
			panic(recovered)
		}
	}()
	panic(charge("synthetic-spool-note"))
}
