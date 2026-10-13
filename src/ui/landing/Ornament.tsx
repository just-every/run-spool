// Engraved, ink-only drawings (public/theme/landing/*.webp, 2x). Width and height are the 1x size at full desktop scale;
// the stylesheet scales them with the viewport and places each one in its band. Decorative: no text, hidden from assistive tech.
const sizes = {
  needle: [180, 109], pincushion: [168, 128], thimble: [150, 118], spools2: [190, 117], bundle: [196, 120],
  robot: [120, 134], laptop: [200, 141], mug: [84, 74], tape: [200, 107],
} as const;
export type OrnamentName = keyof typeof sizes;
export function Ornament({ name }: { name: OrnamentName }) {
  const [width, height] = sizes[name];
  return <img className={`ornament o-${name}`} src={`/theme/landing/${name}.webp`} alt="" aria-hidden="true" width={width} height={height} loading="lazy" decoding="async" />;
}
