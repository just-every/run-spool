const bundleSuffix=/(^|\/)([^/]+?)(?:[.-]([a-fA-F0-9]{8,64})|-([A-Za-z0-9_-]{8}))(\.(?:m?js|cjs))$/;
/** Normalize recognized content-hash suffixes only in grouping input. */
export function bundleFile(file:string):string {
 return file.replace(bundleSuffix,(matched,directory,entry,hex,encoded,extension)=>hex||/[^a-z]/.test(encoded)?`${directory}${entry}-[hash]${extension}`:matched);
}
