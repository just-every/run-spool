// Spool declares its own fonts here; Base's Outfit default does not apply.
// Shared by the root renderer, native auth documents and the no-JavaScript first-run document.
export const fontLinks = [
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
