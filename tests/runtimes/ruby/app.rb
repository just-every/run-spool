# Unmodified sentry-ruby program: the DSN is the only value that changes between runs.
require 'rack'
require 'rack/mock_request'
require 'sentry-ruby'

Sentry.init do |config|
  config.dsn = ENV.fetch('SPOOL_FIXTURE_DSN')
  config.environment = 'compatibility'
  config.traces_sample_rate = 1.0
  config.before_send = lambda do |event, _hint|
    event.message == 'synthetic-spool-discard' ? nil : event
  end
end

def charge(_note)
  password = 'synthetic-spool-1'
  begin
    10 / 0
  rescue ZeroDivisionError
    raise ArgumentError, 'checkout quantity rejected'
  end
end

transaction = Sentry.start_transaction(name: 'checkout', op: 'task')
Sentry.get_current_scope.set_span(transaction)
span = transaction.start_child(op: 'db', description: 'load cart')
Sentry.logger.info('cart loaded')
span.finish
Sentry.get_current_scope.add_attachment(bytes: 'synthetic-spool-attachment', filename: 'cart.txt')

if ARGV[0] == 'handled'
  begin
    charge('synthetic-spool-note')
  rescue ArgumentError => failure
    Sentry.capture_exception(failure)
  end
  Sentry.capture_message('synthetic-spool-discard')
  Sentry.capture_check_in('nightly-sync', :ok, duration: 1)
  transaction.finish
  Sentry.close
else
  # Ruby has no global crash hook; web apps report unhandled errors through the Rack middleware.
  app = Sentry::Rack::CaptureExceptions.new(->(_env) { charge('synthetic-spool-note') })
  transaction.finish
  Rack::MockRequest.new(app).get('/checkout')
end
