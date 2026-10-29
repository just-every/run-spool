# Set up your framework

Connect a Sentry SDK to your own Spool installation. Choose your framework below, use the project's Spool DSN, then trigger a real exception and read it in Issues.

- [React and Next.js](#react-and-nextjs)
- [Express](#express)
- [Django and FastAPI](#django-and-fastapi)
- [Spring](#spring)
- [Rails](#rails)
- [Laravel](#laravel)
- [ASP.NET Core](#aspnet-core)

## Before you start

Create a project in Spool and copy its ingest DSN from **Settings → Project keys**. Set `SPOOL_DSN` in your server's deployment environment. The DSN authorizes capture for that project; it does not grant owner access. Keep owner sessions and deploy keys out of application configuration. For browser capture, allow the application's exact origin on **Capture** first.

If your app already uses Sentry, keep its capture calls, release, dist, environment and default integrations; replace its DSN with the Spool DSN. Use the same release and build when registering releases and uploading JavaScript maps. A release-less exception is accepted without inventing a release, but cannot select a release's source map.

These are setup instructions, not a claim that every framework has been freshly qualified. The packed setup journey builds fresh Next.js and Django apps and captures their real exceptions. React, Express, FastAPI, Spring, Rails, Laravel and ASP.NET Core use the Sentry framework integrations over the runtime SDKs; they have no fresh framework qualification here. Broader telemetry, native-device qualification and real Sentry migration remain separate obligations. See the [runtime qualification record](SENTRY-SWITCHING.md#runtime-qualification) for the exact limits.

## React and Next.js

For a React app without Next.js, install the maintained integration:

```sh
npm install @sentry/react
```

Initialize it before rendering. Provide `VITE_SPOOL_DSN` through your build environment, using the project's ingest DSN. This public browser value is an ingest credential; never put a deploy key in a `VITE_` variable.

```js
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SPOOL_DSN,
  release: 'web-1',
  dist: 'build-1',
});
```

If you already run the SDK, change only `dsn` and preserve your existing release and dist. For Vite, generate and upload maps with the [JavaScript source-map step](#javascript-source-maps) before serving the built files.

For a Next.js App Router app, use the `spool-setup` command from Spool's SDK package. The checkout currently builds SDK 0.2.0, which remains unpublished; the npm 0.1.0 package does not contain this command or the tunnel helpers. Until that SDK release is published, build the package from your Spool checkout:

```sh
node packages/sdk/build.mjs --pack
```

Install the tarball path that command prints in your application, then run its local bin. Supply `SPOOL_DSN` privately in your shell environment:

```sh
npm install /absolute/path/to/the/printed/spool-package.tgz
npx --no-install spool-setup --dsn "$SPOOL_DSN"
npx --no-install spool-setup --dsn "$SPOOL_DSN" --apply --install \
  --spool-package /absolute/path/to/the/printed/spool-package.tgz
```

The first invocation prints a reviewable diff and writes nothing; inspect it before applying. Setup writes browser instrumentation, the same-origin tunnel route, `.env.local`, `next.config.mjs` and `spool-build.mjs`. Keep the generated environment file out of source control. If you already have a Next config, merge `productionBrowserSourceMaps: true` as the reviewed output directs. Supply the matching release through `NEXT_PUBLIC_SPOOL_RELEASE` and build through `SPOOL_BUILD` in CI, then run:

```sh
node --env-file=.env.local spool-build.mjs
```

Set `SPOOL_ENDPOINT`, `SPOOL_PROJECT`, `NEXT_PUBLIC_SPOOL_RELEASE`, `SPOOL_BUILD` and `SPOOL_DEPLOY_KEY` in the CI environment. The generated build sets the SDK's dist, builds with webpack and uploads application-route chunk maps before publication. Shared Next framework chunks are outside this bounded upload. A refused upload fails the build. See [replace tunnelRoute](#replace-tunnelroute) for existing Sentry Next.js setups.

## Express

Install the server SDK:

```sh
npm install @sentry/node
```

Create `instrument.mjs` and load it before Express or your route modules:

```js
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SPOOL_DSN });
```

In `app.mjs`, register the Sentry error handler after your routes and before your own error handlers:

```js
import './instrument.mjs';
import express from 'express';
import * as Sentry from '@sentry/node';

const app = express();
app.get('/test-error', () => { throw new Error('Spool setup check'); });
Sentry.setupExpressErrorHandler(app);
app.listen(3000);
```

Start with `node --import ./instrument.mjs app.mjs` so instrumentation loads before dependencies. Request `/test-error` and read the captured exception in Spool. Preserve existing release and dist; if your server code is bundled or transpiled, apply the [JavaScript source-map step](#javascript-source-maps).

## Django and FastAPI

Install the Python SDK in the application's virtual environment:

```sh
python -m pip install sentry-sdk
```

For Django, add this to your settings module. The SDK's default Django integration captures request failures:

```python
import os
import sentry_sdk

sentry_sdk.init(dsn=os.environ["SPOOL_DSN"])
```

You can instead review and apply Django configuration with the packed `spool-setup` command described in the Next.js guide; pass `--python` with your virtual environment's Python path when using `--install`. Python has no source maps to configure. Django setup explicitly reports this; the JavaScript source-map step does not apply to Django's Python frames. A separately bundled browser frontend still needs its own JavaScript maps.

For FastAPI, initialize before creating the application; the FastAPI and Starlette integrations are enabled by default when installed:

```python
import os
import sentry_sdk
from fastapi import FastAPI

sentry_sdk.init(dsn=os.environ["SPOOL_DSN"])
app = FastAPI()

@app.get("/test-error")
def test_error():
    raise RuntimeError("Spool setup check")
```

Start the application with its normal server, request a deliberately failing development route, and read the issue in Spool. Keep an existing release and environment when changing a DSN. FastAPI's Python frames also have no JavaScript source maps.

## Spring

For Spring Boot 3 with Jakarta, add the maintained starter using the current Sentry Java version approved for your application:

```xml
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring-boot-starter-jakarta</artifactId>
  <version>${sentry.version}</version>
</dependency>
```

Define `sentry.version` in Maven properties, or use the Sentry BOM your app already pins. In `application.properties`, read the DSN from the deployment environment:

```properties
sentry.dsn=${SPOOL_DSN}
```

Preserve existing starter settings, restart the app and trigger an exception from a development controller. Confirm its issue in Spool. The Jakarta starter targets Spring Boot 3; an older Spring app must keep the compatible Sentry integration it already uses.

## Rails

Add the maintained runtime and Rails integration:

```ruby
# Gemfile
gem 'sentry-ruby'
gem 'sentry-rails'
```

Run `bundle install`, then create `config/initializers/sentry.rb`:

```ruby
Sentry.init do |config|
  config.dsn = ENV.fetch('SPOOL_DSN')
end
```

Keep existing release and environment settings if this is a DSN switch. Restart Rails, raise an exception in a development controller and confirm it in Spool's Issues. Remove the deliberate error route after checking.

## Laravel

Install the maintained Laravel integration:

```sh
composer require sentry/sentry-laravel
php artisan sentry:publish --dsn="$SPOOL_DSN"
```

Run the publish command only with the project's ingest DSN and keep its generated environment file private. It writes the Laravel integration's `SENTRY_LARAVEL_DSN`; your deployment can map `SPOOL_DSN` to that variable instead. The generated `config/sentry.php` reads:

```php
'dsn' => env('SENTRY_LARAVEL_DSN'),
```

For Laravel 11 and later, register the integration in your existing `bootstrap/app.php` exception configuration, retaining the rest of your application builder:

```php
use Illuminate\Foundation\Configuration\Exceptions;
use Sentry\Laravel\Integration;

// On the existing Application::configure(...) builder:
->withExceptions(function (Exceptions $exceptions) {
    Integration::handles($exceptions);
})
```

An older Laravel app should keep its version-compatible handler integration. Reload deployment configuration, trigger a development route exception and check Spool. Preserve release and environment values when replacing an existing DSN.

## ASP.NET Core

Install the maintained integration:

```sh
dotnet add package Sentry.AspNetCore
```

In `Program.cs`, configure the host before building the app:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseSentry(options => {
    options.Dsn = Environment.GetEnvironmentVariable("SPOOL_DSN");
});
var app = builder.Build();
app.MapGet("/test-error", () => {
    throw new InvalidOperationException("Spool setup check");
    return Results.Ok();
});
app.Run();
```

Set `SPOOL_DSN` in the server environment, restart, request `/test-error` and confirm the exception in Spool. Preserve your existing release and environment configuration when changing the DSN. Remove the deliberate error route afterwards.

## JavaScript source maps

For React, Next.js and bundled Express applications, build with source maps, stamp matching debug IDs and upload before publishing the resulting application bytes. Use the same SDK release and dist as the upload's release and build. Obtain an exact-project deploy key in **Settings → Project keys** and keep `SPOOL_DEPLOY_KEY` in CI secrets. It must never reach browser configuration.

With Spool's SDK package installed, run its local source-map bin after your bundler emits each bundle beside its `.map`:

```sh
npx --no-install spool-sourcemaps --endpoint https://spool.example --project web \
  --release web-1 --build build-1 --key-env SPOOL_DEPLOY_KEY dist/app.js
```

The command rewrites each bundle and map with matching debug IDs, registers the release and uploads. Serve the rewritten bundle. Do not run a second injector over it. Spool accepts flat or indexed V3 maps up to 1 MiB each, with the project's configured artifact byte cap; larger maps are refused. Next.js's generated `spool-build.mjs` already performs this application-chunk step. Python, Java, Ruby, PHP and .NET frames do not use JavaScript source maps.

## Replace tunnelRoute

Sentry's Next.js `tunnelRoute` rewrite targets Sentry's hosted ingest, so it cannot forward to Spool. Replace it with the SDK's standard `tunnel` option and Spool's same-origin handler, using the packed package described above until those helpers are published. For Next.js, create `app/monitoring/route.js`:

```js
import { spoolTunnelRoute } from '@just-every/spool/next';
export const { POST } = spoolTunnelRoute({ dsn: process.env.SPOOL_DSN });
```

Set `SPOOL_DSN` in the Next server environment as well as the public ingest DSN in the browser instrumentation. In an existing Sentry init, retain the other options and add:

```js
Sentry.init({ dsn: process.env.NEXT_PUBLIC_SPOOL_DSN, tunnel: '/monitoring' });
```

The handler checks the envelope DSN against its configured project. It forwards capture only, not owner authority. Express can mount `nodeTunnel({ dsn: process.env.SPOOL_DSN })` from `@just-every/spool/tunnel` at a same-origin POST route before body-parsing middleware. A Python server can use the shipped [WSGI tunnel](../packages/tunnel-python/README.md). A tunnel is not automatically a trusted client-address boundary: untrusted forwarded addresses are ignored and the server is labelled as the peer. Real blocker-extension and migration qualification remain separate SDK-021 duties.

## Check your capture

Trigger a real exception in the configured app. Open **Issues**, read its exception and stack, and, for bundled JavaScript, compare the mapped original file and line with source. An SDK flush or a successful network response alone is not proof of admission. Check Spool's own issue and outcomes; do not count unsupported telemetry as captured. The guided command counts a test only when Spool returns its receipt. Keep the old DSN available for a deliberate rollback; reverting configuration does not transfer already captured history.
