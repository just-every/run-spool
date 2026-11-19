# Framework setup

Connect an existing Sentry SDK to your Spool project, or configure a new application using the framework steps below. These guides cover exception capture.

Choose your framework:

- [React and Next.js](#react-and-nextjs)
- [Express](#express)
- [Django and FastAPI](#django-and-fastapi)
- [Spring](#spring)
- [Rails](#rails)
- [Laravel](#laravel)
- [ASP.NET Core](#aspnet-core)

<details>
<summary>Details</summary>

## Before you start

Create or select a project in Spool and copy its **Sentry DSN** from **Capture**. Set `SPOOL_DSN` in your application's environment to that complete value; keep the key, host and numeric project path together. Use the ingest DSN, never an owner session, agent key or deploy key. If Sentry is already installed, keep your capture calls and change its DSN to this value.

Add your browser application's exact origin in **Capture** before sending browser events. Keep private server settings and deploy keys out of browser bundles. Browser DSNs are public ingest credentials and still depend on that origin policy. Set an optional release in `SPOOL_RELEASE` and environment in `SPOOL_ENVIRONMENT`; JavaScript source-map uploads must use the same release and build as capture.

After configuring a framework, trigger a deliberate exception in a development request or test action. Open **Issues** in Spool and check the exception and release. A successful HTTP response from an unrelated endpoint is not an intake receipt. Review the [capture guide](capture.md#4-check-it-works) for the workbench checks.

## React and Next.js

For Next.js App Router, install the Sentry integration in **your application’s repository**, using that application’s Node.js and npm. The Spool installer’s private runtime runs Spool itself and does not add Node or npm to your application’s shell.

```sh
npm install @sentry/nextjs
```

Create `instrumentation-client.js` next to `app` (under `src` if that is where your app lives), and initialize capture before the application runs:

```js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SPOOL_DSN,
  release: process.env.NEXT_PUBLIC_SPOOL_RELEASE,
  dist: process.env.NEXT_PUBLIC_SPOOL_BUILD,
  environment: process.env.NEXT_PUBLIC_SPOOL_ENVIRONMENT ?? 'production',
});
```

Set `NEXT_PUBLIC_SPOOL_DSN` to your project’s complete Spool DSN in your app’s private, ignored `.env.local` or build environment. Set `NEXT_PUBLIC_SPOOL_RELEASE` and `NEXT_PUBLIC_SPOOL_BUILD` to match the release and build used for map upload. This configures browser capture; it does not configure Next.js server or edge instrumentation. Events go directly to Spool, so allow the application’s exact browser origin in Capture.

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
});
```

These are Vite environment names: set `VITE_SPOOL_DSN` to your project's DSN at build time, and adapt them to your bundler if it differs. This sends directly to Spool; allow your app’s exact browser origin in Capture. See the [tunnel replacement](#replace-tunnelroute) notes if your existing app uses `tunnelRoute`. Finish the [JavaScript source-map step](#javascript-source-maps) before publishing production bundles.

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

Request `/setup-check` in development and inspect the issue in Spool, then remove the deliberate failure. If your server JavaScript is compiled or bundled, follow the [source-map step](#javascript-source-maps). See the [browser relay notes](#replace-tunnelroute) before retaining an existing browser relay.

## Django and FastAPI

Python has no source maps to configure or upload. Keep Python source paths in the exception stack; the JavaScript source-map step applies only to any separately bundled frontend.

For Django, install `sentry-sdk` and put this in your settings module. For FastAPI, install the integration extra and initialize it before constructing the app. Use your application’s Python interpreter or activated virtual environment:

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

Django, FastAPI and Starlette integrations are enabled by the SDK's defaults when their framework is installed. For FastAPI, place `app = FastAPI()` after this initialization. Raise a development request exception and confirm the issue in Spool. Export `SPOOL_DSN` before starting the application; a `.env` file alone does not load environment variables into Python.

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

Set `SPOOL_DSN` before starting the application. Existing Spring applications keep their Sentry capture calls and replace the configured DSN. Throw an exception from a development controller and confirm it in Spool. Java stacks do not use JavaScript source maps.

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

Set the environment before starting Rails. Raise an exception in a development controller and check the issue in Spool. Ruby stacks need no JavaScript source maps; use the [JavaScript step](#javascript-source-maps) for a bundled frontend.

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

Older Laravel applications should retain the exception-handler integration for their installed Sentry package. Trigger a development request exception and confirm it in Spool. PHP stacks need no JavaScript source maps; a Vite frontend still needs the [JavaScript step](#javascript-source-maps).

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

Set `SPOOL_DSN` in the host environment, then trigger an exception from a development endpoint and inspect the issue in Spool. Existing applications keep their capture calls and update the DSN. .NET stacks do not use JavaScript source maps.

## JavaScript source maps

Run your Spool installation’s upload tool in your application’s repository.

Requires [Node.js and npm](https://nodejs.org/en/download) installed and available on PATH in your application’s repository. Spool’s installer keeps its runtime private and does not provide npm on PATH. For browser capture without Node.js or npm, use the [browser helper](capture.md#browser-capture-without-nodejs-or-npm).

For Next.js, merge `productionBrowserSourceMaps: true` into your existing `next.config.mjs`:

```js
export default { productionBrowserSourceMaps: true };
```

Set `SPOOL_ENDPOINT` to the Spool installation address, `SPOOL_PROJECT` to the project slug, `SPOOL_RELEASE` and `SPOOL_BUILD` to the capture release and build, and keep the project’s deploy key only in `SPOOL_DEPLOY_KEY` in your build terminal or CI secrets. Next.js also needs `NEXT_PUBLIC_SPOOL_RELEASE` and `NEXT_PUBLIC_SPOOL_BUILD` set to those same values at build time. Build with webpack to emit adjacent maps, then upload before serving the resulting files:

```sh
npx next build --webpack
curl -fsS "${SPOOL_ENDPOINT%/}/spool-sourcemaps.mjs" -o spool-sourcemaps.mjs &&
find .next/static -name '*.js' -exec node ./spool-sourcemaps.mjs \
  --endpoint "$SPOOL_ENDPOINT" --project "$SPOOL_PROJECT" \
  --release "$SPOOL_RELEASE" --build "$SPOOL_BUILD" \
  --key-env SPOOL_DEPLOY_KEY {} +
```

For React or compiled Express with another bundler, emit adjacent `.js` and `.js.map` files, then run the tool before serving those bundles:

```sh
curl -fsS "${SPOOL_ENDPOINT%/}/spool-sourcemaps.mjs" -o spool-sourcemaps.mjs &&
node ./spool-sourcemaps.mjs --endpoint "$SPOOL_ENDPOINT" \
  --project "$SPOOL_PROJECT" --release "$SPOOL_RELEASE" --build "$SPOOL_BUILD" \
  --key-env SPOOL_DEPLOY_KEY ./dist/app.js
```

Serve the rewritten JavaScript: the tool stamps a matching debug ID into each bundle and its map, registers the release and uploads the map privately. The capture release and dist must equal the upload's release and build. A refused upload fails the build; trigger a real error after deployment and check its original file and line in Spool.

## Replace tunnelRoute

Sentry's Next.js `tunnelRoute` rewrite targets Sentry's hosted ingest, so it cannot send to Spool. The manual examples above send directly to Spool: remove `tunnelRoute` from the Sentry build configuration and omit the browser SDK’s `tunnel` option. Allow your app’s exact origin in Capture and check a real exception in Issues. Direct requests may be blocked by a browser extension; this path does not claim blocker resistance.

The published SDK does not include `spoolTunnelRoute` or `nodeTunnel`. If your existing browser configuration uses `tunnel: '/monitoring'`, remove it for this direct-capture path too. Use the manual instructions above without adding an unreleased relay helper.

## Unpublished guided setup

Use the manual framework instructions above.

## Prepare Node.js and npm

The source-map build and upload commands need Node.js and npm in **your application’s repository**. The no-Node Spool installer supplies a private runtime for Spool, not for building your application.

1. Install the current Node.js LTS from [the official download page](https://nodejs.org/en/download), following its instructions for your operating system. npm is included.
2. Open a fresh terminal in your application’s repository and run `node --version` and `npm --version`. Both must succeed before continuing.
3. Follow your application’s dependency-install instructions, then run `npm install @just-every/spool` there.
4. Return to Capture → Set up original-source mapping. Choose your actual bundler, release and build, create a build-only key and copy its environment line into this terminal. Add the displayed configuration to the application, then run the displayed build and upload commands.
5. Deploy those exact stamped bundles. Trigger a fresh exception and check Original source in the resulting Spool issue. Keep maps and build keys private.

If another computer or CI builds the application, run these steps there instead. Bring its matching prepared map to Releases → Upload map, choose the same release/build, enter the bundle’s debug ID and select the file. The currently published picker accepts flat maps up to 256 KiB. Deploy the stamped bundle from that same build and trigger a new exception to check the mapping.

</details>
