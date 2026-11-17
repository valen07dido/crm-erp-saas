import type { Background, DesignDoc, ImageLayer, Layer, ShapeLayer, TextLayer } from './types';
import { clampWeight, ensureDocFonts, fontFamily } from './fonts';

/**
 * WALTI Marketing Studio renderer.
 *
 * One Canvas 2D renderer draws a DesignDoc for both the editor preview
 * (scaled down) and the exported PNG/JPG/PDF (1:1, 1080 px wide), so what you
 * see while editing is exactly what gets exported. All drawing happens in the
 * design's own pixel space; `scale` is applied once as a transform.
 */

// ─── Images ─────────────────────────────────────────────────────────────────

type CacheEntry = { status: 'loading' | 'ok' | 'error'; img: HTMLImageElement; promise: Promise<HTMLImageElement | null> };
const imageCache = new Map<string, CacheEntry>();

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const hit = imageCache.get(src);
  if (hit) return hit.promise;
  const img = new Image();
  // Required so drawing Cloudinary images doesn't taint the canvas (which
  // would block toBlob on export). Same-origin files are unaffected.
  img.crossOrigin = 'anonymous';
  const entry: CacheEntry = {
    status: 'loading',
    img,
    promise: new Promise((resolve) => {
      img.onload = () => {
        entry.status = 'ok';
        resolve(img);
      };
      img.onerror = () => {
        entry.status = 'error';
        resolve(null);
      };
    }),
  };
  imageCache.set(src, entry);
  img.src = src;
  return entry.promise;
}

function readyImage(src: string | undefined): HTMLImageElement | null {
  if (!src) return null;
  const e = imageCache.get(src);
  return e && e.status === 'ok' ? e.img : null;
}

export function docImageSources(doc: DesignDoc): string[] {
  const out = new Set<string>();
  if (doc.background.imageUrl) out.add(doc.background.imageUrl);
  for (const l of doc.layers) if (l.type === 'image' && l.src) out.add(l.src);
  return Array.from(out);
}

/** Loads every image and font a document needs. Safe to call repeatedly. */
export async function preloadDoc(doc: DesignDoc): Promise<void> {
  await Promise.all([ensureDocFonts(doc), ...docImageSources(doc).map(loadImage)]);
}

// ─── Geometry helpers ───────────────────────────────────────────────────────

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: 'cover' | 'contain',
  alignTop = false,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  const dx = x + (w - dw) / 2;
  const dy = alignTop && fit === 'cover' ? y : y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ─── Background ─────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, W: number, H: number) {
  if (bg.type === 'gradient') {
    const a = (bg.angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = Math.cos(a);
    const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
    const g = ctx.createLinearGradient(W / 2 - dx * half, H / 2 - dy * half, W / 2 + dx * half, H / 2 + dy * half);
    g.addColorStop(0, bg.color);
    g.addColorStop(1, bg.color2);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, W, H);

  const img = readyImage(bg.imageUrl);
  if (img) {
    ctx.save();
    ctx.globalAlpha = bg.imageOpacity ?? 1;
    drawImageFit(ctx, img, 0, 0, W, H, 'cover');
    ctx.restore();
  }

  if (bg.pattern !== 'none' && bg.patternOpacity > 0) {
    ctx.save();
    ctx.strokeStyle = hexToRgba(bg.patternColor, bg.patternOpacity);
    ctx.fillStyle = hexToRgba(bg.patternColor, bg.patternOpacity);
    ctx.lineWidth = 1.5;
    if (bg.pattern === 'grid') {
      const step = 90;
      ctx.beginPath();
      for (let x = step; x < W; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = step; y < H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    } else if (bg.pattern === 'dots') {
      const step = 54;
      for (let x = step / 2; x < W; x += step) {
        for (let y = step / 2; y < H; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (bg.pattern === 'lines') {
      const step = 46;
      ctx.beginPath();
      for (let k = -H; k < W; k += step) {
        ctx.moveTo(k, H);
        ctx.lineTo(k + H, 0);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ─── Text ───────────────────────────────────────────────────────────────────

interface Run {
  text: string;
  accent: boolean;
  width: number;
}
interface Word {
  runs: Run[];
  width: number;
}
interface Line {
  words: Word[];
  width: number;
}
export interface TextLayout {
  lines: Line[];
  lineHeight: number;
  height: number;
  spaceWidth: number;
}

function setTextFont(ctx: CanvasRenderingContext2D, l: TextLayer) {
  ctx.font = `${clampWeight(l.font, l.weight)} ${l.size}px ${fontFamily(l.font)}`;
  const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in anyCtx) anyCtx.letterSpacing = `${(l.letterSpacing || 0) * l.size}px`;
}

/** Splits a paragraph into words, tracking *accent* runs (a word can mix both). */
function tokenize(paragraph: string): { runs: { text: string; accent: boolean }[] }[] {
  const words: { runs: { text: string; accent: boolean }[] }[] = [];
  let accent = false;
  let cur = '';
  let word: { text: string; accent: boolean }[] = [];
  const flushRun = () => {
    if (cur) word.push({ text: cur, accent });
    cur = '';
  };
  const flushWord = () => {
    flushRun();
    if (word.length) words.push({ runs: word });
    word = [];
  };
  for (const ch of paragraph) {
    if (ch === '*') {
      flushRun();
      accent = !accent;
    } else if (ch === ' ' || ch === '\t') {
      flushWord();
    } else {
      cur += ch;
    }
  }
  flushWord();
  return words;
}

export function layoutText(ctx: CanvasRenderingContext2D, l: TextLayer): TextLayout {
  setTextFont(ctx, l);
  const raw = l.uppercase ? l.text.toUpperCase() : l.text;
  const spaceWidth = ctx.measureText(' ').width;
  const lines: Line[] = [];
  const maxW = Math.max(10, l.w);
  for (const para of raw.split('\n')) {
    const words: Word[] = tokenize(para).map((w) => {
      const runs = w.runs.map((r) => ({ ...r, width: ctx.measureText(r.text).width }));
      return { runs, width: runs.reduce((s, r) => s + r.width, 0) };
    });
    if (!words.length) {
      lines.push({ words: [], width: 0 });
      continue;
    }
    let line: Line = { words: [], width: 0 };
    for (const w of words) {
      const next = line.words.length ? line.width + spaceWidth + w.width : w.width;
      if (line.words.length && next > maxW) {
        lines.push(line);
        line = { words: [w], width: w.width };
      } else {
        line.words.push(w);
        line.width = next;
      }
    }
    lines.push(line);
  }
  const lineHeight = l.size * l.lineHeight;
  return { lines, lineHeight, height: Math.max(lineHeight, lines.length * lineHeight), spaceWidth };
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer): number {
  const layout = layoutText(ctx, l);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  layout.lines.forEach((line, i) => {
    const center = l.y + i * layout.lineHeight + layout.lineHeight / 2;
    const lx = l.align === 'center' ? l.x + (l.w - line.width) / 2 : l.align === 'right' ? l.x + l.w - line.width : l.x;
    if (l.highlight && line.width > 0) {
      const hl = l.highlight;
      ctx.fillStyle = hl.color;
      roundRectPath(ctx, lx - hl.padX, center - l.size * 0.56 - hl.padY, line.width + hl.padX * 2, l.size * 1.12 + hl.padY * 2, hl.radius);
      ctx.fill();
    }
    const baseline = center + l.size * 0.35;
    let cx = lx;
    for (const w of line.words) {
      for (const r of w.runs) {
        ctx.fillStyle = r.accent ? l.accentColor : l.color;
        ctx.fillText(r.text, cx, baseline);
        cx += r.width;
      }
      cx += layout.spaceWidth;
    }
  });
  return layout.height;
}

// ─── Images & shapes ────────────────────────────────────────────────────────

function drawPlaceholder(ctx: CanvasRenderingContext2D, l: ImageLayer, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(128, 138, 146, 0.18)';
  roundRectPath(ctx, x, y, w, h, Math.max(12, l.radius));
  ctx.fill();
  ctx.setLineDash([18, 14]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(128, 138, 146, 0.75)';
  ctx.stroke();
  ctx.setLineDash([]);
  const size = Math.max(22, Math.min(40, w / 14));
  ctx.font = `500 ${size}px ${fontFamily('dmsans')}`;
  ctx.fillStyle = 'rgba(128, 138, 146, 1)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(l.placeholderLabel || 'Elegí una imagen', x + w / 2, y + h / 2, w - 40);
  ctx.restore();
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer): boolean {
  const img = readyImage(l.src);
  const { x, y, w, h } = l;
  const alignTop = l.role === 'screenshot';
  const fit = l.role === 'logo' ? 'contain' : l.fit;

  const shadowOn = () => {
    if (!l.shadow) return;
    ctx.shadowColor = 'rgba(10, 14, 18, 0.35)';
    ctx.shadowBlur = Math.max(30, w * 0.06);
    ctx.shadowOffsetY = Math.max(14, w * 0.025);
  };
  const shadowOff = () => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  if (l.frame === 'browser') {
    const r = Math.max(l.radius, 18);
    const bar = Math.max(34, w * 0.05);
    ctx.save();
    shadowOn();
    ctx.fillStyle = '#FFFFFF';
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    shadowOff();
    ctx.clip();
    ctx.fillStyle = '#ECE7DC';
    ctx.fillRect(x, y, w, bar);
    const dot = bar * 0.17;
    ['#E0786C', '#E6BE5A', '#7FBF6A'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + bar * 0.62 + i * dot * 3.2, y + bar / 2, dot, 0, Math.PI * 2);
      ctx.fill();
    });
    if (img) drawImageFit(ctx, img, x, y + bar, w, h - bar, 'cover', true);
    else drawPlaceholder(ctx, l, x + 16, y + bar + 16, w - 32, h - bar - 32);
    ctx.restore();
    return !img;
  }

  if (l.frame === 'phone') {
    const r = w * 0.15;
    const bezel = w * 0.035;
    ctx.save();
    shadowOn();
    ctx.fillStyle = '#121519';
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    shadowOff();
    ctx.strokeStyle = '#3A4048';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.stroke();
    roundRectPath(ctx, x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, r - bezel);
    ctx.clip();
    ctx.fillStyle = '#F5F1E9';
    ctx.fillRect(x, y, w, h);
    if (img) drawImageFit(ctx, img, x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, 'cover', true);
    else drawPlaceholder(ctx, l, x + bezel + 12, y + bezel + 60, w - bezel * 2 - 24, h - bezel * 2 - 120);
    ctx.fillStyle = '#121519';
    const iw = w * 0.3;
    roundRectPath(ctx, x + (w - iw) / 2, y + bezel + w * 0.025, iw, w * 0.075, w * 0.04);
    ctx.fill();
    ctx.restore();
    return !img;
  }

  if (!img) {
    drawPlaceholder(ctx, l, x, y, w, h);
    return true;
  }
  ctx.save();
  if (fit === 'cover') {
    shadowOn();
    ctx.fillStyle = '#FFFFFF';
    roundRectPath(ctx, x, y, w, h, l.radius);
    ctx.fill();
    shadowOff();
    ctx.clip();
  } else if (l.radius > 0) {
    roundRectPath(ctx, x, y, w, h, l.radius);
    ctx.clip();
  }
  drawImageFit(ctx, img, x, y, w, h, fit, alignTop);
  ctx.restore();
  return false;
}

function drawShape(ctx: CanvasRenderingContext2D, l: ShapeLayer) {
  ctx.beginPath();
  if (l.shape === 'ellipse') {
    ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
  } else {
    roundRectPath(ctx, l.x, l.y, l.w, l.h, l.shape === 'line' ? l.h / 2 : l.radius);
  }
  if (l.fill && l.fill !== 'transparent') {
    ctx.fillStyle = l.fill;
    ctx.fill();
  }
  if (l.stroke && l.strokeWidth > 0) {
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = l.strokeWidth;
    ctx.stroke();
  }
}

// ─── Public entry point ─────────────────────────────────────────────────────

export interface RenderResult {
  /** Real height of each text layer (text boxes grow with their content). */
  textHeights: Record<string, number>;
  /** Image layers still showing a placeholder (no image chosen or failed to load). */
  placeholders: string[];
}

export function renderDoc(ctx: CanvasRenderingContext2D, doc: DesignDoc, scale = 1): RenderResult {
  const result: RenderResult = { textHeights: {}, placeholders: [] };
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawBackground(ctx, doc.background, doc.width, doc.height);

  for (const layer of doc.layers) {
    if (layer.hidden) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    const h = layer.type === 'text' ? layoutText(ctx, layer).height : layer.h;
    if (layer.rotation) {
      const cx = layer.x + layer.w / 2;
      const cy = layer.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    drawLayer(ctx, layer, result);
    ctx.restore();
  }
  ctx.restore();
  return result;
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, result: RenderResult) {
  if (layer.type === 'text') {
    result.textHeights[layer.id] = drawText(ctx, layer);
  } else if (layer.type === 'image') {
    if (drawImageLayer(ctx, layer)) result.placeholders.push(layer.id);
  } else {
    drawShape(ctx, layer);
  }
}

/** Renders a full-resolution (or scaled) copy of a document on a new canvas. */
export async function renderToCanvas(doc: DesignDoc, scale = 1): Promise<{ canvas: HTMLCanvasElement; result: RenderResult }> {
  await preloadDoc(doc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(doc.width * scale);
  canvas.height = Math.round(doc.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite dibujar en canvas');
  const result = renderDoc(ctx, doc, scale);
  return { canvas, result };
}
