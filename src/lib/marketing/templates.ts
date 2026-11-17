import type { Background, BrandKit, DesignDoc, FormatId, ImageLayer, Layer, ShapeLayer, TextLayer } from './types';
import { FORMATS, type FormatSpec } from './formats';
import { BRAND, formatWhatsapp } from './brand';

// ─── Layer factories ────────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

type TextInit = Partial<TextLayer> & Pick<TextLayer, 'text' | 'x' | 'y' | 'w'>;
export function textLayer(p: TextInit): TextLayer {
  const size = p.size ?? 40;
  return {
    id: uid(),
    name: 'Texto',
    type: 'text',
    h: size * 1.3,
    rotation: 0,
    opacity: 1,
    font: 'dmsans',
    weight: 400,
    size,
    lineHeight: 1.3,
    letterSpacing: 0,
    color: BRAND.graphite,
    accentColor: BRAND.petroleum,
    align: 'left',
    uppercase: false,
    highlight: null,
    ...p,
  };
}

type ImageInit = Partial<ImageLayer> & Pick<ImageLayer, 'x' | 'y' | 'w' | 'h'>;
export function imageLayer(p: ImageInit): ImageLayer {
  return {
    id: uid(),
    name: 'Imagen',
    type: 'image',
    src: '',
    role: 'image',
    fit: 'cover',
    radius: 0,
    frame: 'none',
    shadow: false,
    rotation: 0,
    opacity: 1,
    ...p,
  };
}

type ShapeInit = Partial<ShapeLayer> & Pick<ShapeLayer, 'x' | 'y' | 'w' | 'h'>;
export function shapeLayer(p: ShapeInit): ShapeLayer {
  return {
    id: uid(),
    name: 'Forma',
    type: 'shape',
    shape: 'rect',
    fill: BRAND.lime,
    strokeWidth: 0,
    radius: 0,
    rotation: 0,
    opacity: 1,
    ...p,
  };
}

export const LOGOS = {
  wordmark: { src: '/logo-sidebar.png', aspect: 948 / 312 },
  mascot: { src: '/logo-login.png', aspect: 392 / 299 },
  isotipo: { src: '/favicon.png', aspect: 1 },
};

/** Original logo, never distorted (aspect locked, always "contain"). */
export function logoLayer(kind: keyof typeof LOGOS, x: number, y: number, h: number, name?: string): ImageLayer {
  const l = LOGOS[kind];
  return imageLayer({
    name: name || (kind === 'wordmark' ? 'Logotipo' : kind === 'mascot' ? 'Logo con mascota' : 'Isotipo'),
    src: l.src,
    role: 'logo',
    fit: 'contain',
    aspect: l.aspect,
    x,
    y,
    w: Math.round(h * l.aspect),
    h,
  });
}

/**
 * The wordmark is navy: on dark backgrounds it sits on a light chip instead
 * of being recolored (same rule the app's own sidebar follows).
 */
function logoChip(x: number, y: number, logoH: number, chipColor: string = BRAND.ivory): Layer[] {
  const padX = logoH * 0.42;
  const padY = logoH * 0.3;
  const logo = logoLayer('wordmark', x + padX, y + padY, logoH);
  return [
    shapeLayer({ name: 'Fondo del logo', x, y, w: logo.w + padX * 2, h: logoH + padY * 2, fill: chipColor, radius: logoH * 0.36 }),
    logo,
  ];
}

function background(p: Partial<Background> & Pick<Background, 'color'>): Background {
  return {
    type: 'solid',
    color2: p.color,
    angle: 160,
    pattern: 'none',
    patternColor: BRAND.ivory,
    patternOpacity: 0.06,
    ...p,
  };
}

function doc(fmt: FormatSpec, bg: Background, layers: Layer[], templateId: string): DesignDoc {
  return { version: 1, format: fmt.id, width: fmt.width, height: fmt.height, background: bg, layers, templateId };
}

// ─── Content & sizing ───────────────────────────────────────────────────────

export interface TemplateContent {
  kicker?: string;
  headline: string;
  body?: string;
  cta?: string;
  /** Free-form highlight line (e.g. a promo benefit the team typed). */
  highlight?: string;
  /** "02 / 06" for carousel slides. */
  index?: string;
}

interface Ctx {
  fmt: FormatSpec;
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  B: number;
  CW: number;
  tall: boolean;
  square: boolean;
  /** Scale for type: 1 on stories, smaller on square/portrait. */
  k: number;
  wa: string;
  cta: string;
}

function ctx(fmtId: FormatId, kit: BrandKit, c: TemplateContent): Ctx {
  const fmt = FORMATS[fmtId];
  const tall = fmt.height >= 1900;
  const square = fmt.height === fmt.width;
  return {
    fmt,
    W: fmt.width,
    H: fmt.height,
    L: fmt.safe.left,
    R: fmt.width - fmt.safe.right,
    T: fmt.safe.top,
    B: fmt.height - fmt.safe.bottom,
    CW: fmt.width - fmt.safe.left - fmt.safe.right,
    tall,
    square,
    k: tall ? 1 : square ? 0.78 : 0.88,
    wa: formatWhatsapp(kit.whatsapp),
    cta: c.cta?.trim() || kit.cta,
  };
}

/** Rough height of a wrapped text block, used to anchor blocks from the bottom. */
function estimateHeight(text: string, w: number, size: number, lineHeight: number, charW = 0.53): number {
  const perLine = Math.max(8, Math.floor(w / (size * charW)));
  const lines = text.split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.replace(/\*/g, '').length / perLine)), 0);
  return lines * size * lineHeight;
}

function ctaPill(x: number, y: number, text: string, size: number, fill: string, color: string, align: TextLayer['align'] = 'left', w = 900): TextLayer {
  return textLayer({
    name: 'CTA',
    text,
    x,
    y,
    w,
    font: 'manrope',
    weight: 700,
    size,
    lineHeight: 1.2,
    color,
    accentColor: color,
    align,
    highlight: { color: fill, padX: size * 0.95, padY: size * 0.62, radius: size * 2 },
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  /** Formats the layout was designed for (others still work, just less ideal). */
  bestFor: FormatId[];
  usesScreenshot?: boolean;
  swatch: [string, string];
  build: (fmt: FormatId, c: TemplateContent, kit: BrandKit) => DesignDoc;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'editorial',
    name: 'Titular editorial',
    description: 'Marfil, tipografía grande y una idea por pieza.',
    bestFor: ['story', 'post', 'portrait'],
    swatch: [BRAND.ivory, BRAND.graphite],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(118 * x.k);
      const bodyS = Math.round(42 * x.k);
      const ctaS = Math.round(36 * x.k);
      const logoH = Math.round(62 * x.k);
      const footerY = x.B - logoH;
      const ctaY = footerY - Math.round((x.tall ? 190 : 150) * x.k);
      const body = c.body?.trim() || '';
      const bodyY = ctaY - Math.round(60 * x.k) - estimateHeight(body, x.CW * 0.9, bodyS, 1.38);
      const layers: Layer[] = [
        shapeLayer({ name: 'Marca lima', x: x.L, y: x.T + 4, w: 22, h: 22, fill: BRAND.lime, radius: 4 }),
        textLayer({
          name: 'Etiqueta',
          text: c.kicker || 'WALTI · Gestión comercial',
          x: x.L + 40,
          y: x.T - 6,
          w: x.CW - 40,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          letterSpacing: 0.12,
          uppercase: true,
          color: BRAND.petroleum,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: x.T + Math.round((x.tall ? 130 : 90) * x.k),
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.02,
          letterSpacing: -0.035,
          color: BRAND.graphite,
          accentColor: BRAND.petroleum,
        }),
      ];
      if (body) {
        layers.push(
          textLayer({ name: 'Texto', text: body, x: x.L, y: bodyY, w: x.CW * 0.9, size: bodyS, lineHeight: 1.38, color: BRAND.muted }),
        );
      }
      layers.push(
        ctaPill(x.L + ctaS * 0.95, ctaY, x.cta, ctaS, BRAND.graphite, BRAND.lime),
        logoLayer('wordmark', x.L, footerY, logoH),
        textLayer({
          name: 'WhatsApp',
          text: `WhatsApp ${x.wa}`,
          x: x.L + logoH * 3.2,
          y: footerY + logoH / 2 - 18,
          w: x.R - x.L - logoH * 3.2,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          align: 'right',
          color: BRAND.graphite,
        }),
      );
      return doc(x.fmt, background({ color: BRAND.ivory, pattern: 'grid', patternColor: BRAND.graphite, patternOpacity: 0.035 }), layers, 'editorial');
    },
  },
  {
    id: 'pantalla',
    name: 'Captura en pantalla',
    description: 'Grafito con una captura real de WALTI en ventana de navegador.',
    bestFor: ['story', 'post', 'portrait', 'reel-cover'],
    usesScreenshot: true,
    swatch: [BRAND.graphite, BRAND.lime],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(100 * x.k);
      const ctaS = Math.round(34 * x.k);
      const logoH = Math.round(48 * x.k);
      const headY = x.T + Math.round(70 * x.k);
      const headH = estimateHeight(c.headline, x.CW, hs, 1.04, 0.56);
      const shotY = headY + headH + Math.round((x.tall ? 90 : 56) * x.k);
      const shotBottom = x.tall ? x.B - 170 : x.H - x.fmt.safe.bottom - logoH - 80;
      const shotX = x.square ? x.L + 90 : x.L;
      const layers: Layer[] = [
        textLayer({
          name: 'Etiqueta',
          text: c.kicker || 'Así se ve WALTI',
          x: x.L,
          y: x.T,
          w: x.CW,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          letterSpacing: 0.12,
          uppercase: true,
          color: BRAND.lime,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: headY,
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.04,
          letterSpacing: -0.03,
          color: BRAND.ivory,
          accentColor: BRAND.lime,
        }),
        imageLayer({
          name: 'Captura real',
          role: 'screenshot',
          frame: 'browser',
          shadow: true,
          radius: 22,
          x: shotX,
          y: shotY,
          // Bleeds past the right edge on purpose: reads as "a real screen", not a sticker.
          w: x.W - shotX + (x.square ? 120 : 60),
          h: Math.max(260, shotBottom - shotY),
          placeholderLabel: 'Elegí una captura real de WALTI',
        }),
      ];
      if (x.tall) layers.push(ctaPill(x.L + ctaS * 0.95, x.B - 78, x.cta, ctaS, BRAND.lime, BRAND.graphite));
      layers.push(...logoChip(x.tall ? x.R - logoH * 3.04 - logoH * 0.84 : x.L, x.tall ? x.T - 14 : x.B - logoH * 1.6, logoH));
      if (x.tall) {
        // In stories the chip sits top-right, so the kicker must not run under it.
        (layers[0] as TextLayer).w = x.CW - logoH * 4.2;
      }
      return doc(
        x.fmt,
        background({ color: BRAND.graphite, color2: '#1A2A29', type: 'gradient', angle: 165, pattern: 'grid', patternColor: BRAND.ivory, patternOpacity: 0.045 }),
        layers,
        'pantalla',
      );
    },
  },
  {
    id: 'dato',
    name: 'Funcionalidad',
    description: 'Petróleo, número grande y una funcionalidad explicada simple.',
    bestFor: ['post', 'portrait', 'story'],
    swatch: [BRAND.petroleum, BRAND.ivory],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(104 * x.k);
      const bodyS = Math.round(42 * x.k);
      const logoH = Math.round(46 * x.k);
      const idx = c.index || '01';
      const numS = Math.round((x.tall ? 300 : 230) * x.k);
      const headY = x.T + numS * 0.95 + Math.round(40 * x.k);
      const headH = estimateHeight(c.headline, x.CW, hs, 1.03, 0.56);
      const layers: Layer[] = [
        textLayer({
          name: 'Número',
          text: idx,
          x: x.L - 8,
          y: x.T - numS * 0.08,
          w: x.CW,
          font: 'instrument',
          weight: 400,
          size: numS,
          lineHeight: 1,
          color: BRAND.lime,
        }),
        textLayer({
          name: 'Etiqueta',
          text: c.kicker || 'Funcionalidad',
          x: x.L,
          y: x.T + 10,
          w: x.CW,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          letterSpacing: 0.12,
          uppercase: true,
          align: 'right',
          color: BRAND.ivory,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: headY,
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.03,
          letterSpacing: -0.03,
          color: BRAND.white,
          accentColor: BRAND.lime,
        }),
      ];
      if (c.body) {
        layers.push(
          shapeLayer({ name: 'Línea', x: x.L, y: headY + headH + 46 * x.k, w: 120, h: 6, fill: BRAND.lime, radius: 3 }),
          textLayer({
            name: 'Texto',
            text: c.body,
            x: x.L,
            y: headY + headH + 90 * x.k,
            w: x.CW * 0.92,
            size: bodyS,
            lineHeight: 1.38,
            color: '#E6F1EF',
          }),
        );
      }
      layers.push(
        ...logoChip(x.L, x.B - logoH * 1.6, logoH),
        textLayer({
          name: 'CTA',
          text: x.cta,
          x: x.L + logoH * 4.4,
          y: x.B - logoH * 1.6 + logoH * 0.3 + logoH / 2 - 16,
          w: x.R - x.L - logoH * 4.4,
          font: 'manrope',
          weight: 700,
          size: Math.round(28 * Math.max(x.k, 0.85)),
          align: 'right',
          color: BRAND.ivory,
        }),
      );
      return doc(x.fmt, background({ color: BRAND.petroleum, color2: '#2F7A70', type: 'gradient', angle: 200, pattern: 'dots', patternColor: BRAND.white, patternOpacity: 0.07 }), layers, 'dato');
    },
  },
  {
    id: 'pregunta',
    name: 'Pregunta directa',
    description: 'Fondo lima, una pregunta que nombra el problema.',
    bestFor: ['story', 'post', 'portrait', 'reel-cover'],
    swatch: [BRAND.lime, BRAND.graphite],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(124 * x.k);
      const bodyS = Math.round(44 * x.k);
      const ctaS = Math.round(36 * x.k);
      const isoH = Math.round(84 * x.k);
      const headH = estimateHeight(c.headline, x.CW, hs, 1.0, 0.56);
      const mid = x.T + (x.B - x.T) * (x.tall ? 0.42 : 0.4);
      const headY = Math.max(x.T + isoH + 60 * x.k, mid - headH / 2);
      const layers: Layer[] = [
        logoLayer('isotipo', x.R - isoH, x.T, isoH),
        textLayer({
          name: 'Etiqueta',
          text: c.kicker || '¿Te pasa?',
          x: x.L,
          y: x.T + isoH / 2 - 18,
          w: x.CW - isoH - 20,
          font: 'plexmono',
          weight: 600,
          size: Math.round(28 * Math.max(x.k, 0.85)),
          letterSpacing: 0.1,
          uppercase: true,
          color: BRAND.graphite,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: headY,
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.0,
          letterSpacing: -0.04,
          color: BRAND.graphite,
          accentColor: BRAND.petroleum,
        }),
      ];
      if (c.body) {
        layers.push(
          textLayer({
            name: 'Texto',
            text: c.body,
            x: x.L,
            y: headY + headH + 50 * x.k,
            w: x.CW * 0.88,
            size: bodyS,
            weight: 500,
            lineHeight: 1.36,
            color: BRAND.graphite,
          }),
        );
      }
      layers.push(ctaPill(x.L + ctaS * 0.95, x.B - ctaS * 1.9, x.cta, ctaS, BRAND.graphite, BRAND.ivory));
      return doc(x.fmt, background({ color: BRAND.lime, pattern: 'lines', patternColor: BRAND.graphite, patternOpacity: 0.05 }), layers, 'pregunta');
    },
  },
  {
    id: 'telefono',
    name: 'Celular',
    description: 'Captura real dentro de un celular, ideal para la página pública.',
    bestFor: ['story', 'reel-cover', 'portrait'],
    usesScreenshot: true,
    swatch: ['#1E2A2C', BRAND.lime],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(92 * x.k);
      const ctaS = Math.round(34 * x.k);
      const headH = estimateHeight(c.headline, x.CW, hs, 1.04, 0.56);
      const phoneTop = x.T + headH + Math.round(130 * x.k);
      const phoneBottom = x.tall ? x.B - 150 : x.H + 140; // bleeds off the bottom on feed formats
      const phoneH = phoneBottom - phoneTop;
      const phoneW = Math.min(x.CW * 0.72, phoneH * 0.49);
      const layers: Layer[] = [
        textLayer({
          name: 'Etiqueta',
          text: c.kicker || 'WALTI en tu celular',
          x: x.L,
          y: x.T,
          w: x.CW,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          letterSpacing: 0.12,
          uppercase: true,
          align: 'center',
          color: BRAND.lime,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: x.T + Math.round(64 * x.k),
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.04,
          letterSpacing: -0.03,
          align: 'center',
          color: BRAND.ivory,
          accentColor: BRAND.lime,
        }),
        shapeLayer({ name: 'Halo', shape: 'ellipse', x: x.W / 2 - phoneW * 0.95, y: phoneTop + phoneH * 0.12, w: phoneW * 1.9, h: phoneW * 1.9, fill: BRAND.petroleum, opacity: 0.35 }),
        imageLayer({
          name: 'Captura real',
          role: 'screenshot',
          frame: 'phone',
          shadow: true,
          x: x.W / 2 - phoneW / 2,
          y: phoneTop,
          w: phoneW,
          h: phoneH,
          placeholderLabel: 'Captura real (celular)',
        }),
      ];
      if (x.tall) layers.push(ctaPill(x.L, x.B - 70, x.cta, ctaS, BRAND.lime, BRAND.graphite, 'center', x.CW));
      return doc(x.fmt, background({ color: '#1B2226', color2: '#22383A', type: 'gradient', angle: 180, pattern: 'none' }), layers, 'telefono');
    },
  },
  {
    id: 'demo',
    name: 'Invitación a la demo',
    description: 'Marfil con la mascota, CTA y WhatsApp bien visibles.',
    bestFor: ['story', 'post', 'portrait'],
    swatch: [BRAND.ivory, BRAND.petroleum],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(100 * x.k);
      const bodyS = Math.round(40 * x.k);
      // The mascot logo file is 392 px wide: keep it at (or below) its native size.
      const mascotH = Math.min(299, Math.round((x.tall ? 300 : 230) * x.k));
      const mascotW = Math.round(mascotH * LOGOS.mascot.aspect);
      const headY = x.T + mascotH + Math.round(70 * x.k);
      const headText = c.headline || x.cta;
      const headH = estimateHeight(headText, x.CW, hs, 1.03, 0.56);
      const waS = Math.round(40 * x.k);
      const layers: Layer[] = [
        logoLayer('mascot', x.W / 2 - mascotW / 2, x.T, mascotH),
        textLayer({
          name: 'Titular',
          text: headText,
          x: x.L,
          y: headY,
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.03,
          letterSpacing: -0.03,
          align: 'center',
          color: BRAND.graphite,
          accentColor: BRAND.petroleum,
        }),
      ];
      if (c.body) {
        layers.push(
          textLayer({ name: 'Texto', text: c.body, x: x.L + 30, y: headY + headH + 44 * x.k, w: x.CW - 60, size: bodyS, lineHeight: 1.38, align: 'center', color: BRAND.muted }),
        );
      }
      layers.push(
        textLayer({
          name: 'Etiqueta WhatsApp',
          text: 'Escribinos por WhatsApp',
          x: x.L,
          y: x.B - waS * 3.3,
          w: x.CW,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          letterSpacing: 0.1,
          uppercase: true,
          align: 'center',
          color: BRAND.petroleum,
        }),
        ctaPill(x.L, x.B - waS * 1.6, x.wa, waS, BRAND.graphite, BRAND.lime, 'center', x.CW),
      );
      (layers[layers.length - 1] as TextLayer).font = 'plexmono';
      return doc(x.fmt, background({ color: BRAND.ivory, color2: BRAND.white, type: 'gradient', angle: 180, pattern: 'dots', patternColor: BRAND.graphite, patternOpacity: 0.05 }), layers, 'demo');
    },
  },
  {
    id: 'promo',
    name: 'Promoción',
    description: 'Grafito y banda lima. Solo con datos reales de la promo.',
    bestFor: ['story', 'post', 'portrait'],
    swatch: [BRAND.graphite, BRAND.lime],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(96 * x.k);
      const hlS = Math.round(120 * x.k);
      const bodyS = Math.round(34 * x.k);
      const ctaS = Math.round(34 * x.k);
      const logoH = Math.round(46 * x.k);
      const headY = x.T + Math.round(80 * x.k);
      const headH = estimateHeight(c.headline, x.CW, hs, 1.04, 0.56);
      const bandY = headY + headH + Math.round(70 * x.k);
      const hlText = c.highlight || '[Beneficio de la promo]';
      const bandH = estimateHeight(hlText, x.CW - 80, hlS, 1.0, 0.56) + 110 * x.k;
      const layers: Layer[] = [
        textLayer({
          name: 'Etiqueta',
          text: c.kicker || 'Promoción',
          x: x.L,
          y: x.T,
          w: x.CW,
          font: 'plexmono',
          weight: 600,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          letterSpacing: 0.14,
          uppercase: true,
          color: BRAND.lime,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: headY,
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.04,
          letterSpacing: -0.03,
          color: BRAND.ivory,
          accentColor: BRAND.lime,
        }),
        shapeLayer({ name: 'Banda lima', x: 0, y: bandY, w: x.W, h: bandH, fill: BRAND.lime }),
        textLayer({
          name: 'Beneficio',
          text: hlText,
          x: x.L,
          y: bandY + 55 * x.k,
          w: x.CW,
          font: 'manrope',
          weight: 800,
          size: hlS,
          lineHeight: 1.0,
          letterSpacing: -0.04,
          color: BRAND.graphite,
          accentColor: BRAND.petroleum,
        }),
        textLayer({
          name: 'Condiciones',
          text: c.body || '[Condiciones y vigencia]',
          x: x.L,
          y: bandY + bandH + 50 * x.k,
          w: x.CW,
          size: bodyS,
          lineHeight: 1.4,
          color: '#B9C1C7',
        }),
      ];
      if (x.tall) layers.push(ctaPill(x.L + ctaS * 0.95, x.B - 160, x.cta, ctaS, BRAND.lime, BRAND.graphite));
      layers.push(...logoChip(x.L, x.B - logoH * 1.6, logoH));
      layers.push(
        textLayer({
          name: 'WhatsApp',
          text: x.wa,
          x: x.L + logoH * 4.4,
          y: x.B - logoH * 1.6 + logoH * 0.8 - 16,
          w: x.R - x.L - logoH * 4.4,
          font: 'plexmono',
          weight: 500,
          size: Math.round(28 * Math.max(x.k, 0.85)),
          align: 'right',
          color: BRAND.ivory,
        }),
      );
      return doc(x.fmt, background({ color: BRAND.graphite, pattern: 'grid', patternColor: BRAND.ivory, patternOpacity: 0.04 }), layers, 'promo');
    },
  },
  {
    id: 'carrusel',
    name: 'Lámina de carrusel',
    description: 'Serie numerada con barra petróleo; misma estética en todas las láminas.',
    bestFor: ['portrait', 'post'],
    swatch: [BRAND.white, BRAND.petroleum],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const hs = Math.round(92 * x.k);
      const bodyS = Math.round(42 * x.k);
      const barW = 26;
      const headY = x.T + Math.round(150 * x.k);
      const headH = estimateHeight(c.headline, x.CW - 40, hs, 1.05, 0.56);
      const logoH = Math.round(44 * x.k);
      const layers: Layer[] = [
        shapeLayer({ name: 'Barra', x: 0, y: 0, w: barW, h: x.H, fill: BRAND.petroleum }),
        textLayer({
          name: 'Número',
          text: c.index || '01 / 06',
          x: x.L,
          y: x.T,
          w: x.CW,
          font: 'plexmono',
          weight: 600,
          size: Math.round(28 * Math.max(x.k, 0.85)),
          letterSpacing: 0.08,
          color: BRAND.petroleum,
        }),
        textLayer({
          name: 'Titular',
          text: c.headline,
          x: x.L,
          y: headY,
          w: x.CW - 40,
          font: 'manrope',
          weight: 800,
          size: hs,
          lineHeight: 1.05,
          letterSpacing: -0.03,
          color: BRAND.graphite,
          accentColor: BRAND.petroleum,
        }),
      ];
      if (c.body) {
        layers.push(
          textLayer({ name: 'Texto', text: c.body, x: x.L, y: headY + headH + 60 * x.k, w: x.CW - 40, size: bodyS, lineHeight: 1.42, color: BRAND.muted }),
        );
      }
      layers.push(
        logoLayer('wordmark', x.L, x.B - logoH, logoH),
        textLayer({
          name: 'Deslizá',
          text: c.kicker || 'Deslizá →',
          x: x.L,
          y: x.B - logoH / 2 - 18,
          w: x.CW,
          font: 'plexmono',
          weight: 500,
          size: Math.round(26 * Math.max(x.k, 0.85)),
          align: 'right',
          color: BRAND.graphite,
        }),
      );
      return doc(x.fmt, background({ color: BRAND.white, pattern: 'none' }), layers, 'carrusel');
    },
  },
  {
    id: 'blanco',
    name: 'En blanco',
    description: 'Fondo grafito y el logotipo: armá la pieza desde cero.',
    bestFor: ['story', 'post', 'portrait', 'reel-cover'],
    swatch: [BRAND.graphite, BRAND.graphite],
    build(fmtId, c, kit) {
      const x = ctx(fmtId, kit, c);
      const logoH = Math.round(48 * x.k);
      const layers: Layer[] = [...logoChip(x.L, x.B - logoH * 1.6, logoH)];
      if (c.headline) {
        layers.push(
          textLayer({
            name: 'Titular',
            text: c.headline,
            x: x.L,
            y: x.T + 40,
            w: x.CW,
            font: 'manrope',
            weight: 800,
            size: Math.round(96 * x.k),
            lineHeight: 1.04,
            letterSpacing: -0.03,
            color: BRAND.ivory,
            accentColor: BRAND.lime,
          }),
        );
      }
      return doc(x.fmt, background({ color: BRAND.graphite }), layers, 'blanco');
    },
  },
];

export const TEMPLATE_MAP: Record<string, TemplateDef> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export function buildFromTemplate(templateId: string, fmt: FormatId, content: TemplateContent, kit: BrandKit): DesignDoc {
  const t = TEMPLATE_MAP[templateId] ?? TEMPLATE_MAP.editorial;
  return t.build(fmt, content, kit);
}

/** Deep copy with fresh layer ids (used by "Duplicar"). */
export function cloneDoc(d: DesignDoc): DesignDoc {
  const copy = JSON.parse(JSON.stringify(d)) as DesignDoc;
  copy.layers = copy.layers.map((l) => ({ ...l, id: uid() }));
  return copy;
}
