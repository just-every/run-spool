/** Sanitized SDK evidence. Frame order is the SDK's oldest-to-newest order. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface Truncation { path: string; reason: string; omitted?: number }
export interface SentryFrame {
 filename?: string; abs_path?: string; module?: string; package?: string;
 function?: string; raw_function?: string; symbol?: string; lineno?: number; colno?: number;
 in_app?: boolean; platform?: string; pre_context?: string[]; context_line?: string; post_context?: string[];
 vars?: Record<string, Json>; instruction_addr?: string; symbol_addr?: string; image_addr?: string;
 addr_mode?: string; trust?: string;
}
export interface SentryStack { frames: SentryFrame[]; frames_omitted?: number[] }
export interface SentryException {
 type?: string; value?: string; module?: string;
 mechanism?: { type?: string; handled?: boolean; synthetic?: boolean; source?: string; is_exception_group?: boolean; exception_id?: number; parent_id?: number };
 stacktrace?: SentryStack;
}
export interface SentryEvidence {
 version: 1; exceptions: SentryException[]; truncation: Truncation[];
 platform?: string; stacktrace?: SentryStack;
 threads?: { id?: Json; name?: string; crashed?: boolean; current?: boolean; state?: Json; stacktrace?: SentryStack }[];
 level?: string; logger?: string; transaction?: string; server_name?: string; environment?: string; release?: string; dist?: string;
 modules?: Record<string, Json>; fingerprint?: string[]; sdk?: Record<string, Json>; debug_meta?: Record<string, Json>;
 message?: string; logentry?: { message?: string; params?: Json; formatted?: string };
 tags?: Record<string, string>; contexts?: Record<string, Json>; request?: Record<string, Json>; extra?: Record<string, Json>;
 breadcrumbs?: Record<string, Json>[]; _meta?: Record<string, Json>;
}
