/** Node owns these locations; application bundle uploads cannot map them. */
export function isNodeRuntimeFrame(file:string):boolean {
 return file.startsWith('node:');
}
