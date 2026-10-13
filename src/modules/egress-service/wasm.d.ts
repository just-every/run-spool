declare module '*.wasm' { const module: WebAssembly.Module; export default module; }
declare module '*engine.js' { export function instantiate(module: WebAssembly.Module): WebAssembly.Exports; }
