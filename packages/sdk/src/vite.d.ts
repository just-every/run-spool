export interface SourceMapOptions {
  /** Your Spool installation's origin. */
  endpoint: string;
  project: string;
  release: string;
  build: string;
  /** The name of the environment variable that holds a project deploy key. The key itself never enters the bundle. */
  keyEnv: string;
  /** Additional map names that must exist before deployment. */
  requiredMaps?: string[];
}
/** Rollup and Vite plugin: registers the release, injects debug IDs and uploads each chunk's source map. A failed upload fails the build. */
export declare function spoolSourceMaps(options: SourceMapOptions): {
  name: string; apply: 'build'; enforce: 'post';
  generateBundle(output: unknown, bundle: Record<string, unknown>): Promise<void>;
};
