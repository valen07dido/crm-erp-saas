import { Manrope, DM_Sans, IBM_Plex_Mono, Instrument_Serif, Space_Grotesk } from 'next/font/google';
import type { DesignDoc, FontKey } from './types';

// Self-hosted through next/font, same as the app's own typography. The
// canvas renderer needs the real (hashed) family names, which is what
// `.style.fontFamily` gives us.
const manrope = Manrope({ subsets: ['latin'], display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], display: 'swap', adjustFontFallback: false });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' });

export interface FontOption {
  key: FontKey;
  label: string;
  role: string;
  family: string;
  weights: number[];
}

export const FONT_OPTIONS: FontOption[] = [
  { key: 'manrope', label: 'Manrope', role: 'Marca · titulares', family: manrope.style.fontFamily, weights: [400, 500, 600, 700, 800] },
  { key: 'dmsans', label: 'DM Sans', role: 'Marca · textos', family: dmSans.style.fontFamily, weights: [400, 500, 600, 700] },
  { key: 'plexmono', label: 'IBM Plex Mono', role: 'Marca · datos y etiquetas', family: plexMono.style.fontFamily, weights: [400, 500, 600, 700] },
  { key: 'instrument', label: 'Instrument Serif', role: 'Complementaria · editorial', family: instrument.style.fontFamily, weights: [400] },
  { key: 'spacegrotesk', label: 'Space Grotesk', role: 'Complementaria · técnica', family: spaceGrotesk.style.fontFamily, weights: [400, 500, 600, 700] },
];

const BY_KEY = Object.fromEntries(FONT_OPTIONS.map((f) => [f.key, f])) as Record<FontKey, FontOption>;

export function fontFamily(key: FontKey): string {
  return (BY_KEY[key] ?? BY_KEY.dmsans).family;
}

export function fontOption(key: FontKey): FontOption {
  return BY_KEY[key] ?? BY_KEY.dmsans;
}

/** Closest weight the font actually ships (e.g. Instrument Serif only has 400). */
export function clampWeight(key: FontKey, weight: number): number {
  const ws = fontOption(key).weights;
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

/** Make sure every font/weight a document uses is loaded before drawing it on a canvas. */
export async function ensureDocFonts(doc: DesignDoc): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const wanted = new Set<string>();
  for (const l of doc.layers) {
    if (l.type === 'text') wanted.add(`${clampWeight(l.font, l.weight)} 48px ${fontFamily(l.font)}`);
  }
  // Placeholder labels use DM Sans.
  wanted.add(`500 48px ${fontFamily('dmsans')}`);
  await Promise.all(Array.from(wanted).map((f) => document.fonts.load(f).catch(() => undefined)));
}
