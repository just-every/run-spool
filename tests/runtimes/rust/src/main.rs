// Unmodified sentry-rust program: the DSN is the only value that changes between runs.
#[derive(Debug)]
struct CauseError;
impl std::fmt::Display for CauseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "division by zero") }
}
impl std::error::Error for CauseError {}

#[derive(Debug)]
struct CheckoutError(CauseError);
impl std::fmt::Display for CheckoutError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "checkout quantity rejected") }
}
impl std::error::Error for CheckoutError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> { Some(&self.0) }
}

fn charge(_note: &str) -> Result<(), CheckoutError> {
    let _password = "synthetic-spool-1";
    Err(CheckoutError(CauseError))
}

fn main() {
    let mode = std::env::args().nth(1).unwrap();
    let mut options = sentry::ClientOptions::new()
        .traces_sample_rate(1.0)
        .auto_session_tracking(true)
        .before_send(|event| {
            if event.message.as_deref() == Some("synthetic-spool-discard") { None } else { Some(event) }
        });
    options.environment = Some("compatibility".into());
    let guard = sentry::init((std::env::var("SPOOL_FIXTURE_DSN").unwrap(), options));
    let transaction = sentry::start_transaction(sentry::TransactionContext::new("checkout", "task"));
    sentry::configure_scope(|scope| scope.set_span(Some(transaction.clone().into())));
    let span = transaction.start_child("db", "load cart");
    sentry::logger_info!("cart loaded");
    span.finish();
    sentry::configure_scope(|scope| scope.add_attachment(sentry::protocol::Attachment { buffer: b"synthetic-spool-attachment".to_vec(), filename: "cart.txt".into(), ..Default::default() }));
    if mode == "handled" {
        if let Err(failure) = charge("synthetic-spool-note") {
            sentry::capture_error(&failure);
        }
        sentry::capture_message("synthetic-spool-discard", sentry::Level::Error);
        transaction.finish();
        drop(guard);
        return;
    }
    transaction.finish();
    // The log batcher runs on its own thread; drain it before the deliberate crash.
    if let Some(client) = sentry::Hub::current().client() {
        client.flush(Some(std::time::Duration::from_secs(5)));
    }
    panic!("checkout quantity rejected");
}
