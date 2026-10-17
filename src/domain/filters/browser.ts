import type { BrowserName, InboundEvent, LegacyBrowserRule } from './types.ts';
const uaRules: [BrowserName, RegExp][] = [
 ['ie', /(?:MSIE\s|rv:)(\d+(?:\.\d+)*)/i], ['edge', /(?:Edg(?:A|iOS)?|Edge)\/(\d+(?:\.\d+)*)/i],
 ['opera', /(?:OPR|Opera)\/(\d+(?:\.\d+)*)/i], ['samsung', /SamsungBrowser\/(\d+(?:\.\d+)*)/i],
 ['chrome', /(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/i], ['firefox', /(?:Firefox|FxiOS)\/(\d+(?:\.\d+)*)/i],
 ['safari', /Version\/(\d+(?:\.\d+)*).*Safari\//i],
];
const names: Record<string, BrowserName> = { chrome: 'chrome', chromium: 'chrome', firefox: 'firefox', safari: 'safari', 'mobile safari': 'safari', edge: 'edge', 'microsoft edge': 'edge', ie: 'ie', 'internet explorer': 'ie', opera: 'opera', 'samsung internet': 'samsung', samsung: 'samsung' };
export function legacyBrowser(event: InboundEvent, userAgent: string, rules: LegacyBrowserRule[]): boolean {
 const value = event.sentry?.contexts?.browser;
 const context=value&&typeof value==='object'&&!Array.isArray(value)?value:undefined;
 let browser: { name: BrowserName; version: string } | undefined;
 if (typeof context?.name === 'string' && names[context.name.toLowerCase()] && typeof context.version === 'string' && /^\d+(?:\.\d+)*$/.test(context.version)) browser = { name: names[context.name.toLowerCase()], version: context.version };
 if (!browser) for (const [name, pattern] of uaRules) {
  // Firefox also sends rv:, so IE's rv: token requires Trident.
  if (name === 'ie' && !/MSIE|Trident/i.test(userAgent)) continue;
  const match = pattern.exec(userAgent); if (match) { browser = { name, version: match[1] }; break; }
 }
 return !!browser && rules.some(rule => {
  if (rule.name !== browser!.name) return false;
  const actual = browser!.version.split('.').map(Number), max = rule.maxVersion.split('.').map(Number);
  // An owner entering 120 matches the entire 120.x family; 120.1 narrows it.
  for (let i = 0; i < max.length; i++) { if ((actual[i] ?? 0) < max[i]) return true; if ((actual[i] ?? 0) > max[i]) return false; }
  return true;
 });
}
