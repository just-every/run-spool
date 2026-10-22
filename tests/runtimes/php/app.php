<?php
// Unmodified sentry-php program: the DSN is the only value that changes between runs.
require __DIR__ . '/vendor/autoload.php';

use Sentry\Attachment\Attachment;
use Sentry\CheckInStatus;
use Sentry\Tracing\SpanContext;
use Sentry\Tracing\TransactionContext;

\Sentry\init([
    'dsn' => getenv('SPOOL_FIXTURE_DSN'),
    'environment' => 'compatibility',
    'traces_sample_rate' => 1.0,
    'enable_logs' => true,
    'before_send' => static function (\Sentry\Event $event): ?\Sentry\Event {
        return $event->getMessage() === 'synthetic-spool-discard' ? null : $event;
    },
]);

function charge(string $note): void
{
    $password = 'synthetic-spool-1';
    try {
        intdiv(10, 0);
    } catch (\DivisionByZeroError $cause) {
        throw new \RuntimeException('checkout quantity rejected', 0, $cause);
    }
}

$transaction = \Sentry\startTransaction(TransactionContext::make()->setName('checkout')->setOp('task'));
\Sentry\SentrySdk::getCurrentHub()->setSpan($transaction);
$span = $transaction->startChild(SpanContext::make()->setOp('db')->setDescription('load cart'));
\Sentry\logger()->info('cart loaded');
$span->finish();
\Sentry\addAttachment(Attachment::fromBytes('cart.txt', 'synthetic-spool-attachment', 'text/plain'));

if ($argv[1] === 'handled') {
    try {
        charge('synthetic-spool-note');
    } catch (\RuntimeException $failure) {
        \Sentry\captureException($failure);
    }
    \Sentry\captureMessage('synthetic-spool-discard');
    \Sentry\captureCheckIn('nightly-sync', CheckInStatus::ok(), 1);
    $transaction->finish();
    \Sentry\logger()->flush();
    \Sentry\flush();
    exit(0);
}
$transaction->finish();
charge('synthetic-spool-note');
