// Owned server-side catalogue, reviewed 2026-10-17. Add named crawler tokens
// here when vendors introduce a new UA; policy and SDK releases need not change.
export const crawlerCatalogue = [
 'Googlebot', 'GoogleOther', 'Google-InspectionTool', 'AdsBot-Google', 'Mediapartners-Google',
 'bingbot', 'BingPreview', 'DuckDuckBot', 'Baiduspider', 'YandexBot', 'YandexImages',
 'Sogou', 'Slurp', 'Applebot', 'PetalBot', 'Bytespider', 'facebookexternalhit', 'Facebot',
 'Twitterbot', 'LinkedInBot', 'Slackbot', 'Discordbot', 'TelegramBot', 'WhatsApp',
 'Pinterestbot', 'SemrushBot', 'AhrefsBot', 'MJ12bot', 'DotBot', 'GPTBot', 'OAI-SearchBot',
 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'CCBot', 'archive.org_bot', 'ia_archiver',
] as const;
const tokens = crawlerCatalogue.map(name => name.toLowerCase());
export const crawlerCatalogueUpdated = '2026-10-17';
export function knownCrawler(userAgent: string): boolean {
 const value = userAgent.toLowerCase();
 return tokens.some(token => {
  let at = value.indexOf(token);
  while (at !== -1) {
   const before = at === 0 ? '' : value[at - 1], after = value[at + token.length] ?? '';
   if ((!before || !/[a-z0-9]/.test(before)) && (!after || !/[a-z0-9]/.test(after))) return true;
   at = value.indexOf(token, at + token.length);
  }
  return false;
 });
}
