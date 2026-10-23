/** What the chunk-upload options endpoint advertises. These are the sizes Spool really accepts today:
 * SRC-004's larger published capacity needs the isolated storage it names, so an unmodified client is
 * told the truth and a file over a limit is refused per file with its reason. */
export const chunkSize = 524288;
export const chunksPerRequest = 4;
export const maxRequestSize = 4 * 1024 * 1024;
export const concurrency = 4;
export const maxFileSize = 16 * 1024 * 1024;
export const stagedLimit = 64 * 1024 * 1024;
export const stagedLifetime = 3600000;
/** Artifact bundles carry source maps; debug files are accepted for assembly only to refuse each one by name. */
export const accepted = ['artifact_bundles', 'debug_files'];
export const manifestLimit = 1024 * 1024;
export const bundleFileLimit = 2000;
export { sourceMapByteLimit as mapByteLimit } from '../artifacts';
/** Assembly receipts only make a repeated upload cheap; they are kept thirty days. */
export const receiptLifetime = 30 * 24 * 3600000;
