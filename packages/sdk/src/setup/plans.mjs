// What `spool-setup` does for each framework: the packages to install, the files to create or extend, and the notes to read.
const pythonCommand = options => options.python ?? 'python3';

function nextPlan(found, options) {
  const spool = options.spoolPackage ?? '@just-every/spool', root = found.root ? found.root + '/' : '';
  const add = found.manager === 'npm' ? ['install'] : ['add'];
  return {
    installs: [{ command: found.manager, args: [...add, '@sentry/nextjs', spool] }],
    files: [
      { path: `${found.appDir}/monitoring/route.js`, content: "import { spoolTunnelRoute } from '@just-every/spool/next';\n\n// Sentry's own `tunnelRoute` rewrite only reaches sentry.io; this route forwards to your Spool project instead.\nexport const { POST } = spoolTunnelRoute({ dsn: process.env.SPOOL_DSN });\n" },
      { path: `${root}instrumentation-client.js`, content: "import * as Sentry from '@sentry/nextjs';\n\nSentry.init({\n  dsn: process.env.NEXT_PUBLIC_SPOOL_DSN,\n  tunnel: '/monitoring',\n  release: process.env.NEXT_PUBLIC_SPOOL_RELEASE,\n  environment: process.env.NEXT_PUBLIC_SPOOL_ENVIRONMENT ?? 'production',\n});\n" },
      { path: '.env.local', append: true, marker: 'SPOOL_DSN=', content: `SPOOL_DSN=${options.dsn}\nNEXT_PUBLIC_SPOOL_DSN=${options.dsn}\n` },
    ],
    notes: [
      'Browser errors go through /monitoring on your own origin, so ad-blockers that block the default ingest request do not stop them. Sentry\'s `tunnelRoute` option is not used: it can only rewrite to sentry.io.',
      'Set NEXT_PUBLIC_SPOOL_RELEASE in CI to name the release; unset, the events carry no release, which Spool accepts.',
      'Source maps: run `npx spool-sourcemaps` on your build output in CI (see docs/SENTRY-SWITCHING.md).',
    ],
  };
}

function djangoPlan(found, options) {
  return {
    installs: [{ command: pythonCommand(options), args: ['-m', 'pip', 'install', 'sentry-sdk'] }],
    files: [
      { path: found.settings, append: true, marker: 'spool-setup', content: '\n# Spool error reporting (added by spool-setup). The DSN stays in the environment, not in source control.\nimport os\n\nimport sentry_sdk\n\nsentry_sdk.init(\n    dsn=os.environ.get("SPOOL_DSN"),\n    release=os.environ.get("SPOOL_RELEASE"),  # unset: the SDK infers one from the environment or git\n    environment=os.environ.get("SPOOL_ENVIRONMENT", "production"),\n)\n' },
      ...found.requirements ? [{ path: 'requirements.txt', append: true, marker: 'sentry-sdk', content: 'sentry-sdk\n' }] : [],
      { path: '.env', append: true, marker: 'SPOOL_DSN=', content: `SPOOL_DSN=${options.dsn}\n` },
    ],
    notes: ['Export SPOOL_DSN (the .env file holds it) before starting Django; the Django integration is a default and needs no setup.', 'Python has no source maps to upload.'],
  };
}

const guidance = {
  express: ['Install @sentry/node, create an instrument.js that calls Sentry.init({ dsn: process.env.SPOOL_DSN }), import it first in your server, and call Sentry.setupExpressErrorHandler(app) after your routes.', 'Mount nodeTunnel from @just-every/spool/tunnel at a same-origin path for browser capture.'],
  react: ['Install @sentry/react, call Sentry.init({ dsn, tunnel }) before rendering, and serve a tunnel from your server (@just-every/spool/tunnel for Node, spool_tunnel.py for Python).'],
  fastapi: ['pip install "sentry-sdk[fastapi]", call sentry_sdk.init(dsn=os.environ["SPOOL_DSN"]) before creating the app; the FastAPI and Starlette integrations are defaults.'],
  spring: ['Add io.sentry:sentry-spring-boot-starter-jakarta and set sentry.dsn=${SPOOL_DSN} in application.properties.'],
  rails: ['Add gem "sentry-ruby" and gem "sentry-rails", and set config.dsn = ENV["SPOOL_DSN"] in config/initializers/sentry.rb.'],
  laravel: ['composer require sentry/sentry-laravel, run php artisan sentry:publish --dsn=$SPOOL_DSN, and report exceptions in bootstrap/app.php.'],
  aspnetcore: ['Add the Sentry.AspNetCore package and call builder.WebHost.UseSentry(o => o.Dsn = Environment.GetEnvironmentVariable("SPOOL_DSN")).'],
};

export function plan(found, options) {
  if (found.framework === 'next') return nextPlan(found, options);
  if (found.framework === 'django') return djangoPlan(found, options);
  return { installs: [], files: [], notes: guidance[found.framework] ?? ['No supported framework found here. See docs/SENTRY-SWITCHING.md for the DSN-only switch.'], manual: true };
}
