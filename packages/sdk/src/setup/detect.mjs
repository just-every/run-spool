import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const exists = path => access(path).then(() => true, () => false);
const text = path => readFile(path, 'utf8').catch(() => '');

/** Names the framework in `dir` from its own manifest files, or `unknown`. */
export async function detect(dir) {
  const pkg = JSON.parse((await text(join(dir, 'package.json'))) || '{}'), deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next) {
    const appDir = (await exists(join(dir, 'src/app'))) ? 'src/app' : 'app';
    const manager = (await exists(join(dir, 'pnpm-lock.yaml'))) ? 'pnpm' : (await exists(join(dir, 'yarn.lock'))) ? 'yarn' : 'npm';
    return { framework: 'next', appDir, root: appDir.startsWith('src/') ? 'src' : '', manager };
  }
  if (deps.express) return { framework: 'express' };
  if (deps.react) return { framework: 'react' };
  const manage = await text(join(dir, 'manage.py')), settings = /DJANGO_SETTINGS_MODULE['"],\s*['"]([^'"\n]*)['"]/.exec(manage)?.[1];
  if (settings !== undefined) {
    // A dotted module of ASCII identifiers (JavaScript's \w): anything else is refused, never rewritten into another path.
    if (!/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/.test(settings)) throw new Error(`manage.py names DJANGO_SETTINGS_MODULE ${JSON.stringify(settings)}, which is not a dotted module of ASCII letters, digits and underscores; add the Sentry init to your settings by hand. Nothing was written.`);
    return { framework: 'django', settings: settings.replaceAll('.', '/') + '.py', requirements: await exists(join(dir, 'requirements.txt')) };
  }
  const python = (await text(join(dir, 'requirements.txt'))) + (await text(join(dir, 'pyproject.toml')));
  if (/fastapi/i.test(python)) return { framework: 'fastapi' };
  if (/spring-boot/.test((await text(join(dir, 'pom.xml'))) + (await text(join(dir, 'build.gradle'))) + (await text(join(dir, 'build.gradle.kts'))))) return { framework: 'spring' };
  if (/gem ['"]rails['"]/.test(await text(join(dir, 'Gemfile')))) return { framework: 'rails' };
  if (/"laravel\/framework"/.test(await text(join(dir, 'composer.json')))) return { framework: 'laravel' };
  for (const name of await readdir(dir).catch(() => [])) if (name.endsWith('.csproj') && /Microsoft\.NET\.Sdk\.Web/.test(await text(join(dir, name)))) return { framework: 'aspnetcore' };
  return { framework: 'unknown' };
}
