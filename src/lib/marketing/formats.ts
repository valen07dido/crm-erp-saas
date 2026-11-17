import type { FormatId } from './types';

export interface FormatSpec {
  id: FormatId;
  label: string;
  short: string;
  width: number;
  height: number;
  /** Area where text/logos/CTAs stay visible once Instagram draws its own UI or crops the grid. */
  safe: { top: number; right: number; bottom: number; left: number };
  safeNote: string;
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  story: {
    id: 'story',
    label: 'Instagram Story',
    short: 'Story',
    width: 1080,
    height: 1920,
    safe: { top: 250, right: 72, bottom: 340, left: 72 },
    safeNote: 'Arriba (250 px) queda la barra de perfil y abajo (340 px) la caja de respuesta.',
  },
  post: {
    id: 'post',
    label: 'Instagram Post',
    short: 'Post',
    width: 1080,
    height: 1080,
    safe: { top: 72, right: 72, bottom: 72, left: 72 },
    safeNote: 'Margen de 72 px para que nada quede pegado al borde en el feed.',
  },
  portrait: {
    id: 'portrait',
    label: 'Instagram Portrait',
    short: 'Portrait',
    width: 1080,
    height: 1350,
    safe: { top: 72, right: 84, bottom: 72, left: 84 },
    safeNote: 'La grilla del perfil recorta los costados: dejá 84 px a cada lado.',
  },
  'reel-cover': {
    id: 'reel-cover',
    label: 'Portada de Reel',
    short: 'Reel cover',
    width: 1080,
    height: 1920,
    safe: { top: 240, right: 72, bottom: 420, left: 72 },
    safeNote: 'La grilla muestra el centro 3:4; abajo van el texto y los botones del reel.',
  },
};

export const FORMAT_LIST = Object.values(FORMATS);

export function isFormatId(v: unknown): v is FormatId {
  return typeof v === 'string' && v in FORMATS;
}
