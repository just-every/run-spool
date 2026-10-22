// Unmodified Sentry .NET program: the DSN is the only value that changes between runs.
using Sentry;

SentrySdk.Init(options =>
{
    options.Dsn = Environment.GetEnvironmentVariable("SPOOL_FIXTURE_DSN");
    options.Environment = "compatibility";
    options.TracesSampleRate = 1.0;
    options.AutoSessionTracking = true;
    options.EnableLogs = true;
    options.SetBeforeSend(@event => @event.Message?.Message == "synthetic-spool-discard" ? null : @event);
});

static void Charge(string note)
{
    var password = "synthetic-spool-1";
    try
    {
        var zero = 0;
        _ = 10 / zero;
    }
    catch (DivideByZeroException cause)
    {
        throw new InvalidOperationException("checkout quantity rejected", cause);
    }
}

var transaction = SentrySdk.StartTransaction("checkout", "task");
SentrySdk.ConfigureScope(scope => { scope.Transaction = transaction; scope.AddAttachment(System.Text.Encoding.UTF8.GetBytes("synthetic-spool-attachment"), "cart.txt"); });
var span = transaction.StartChild("db", "load cart");
SentrySdk.Logger.LogInfo("cart loaded");
span.Finish();

if (args[0] == "handled")
{
    try { Charge("synthetic-spool-note"); }
    catch (InvalidOperationException failure)
    {
        var id = SentrySdk.CaptureException(failure);
        SentrySdk.CaptureFeedback("synthetic-spool-feedback", associatedEventId: id);
    }
    SentrySdk.CaptureMessage("synthetic-spool-discard");
    SentrySdk.CaptureCheckIn("nightly-sync", CheckInStatus.Ok);
    transaction.Finish();
    SentrySdk.Flush(TimeSpan.FromSeconds(10));
    return;
}
transaction.Finish();
Charge("synthetic-spool-note");
