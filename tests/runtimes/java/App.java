// Unmodified sentry-java program: the DSN is the only value that changes between runs.
import io.sentry.Attachment;
import io.sentry.CheckIn;
import io.sentry.CheckInStatus;
import io.sentry.ISpan;
import io.sentry.ITransaction;
import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.protocol.Feedback;
import io.sentry.protocol.SentryId;

public class App {
  static void charge(String note) {
    String password = "synthetic-spool-1";
    try {
      throw new ArithmeticException("division by zero");
    } catch (ArithmeticException cause) {
      throw new IllegalStateException("checkout quantity rejected", cause);
    }
  }

  public static void main(String[] args) throws Exception {
    Sentry.init(options -> {
      options.setDsn(System.getenv("SPOOL_FIXTURE_DSN"));
      options.setEnvironment("compatibility");
      options.setTracesSampleRate(1.0);
      options.getLogs().setEnabled(true);
      options.setBeforeSend((event, hint) -> {
        String message = event.getMessage() == null ? null : event.getMessage().getFormatted();
        return "synthetic-spool-discard".equals(message) ? null : event;
      });
    });
    if (args[0].equals("suppressed")) {
      IllegalStateException failure = new IllegalStateException("checkout quantity rejected", new ArithmeticException("division by zero"));
      failure.addSuppressed(new java.io.IOException("synthetic-spool-close-failed"));
      Sentry.captureException(failure);
      Sentry.close();
      return;
    }
    ITransaction transaction = Sentry.startTransaction("checkout", "task");
    ISpan span = transaction.startChild("db", "load cart");
    Sentry.logger().info("cart loaded");
    span.finish();
    Sentry.configureScope(scope -> scope.addAttachment(new Attachment("synthetic-spool-attachment".getBytes(), "cart.txt")));
    if (args[0].equals("handled")) {
      try {
        charge("synthetic-spool-note");
      } catch (IllegalStateException failure) {
        SentryId id = Sentry.captureException(failure);
        Feedback feedback = new Feedback("synthetic-spool-feedback");
        feedback.setAssociatedEventId(id);
        Sentry.captureFeedback(feedback);
      }
      Sentry.captureMessage("synthetic-spool-discard");
      Sentry.captureCheckIn(new CheckIn(new SentryId(), "nightly-sync", CheckInStatus.OK));
      transaction.finish();
      Sentry.close();
      return;
    }
    transaction.finish();
    charge("synthetic-spool-note");
  }
}
