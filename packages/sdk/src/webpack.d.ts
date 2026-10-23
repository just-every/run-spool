import type {SourceMapOptions} from './vite.js';
export declare class SpoolSourceMapsPlugin { constructor(options:SourceMapOptions); apply(compiler:unknown):void; }
export declare function spoolSourceMaps(options:SourceMapOptions):SpoolSourceMapsPlugin;
