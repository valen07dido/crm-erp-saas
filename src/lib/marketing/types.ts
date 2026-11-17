// ─── Design documents ───────────────────────────────────────────────────────
// Every coordinate is in the design's own pixel space (e.g. 1080×1920), so the
// same document renders identically in the editor preview (scaled down) and in
// the exported file (1:1). See render.ts.

export type FormatId = 'story' | 'post' | 'portrait' | 'reel-cover';

export type FontKey = 'manrope' | 'dmsans' | 'plexmono' | 'instrument' | 'spacegrotesk';

export interface LayerBase {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  /** For text layers this is recomputed from the content on every render. */
  h: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
}

export interface TextHighlight {
  color: string;
  padX: number;
  padY: number;
  radius: number;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  /** Words wrapped in *asterisks* are drawn in `accentColor`. */
  text: string;
  font: FontKey;
  weight: number;
  size: number;
  lineHeight: number;
  /** In em (0.02 = 2% of font size). */
  letterSpacing: number;
  color: string;
  accentColor: string;
  align: 'left' | 'center' | 'right';
  uppercase?: boolean;
  /** Draws a solid band behind each line (marker / pill effect). */
  highlight?: TextHighlight | null;
}

export type ImageFrame = 'none' | 'browser' | 'phone';

export interface ImageLayer extends LayerBase {
  type: 'image';
  /** Empty string = placeholder waiting for a real image/screenshot. */
  src: string;
  role: 'image' | 'logo' | 'screenshot';
  fit: 'cover' | 'contain';
  radius: number;
  frame: ImageFrame;
  shadow: boolean;
  /** Natural width/height ratio; logos keep it when resized so they never deform. */
  aspect?: number;
  placeholderLabel?: string;
}

export interface ShapeLayer extends LayerBase {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill: string;
  stroke?: string;
  strokeWidth: number;
  radius: number;
}

export type Layer = TextLayer | ImageLayer | ShapeLayer;

export type BackgroundPattern = 'none' | 'grid' | 'dots' | 'lines';

export interface Background {
  type: 'solid' | 'gradient';
  color: string;
  color2: string;
  /** Degrees, 0 = top→bottom. */
  angle: number;
  imageUrl?: string;
  imageOpacity?: number;
  pattern: BackgroundPattern;
  patternColor: string;
  patternOpacity: number;
}

export interface DesignDoc {
  version: 1;
  format: FormatId;
  width: number;
  height: number;
  background: Background;
  layers: Layer[];
  templateId?: string;
}

export type DesignStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';

export interface DesignRecord {
  id: string;
  name: string;
  format: FormatId;
  status: DesignStatus;
  doc: DesignDoc;
  thumbnail: string | null;
  campaignId: string | null;
  campaign?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type DesignSummary = Omit<DesignRecord, 'doc'>;

// ─── Brand kit & assets ─────────────────────────────────────────────────────

export interface BrandColor {
  name: string;
  hex: string;
  role: string;
}

export interface BrandKit {
  colors: BrandColor[];
  whatsapp: string;
  cta: string;
  /** Optional, only shown in pieces if filled in — never invented. */
  instagram: string;
  website: string;
  tagline: string;
}

export type AssetCategory = 'logo' | 'screenshot' | 'photo' | 'video' | 'icon' | 'template' | 'other';

export interface AssetRecord {
  id: string;
  name: string;
  category: AssetCategory;
  url: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  tags: string[];
  createdAt: string;
  builtIn?: boolean;
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export type AudienceKey = 'general' | 'minorista' | 'distribuidora' | 'emprendedor' | 'pyme';

export interface CampaignBrief {
  objective: string;
  audience: AudienceKey;
  audienceNotes: string;
  mainMessage: string;
  /** Free text written by the team. Never filled in automatically. */
  offer: string;
  channels: string[];
  startDate: string;
  endDate: string;
  /** Feature keys from facts.ts this campaign focuses on. */
  features: string[];
  pieces: { stories: number; posts: number; carousels: number; reels: number };
}

export interface ReelScene {
  time: string;
  visual: string;
  onScreen: string;
  voiceover: string;
}

export interface CreativePack {
  source: 'motor' | 'ia';
  generatedAt: string;
  concept: { title: string; summary: string };
  angles: { key: string; name: string; idea: string }[];
  headlines: string[];
  copies: { angle: string; text: string }[];
  stories: { title: string; frames: string[] }[];
  carousels: { title: string; slides: { title: string; body: string }[] }[];
  reels: { title: string; duration: string; hook: string; scenes: ReelScene[]; cta: string }[];
  visualIdeas: string[];
  ctas: string[];
  whatsapp: string[];
}

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED';

export interface CampaignRecord {
  id: string;
  name: string;
  status: CampaignStatus;
  brief: CampaignBrief;
  content: CreativePack | null;
  createdAt: string;
  updatedAt: string;
  designs?: DesignSummary[];
}
