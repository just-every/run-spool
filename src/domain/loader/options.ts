import sdkPackage from '@sentry/browser/package.json';

export const shippedSdkVersion = sdkPackage.version;
export type LoaderOptions = { sdkVersion: string; enabled: boolean; tracesSampleRate: number; replaysSessionSampleRate: number; replaysOnErrorSampleRate: number; feedback: boolean };
export const defaultLoaderOptions = (): LoaderOptions => ({ sdkVersion: shippedSdkVersion, enabled: true, tracesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0, feedback: false });
export function loaderOptions(input: any): LoaderOptions {
 const defaults = defaultLoaderOptions();
 if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join() !== Object.keys(defaults).sort().join() || input.sdkVersion !== shippedSdkVersion || typeof input.enabled !== 'boolean' || typeof input.feedback !== 'boolean') throw new Error('Invalid loader settings');
 for (const name of ['tracesSampleRate', 'replaysSessionSampleRate', 'replaysOnErrorSampleRate']) if (typeof input[name] !== 'number' || !Number.isFinite(input[name]) || input[name] < 0 || input[name] > 1) throw new Error('Sample rates must be between zero and one');
 return { ...input };
}
export async function readLoader(db: D1Database, project: string, keyHash: string) {
 const row = await db.prepare('SELECT revision,settings FROM loader_settings WHERE project=? AND key_hash=?').bind(project, keyHash).first<{ revision: number; settings: string }>();
 return { revision: row?.revision ?? 0, settings: row ? loaderOptions(JSON.parse(row.settings)) : defaultLoaderOptions(), versions: [shippedSdkVersion] };
}
