import { Manrope, DM_Sans, Playfair_Display, Poppins, Inter } from 'next/font/google';

// A short, curated list of font pairings for the public storefront (brief:
// "mantener una cantidad limitada y coherente", not a free-text font picker).
// next/font requires its calls to be static at module scope, so every
// pairing's fonts are declared here once and the storefront always carries
// all of their CSS variable classes — StorefrontView just switches which
// var() it actually applies as font-family based on the merchant's choice.
const manropeHeading = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--sf-heading-walti' });
const dmSansBody = DM_Sans({ subsets: ['latin'], variable: '--sf-body-walti' });
const playfairHeading = Playfair_Display({ subsets: ['latin'], weight: ['700'], variable: '--sf-heading-clasica' });
const poppinsHeading = Poppins({ subsets: ['latin'], weight: ['700'], variable: '--sf-heading-directa' });
const interBody = Inter({ subsets: ['latin'], variable: '--sf-body-shared' });

export const STOREFRONT_FONT_CLASSNAME = [
  manropeHeading.variable,
  dmSansBody.variable,
  playfairHeading.variable,
  poppinsHeading.variable,
  interBody.variable,
].join(' ');

export interface FontPairing {
  key: string;
  label: string;
  sample: string;
  headingVar: string;
  bodyVar: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  { key: 'walti', label: 'Walti', sample: 'Manrope + DM Sans — moderna y profesional', headingVar: 'var(--sf-heading-walti)', bodyVar: 'var(--sf-body-walti)' },
  { key: 'clasica', label: 'Clásica', sample: 'Playfair Display + Inter — elegante y editorial', headingVar: 'var(--sf-heading-clasica)', bodyVar: 'var(--sf-body-shared)' },
  { key: 'directa', label: 'Directa', sample: 'Poppins + Inter — cercana y redondeada', headingVar: 'var(--sf-heading-directa)', bodyVar: 'var(--sf-body-shared)' },
];

export function getFontPairing(key: string | null | undefined): FontPairing {
  return FONT_PAIRINGS.find((f) => f.key === key) || FONT_PAIRINGS[0];
}
