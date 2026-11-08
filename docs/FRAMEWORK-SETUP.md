# Framework setup

Connect an existing Sentry SDK to your Spool project, or configure a new application using the framework steps below. These guides cover exception capture; publishing a guide does not qualify every feature of that framework's SDK.

Only fresh Next.js App Router and Django applications are exercised by Spool's guided-setup journey. The other frameworks have manual instructions, not generated patches or fresh-framework qualification. Runtime qualification, hosted delivery, trusted tunnel addresses and native devices retain their separate limits in the [engineering notes](SENTRY-SWITCHING.md#runtime-qualification).

Choose your framework:

- [React and Next.js](#react-and-nextjs)
- [Express](#express)
- [Django and FastAPI](#django-and-fastapi)
- [Spring](#spring)
- [Rails](#rails)
- [Laravel](#laravel)
- [ASP.NET Core](#aspnet-core)

## Before you start

Create or select a project in Spool and copy its **Sentry DSN** from **Capture**. Set `SPOOL_DSN` in your application's environment to that complete value; keep the key, host and numeric project path together. Use the ingest DSN, never an owner session, agent key or deploy key. If Sentry is already installed, keep your capture calls and change its DSN to this value.

Add your browser application's exact origin in **Capture** before sending browser events. Keep private server settings and deploy keys out of browser bundles. Browser DSNs are public ingest credentials and still depend on that origin policy. Set an optional release in `SPOOL_RELEASE` and environment in `SPOOL_ENVIRONMENT`; JavaScript source-map uploads must use the same release and build as capture.

After configuring a framework, trigger a deliberate exception in a development request or test action. Open **Issues** in Spool and check the exception and release. A successful HTTP response from an unrelated endpoint is not an intake receipt. The guided command reports success only when Spool returns its own receipt for the test event. Review the [capture guide](capture.md#4-check-it-works) for the workbench checks.

## React and Next.js

For a fresh Next.js App Router application, run the guided command from your app folder, with `SPOOL_DSN` already set:

```sh
npx -p @just-every/spool spool-setup --dsn "$SPOOL_DSN" --dir .
```

Review the printed patch before applying it. The first command writes nothing; add `--apply --install` to write that same patch and install the packages. The test event runs before a patch is written; an invalid DSN or unsafe path refuses without configuration changes. The command runs on macOS, Linux and WSL2. Existing files that need manual merging are identified in its output.

Next.js setup installs `@sentry/nextjs` and `@just-every/spool`, writes `instrumentation-client.js`, a same-origin tunnel in `app/monitoring/route.js`, DSNs in `.env.local`, `next.config.mjs` and `spool-build.mjs`. Keep `.env.local` private and ignored by Git. Set `NEXT_PUBLIC_SPOOL_RELEASE` for the browser release and keep `NEXT_PUBLIC_SPOOL_BUILD` equal to `SPOOL_BUILD`. The generated client initializes Sentry before the application runs; this guide qualifies browser errors, not Next.js server or edge instrumentation.

For React without Next.js, install `@sentry/react`, then initialize it before rendering the application:

```sh
npm install @sentry/react
```

```js
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SPOOL_DSN,
  release: import.meta.env.VITE_SPOOL_RELEASE,
  dist: import.meta.env.VITE_SPOOL_BUILD,
  tunnel: '/monitoring',
});
```

These are Vite environment names: set `VITE_SPOOL_DSN` to your project's DSN at build time, and adapt them to your bundler if it differs. Serve `/monitoring` on the app's own origin using the [tunnel replacement](#replace-tunnelroute); omit `tunnel` if you intentionally send directly to Spool. Finish the [JavaScript source-map step](#javascript-source-maps) before publishing production bundles.

## Express

Install the Node SDK and create `instrument.mjs`:

```sh
npm install @sentry/node
```

```js
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SPOOL_DSN,
  release: process.env.SPOOL_RELEASE,
  environment: process.env.SPOOL_ENVIRONMENT ?? 'production',
});
```

Load instrumentation before Express or application modules, for example with `node --import ./instrument.mjs ./server.mjs`. In `server.mjs`, register the error handler after your routes and before your own final error handler:

```js
import * as Sentry from '@sentry/node';
import express from 'express';

const app = express();
app.get('/setup-check', () => { throw new Error('Spool setup check'); });
Sentry.setupExpressErrorHandler(app);
app.listen(3000);
```

Request `/setup-check` in development and inspect the issue in Spool, then remove the deliberate failure. If your server JavaScript is compiled or bundled, follow the [source-map step](#javascript-source-maps). To relay a React application's events, mount the [Node tunnel](#replace-tunnelroute) before any JSON body parser on that path.

## Django and FastAPI

Python has no source maps to configure or upload. Keep Python source paths in the exception stack; the JavaScript source-map step applies only to any separately bundled frontend.

For a fresh Django application, run the guided command from the folder containing `manage.py`:

```sh
npx -p @just-every/spool spool-setup --dsn "$SPOOL_DSN" --dir .
npx -p @just-every/spool spool-setup --dsn "$SPOOL_DSN" --dir . --apply --install --python .venv/bin/python
```

Review the first patch before running the second command. Choose your actual virtual environment interpreter. Setup adds `sentry-sdk` to the requirements when present, initializes it in the detected settings module and writes the DSN to `.env`. Export that value before starting Django: a `.env` file alone does not load environment variables into Python.

For manual Django setup, install `sentry-sdk` and put this in your settings module. For FastAPI, install the integration extra and initialize it before constructing the app:

```sh
python -m pip install 'sentry-sdk[django]'
# For FastAPI instead:
python -m pip install 'sentry-sdk[fastapi]'
```

```python
import os
import sentry_sdk

sentry_sdk.init(
    dsn=os.environ["SPOOL_DSN"],
    release=os.environ.get("SPOOL_RELEASE"),
    environment=os.environ.get("SPOOL_ENVIRONMENT", "production"),
)
```

Django, FastAPI and Starlette integrations are enabled by the SDK's defaults when their framework is installed. For FastAPI, place `app = FastAPI()` after this initialization. Raise a development request exception and confirm the issue in Spool. The guided command generates a patch only for Django; FastAPI gets manual guidance. A Python backend relaying browser events can use the [Python tunnel](../packages/tunnel-python/README.md); it must not trust arbitrary forwarded client addresses.

## Spring

For Spring Boot 3 with Jakarta, add the maintained `io.sentry:sentry-spring-boot-starter-jakarta` dependency to your Maven or Gradle build, using the SDK version compatible with your Spring Boot release. For Gradle, set `sentryVersion` to that selected version and add:

```kotlin
implementation("io.sentry:sentry-spring-boot-starter-jakarta:$sentryVersion")
```

In `application.properties`, bind the DSN from the environment:

```properties
sentry.dsn=${SPOOL_DSN}
sentry.environment=${SPOOL_ENVIRONMENT:production}
```

Set `SPOOL_DSN` before starting the application. Existing Spring applications keep their Sentry capture calls and replace the configured DSN. Throw an exception from a development controller and confirm it in Spool. This is manual setup guidance; Spring framework behavior is not qualified by the fresh Next.js and Django journey. Java stacks do not use JavaScript source maps.

## Rails

Add the SDK and Rails integration to your `Gemfile`, then install them:

```ruby
gem 'sentry-ruby'
gem 'sentry-rails'
```

```sh
bundle install
```

Create `config/initializers/sentry.rb`:

```ruby
Sentry.init do |config|
  config.dsn = ENV.fetch('SPOOL_DSN')
  config.release = ENV['SPOOL_RELEASE']
  config.environment = ENV.fetch('SPOOL_ENVIRONMENT', 'production')
end
```

Set the environment before starting Rails. Raise an exception in a development controller and check the issue in Spool. This is a manual integration guide; fresh Rails qualification is not claimed. Ruby stacks need no JavaScript source maps; use the [JavaScript step](#javascript-source-maps) for a bundled frontend.

## Laravel

Install the integration and publish its configuration with your Spool DSN:

```sh
composer require sentry/sentry-laravel
php artisan sentry:publish --dsn="$SPOOL_DSN"
```

Keep the generated environment file out of Git. Confirm its `SENTRY_LARAVEL_DSN` setting contains the Spool DSN. For Laravel 11 and later, register exception reporting in `bootstrap/app.php`, preserving your application's other configuration:

```php
use Illuminate\Foundation\Configuration\Exceptions;
use Sentry\Laravel\Integration;

// In the Application::configure(...) builder chain:
->withExceptions(function (Exceptions $exceptions): void {
    Integration::handles($exceptions);
})
```

Older Laravel applications should retain the exception-handler integration for their installed Sentry package. Trigger a development request exception and confirm it in Spool. Laravel setup is manual and not fresh-framework qualified here. PHP stacks need no JavaScript source maps; a Vite frontend still needs the [JavaScript step](#javascript-source-maps).

## ASP.NET Core

Install the framework SDK:

```sh
dotnet add package Sentry.AspNetCore
```

In `Program.cs`, configure Sentry before building the host:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseSentry(options => {
    options.Dsn = Environment.GetEnvironmentVariable("SPOOL_DSN");
    options.Release = Environment.GetEnvironmentVariable("SPOOL_RELEASE");
    options.Environment = Environment.GetEnvironmentVariable("SPOOL_ENVIRONMENT") ?? "production";
});
var app = builder.Build();
app.Run();
```

Set `SPOOL_DSN` in the host environment, then trigger an exception from a development endpoint and inspect the issue in Spool. Existing applications keep their capture calls and update the DSN. This is manual ASP.NET Core guidance, not fresh-framework qualification; .NET stacks do not use JavaScript source maps.

## JavaScript source maps

For the generated Next.js setup, review `productionBrowserSourceMaps: true` in `next.config.mjs`. Merge that option into an existing config when the command directs you to do so. In CI, set `SPOOL_ENDPOINT` to the Spool installation address, `SPOOL_PROJECT` to the project slug, `NEXT_PUBLIC_SPOOL_RELEASE` to the release and `SPOOL_BUILD` to the build. Set `NEXT_PUBLIC_SPOOL_BUILD` to the same build and keep the project's deploy key only in `SPOOL_DEPLOY_KEY` in CI secrets. Run:

```sh
node --env-file=.env.local spool-build.mjs
```

The generated script builds with webpack and uploads application-route maps. Shared framework chunks remain outside this bounded upload. For React or compiled Express with another bundler, emit adjacent `.js` and `.js.map` files, then run the source-map tool from `@just-every/spool` before serving those bundles:

```sh
npx -p @just-every/spool spool-sourcemaps --endpoint "$SPOOL_ENDPOINT" \
  --project "$SPOOL_PROJECT" --release "$SPOOL_RELEASE" --build "$SPOOL_BUILD" \
  --key-env SPOOL_DEPLOY_KEY ./dist/app.js
```

Serve the rewritten JavaScript: the tool stamps a matching debug ID into each bundle and its map, registers the release and uploads the map privately. The capture release and dist must equal the upload's release and build. A refused upload fails the build; trigger a real error after deployment and check its original file and line in Spool. Current artifact bounds apply; this guide makes no large-map or native-symbolication claim.

## Replace tunnelRoute

Sentry's Next.js `tunnelRoute` rewrite targets Sentry's hosted ingest, so it cannot send to Spool. Use the SDK's standard `tunnel: '/monitoring'` option and a Spool handler on that same origin instead. Install `@just-every/spool` on your server and create `app/monitoring/route.js` for Next.js:

```js
import { spoolTunnelRoute } from '@just-every/spool/next';

export const { POST } = spoolTunnelRoute({ dsn: process.env.SPOOL_DSN });
```

For an Express server, mount this route before JSON or text body parsers so the tunnel receives the envelope bytes:

```js
import { nodeTunnel } from '@just-every/spool/tunnel';

app.post('/monitoring', nodeTunnel({ dsn: process.env.SPOOL_DSN }));
```

Set the server's `SPOOL_DSN` to the same project DSN as the browser. For a Fetch server use `spoolTunnel` from the same module; for Python use the [WSGI handler or forwarding function](../packages/tunnel-python/README.md). These handlers check the envelope DSN and forward only to their configured project. Browser origins and inbound filters still apply. Untrusted forwarded client addresses are ignored: the tunnel server remains labelled as the peer until a trusted ingress boundary is configured and authenticated. The local tests use a blocking engine and list excerpt, not a deployed browser extension or hosted-provider qualification.
