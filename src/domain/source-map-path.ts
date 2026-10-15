import { file } from './frame-path';

// Map sources are relative to the emitted bundle, whose build directory is
// absent from an issue. Use the same source identity for frames and modules.
export function sourceMapFile(source: string): string {
  return file(source).replace(/^(?:\.{1,2}\/)+/, '');
}
