import { fontLinks } from '../../base/font-head';
const preload = (file: string) => <link key={file} rel="preload" href={`/fonts/${file}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />;
/** The head of a public page (the landing and the docs): fonts, the theme and the page's own stylesheet. */
export function PublicHead({ title, description, stylesheet }: { title: string; description: string; stylesheet: string }) {
  return <head>
    <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" href="/theme/spool-mark.svg" type="image/svg+xml" />
    {['zilla-slab-latin-700-normal', 'ibm-plex-sans-latin-400-normal', 'ibm-plex-mono-latin-400-normal'].map(preload)}
    {fontLinks.map(link => <link key={link.href} {...link} />)}
    <link rel="stylesheet" href="/theme/spool.css" /><link rel="stylesheet" href="/theme/landing.css" />{stylesheet !== '/theme/landing.css' && <link rel="stylesheet" href={stylesheet} />}
  </head>;
}
