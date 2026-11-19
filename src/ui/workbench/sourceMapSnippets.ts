export type Bundler = 'vite' | 'rollup' | 'webpack' | 'esbuild' | 'next';
export const bundlers: { value: Bundler; label: string }[] = [
  { value: 'vite', label: 'Vite' }, { value: 'rollup', label: 'Rollup' },
  { value: 'webpack', label: 'webpack' }, { value: 'esbuild', label: 'esbuild' },
  { value: 'next', label: 'Next.js' },
];

export function shellQuote(value: string) { return `'${value.replaceAll("'", `'"'"'`)}'`; }

export function sourceMapInstructions(bundler: Bundler, config: { endpoint: string; project: string; release: string; build: string }) {
  const q = JSON.stringify;
  const options = `endpoint: ${q(config.endpoint)},\n    project: ${q(config.project)}, release: ${q(config.release)},\n    build: ${q(config.build)}, keyEnv: 'SPOOL_DEPLOY_KEY'`;
  const download = `curl -fsS ${shellQuote(`${config.endpoint}/spool-sourcemaps.mjs`)} -o spool-sourcemaps.mjs`;
  const cli = `node ./spool-sourcemaps.mjs --endpoint ${shellQuote(config.endpoint)} \\\n  --project ${shellQuote(config.project)} --release ${shellQuote(config.release)} \\\n  --build ${shellQuote(config.build)} --key-env SPOOL_DEPLOY_KEY`;
  if (bundler === 'vite') return {
    label: 'Vite configuration',
    config: `// vite.config.js: keep your existing plugins and add spoolSourceMaps last.\nimport { spoolSourceMaps } from '@just-every/spool/vite';\nexport default {\n  build: { sourcemap: true },\n  plugins: [spoolSourceMaps({ ${options} })],\n};`,
    command: 'npx vite build',
  };
  if (bundler === 'rollup') return {
    label: 'Rollup configuration',
    config: `// rollup.config.js: merge into your existing output and plugins.\nimport { spoolSourceMaps } from '@just-every/spool/vite';\nexport default {\n  input: 'src/index.js',\n  output: { dir: 'dist', format: 'es', sourcemap: true },\n  plugins: [spoolSourceMaps({ ${options} })],\n};`,
    command: 'npx rollup --config',
  };
  if (bundler === 'webpack') return {
    label: 'webpack configuration',
    config: `// webpack.config.js: add to your existing configuration.\nmodule.exports = { devtool: 'source-map' };`,
    command: `npx webpack --mode production\n${download} &&\n${cli} dist/*.js`,
  };
  if (bundler === 'next') return {
    label: 'Next.js configuration',
    config: `// next.config.js: add to your existing configuration.\nmodule.exports = { productionBrowserSourceMaps: true };`,
    command: `npx next build\n${download} &&\nfind .next/static -name '*.js' -exec ${cli} {} +`,
  };
  return {
    label: 'esbuild configuration',
    config: '// The build command below emits external .map files beside each bundle.',
    command: `npx esbuild src/index.js --bundle --minify --sourcemap=external --outdir=dist\n${download} &&\n${cli} dist/*.js`,
  };
}
