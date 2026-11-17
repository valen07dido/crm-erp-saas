import type { AudienceKey, CampaignBrief, CreativePack, ReelScene } from './types';
import { AUDIENCE_MAP, DEFAULT_BRAND_KIT, FEATURE_MAP, FEATURES, formatWhatsapp, type Feature } from './brand';

/**
 * Copy engine ("motor") — works offline, no AI needed.
 *
 * Builds every text from the verified facts in brand.ts plus hand-written
 * phrase banks per creative angle. It never produces prices, discounts,
 * results, client names or testimonials; the only commercial terms that can
 * appear are the ones the team typed into the campaign's "propuesta".
 *
 * Words between *asterisks* are emphasis markers the design templates render
 * in the accent color.
 */

// ─── Seeded randomness (same seed → same output, "Otra variante" → new seed) ─

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

export function stripEmphasis(s: string): string {
  return s.replace(/\*/g, '');
}

// ─── Creative angles ────────────────────────────────────────────────────────

export interface Angle {
  key: string;
  name: string;
  idea: string;
  features: string[];
  headlines: string[];
  questions: string[];
  bodies: string[];
  visual: string[];
}

export const ANGLES: Angle[] = [
  {
    key: 'orden',
    name: 'Del cuaderno al sistema',
    idea: 'Nombrar el desorden de todos los días (cuadernos, planillas, papelitos) y mostrar que la información puede estar en un solo lugar.',
    features: ['gestion', 'ventas', 'clientes'],
    headlines: [
      'Tu negocio no entra en un *cuaderno*.',
      'Menos papelitos. Más *orden*.',
      'Todo {biz} en *un solo lugar*.',
      'Ventas, stock y caja, *sin planillas sueltas*.',
      'Si la información está en todos lados, *no la encontrás nunca*.',
      'Ordená {biz} *de una vez*.',
    ],
    questions: [
      '¿Seguís anotando las ventas en un *cuaderno*?',
      '¿Cuántas planillas usás para manejar {biz}?',
      '¿Dónde anotaste esa venta de ayer?',
    ],
    bodies: [
      'WALTI reúne productos, clientes, ventas, compras, caja y gastos en un mismo sistema. Dejás de buscar datos entre cuadernos, planillas y mensajes.',
      'Cuando cada cosa está anotada en un lugar distinto, ordenar {biz} lleva más tiempo del que debería. WALTI junta la gestión comercial en un solo sistema.',
    ],
    visual: [
      'Contraste real: un cuaderno de ventas sobre el mostrador y, al lado, una notebook con el panel de WALTI (foto propia).',
      'Tipografía grande sobre marfil: tachar "cuaderno", "planilla" y "papelito" y dejar "WALTI".',
    ],
  },
  {
    key: 'numeros',
    name: 'Tus números a la vista',
    idea: 'Las estadísticas que WALTI arma con los datos que ya cargás: ver cómo viene el negocio para decidir con información.',
    features: ['estadisticas', 'ventas', 'gastos'],
    headlines: [
      'Decidí con *tus números*, no a ojo.',
      '¿Cómo viene {biz} *este mes*?',
      'Tus ventas, *en estadísticas claras*.',
      'Los datos ya los tenés. *Ahora miralos*.',
      'Menos intuición, *más información*.',
    ],
    questions: [
      '¿Sabés qué productos se venden *más*?',
      '¿Cerrás el mes sabiendo *cómo te fue*?',
      '¿En qué se te va la plata cada mes?',
    ],
    bodies: [
      'WALTI arma estadísticas con las ventas y gastos que registrás, para que veas cómo viene el negocio y decidas con información.',
      'Cada venta y cada gasto que cargás en WALTI se convierte en información: estadísticas para entender cómo viene {biz}.',
    ],
    visual: [
      'Grabación real del Dashboard de WALTI con datos de demostración, con zoom lento sobre un gráfico.',
      'Captura real de las estadísticas en ventana de navegador sobre fondo grafito.',
    ],
  },
  {
    key: 'mostrador',
    name: 'El día a día del mostrador',
    idea: 'Punto de venta, caja y ventas registradas mientras atendés: la gestión no te frena.',
    features: ['pos', 'caja', 'ventas'],
    headlines: [
      'Cobrá, registrá y *seguí atendiendo*.',
      'El mostrador, *más ordenado*.',
      'Cada venta, *registrada*.',
      'Escaneás, cobrás *y queda anotado*.',
      'Al cerrar, *la caja está ahí*.',
    ],
    questions: [
      '¿Anotás cada venta *a mano* mientras atendés?',
      '¿Te cierra la caja al final del día?',
    ],
    bodies: [
      'Con el punto de venta de WALTI cobrás desde el mostrador, con lector de código de barras, y cada venta queda registrada.',
      'Las ventas del mostrador quedan registradas en WALTI y ves los movimientos de caja de tu negocio.',
    ],
    visual: [
      'Grabación real: lector de código de barras + pantalla del Punto de Venta de WALTI agregando el producto.',
      'Foto de mostrador real (propia) con la notebook mostrando la Caja.',
    ],
  },
  {
    key: 'vidriera',
    name: 'Tu vidriera online',
    idea: 'La página pública de productos personalizable: un link para mostrar lo que vendés.',
    features: ['tienda', 'productos', 'ofertas'],
    headlines: [
      'Tus productos, *en un link*.',
      'Una vidriera online *con tu marca*.',
      'Dejá de mandar fotos *una por una*.',
      'Mostrá lo que vendés, *ordenado*.',
    ],
    questions: [
      '¿Seguís mandando fotos y precios *uno por uno*?',
      '¿Tus clientes saben todo lo que vendés?',
    ],
    bodies: [
      'WALTI incluye una página pública con tus productos que podés personalizar con tu marca. La compartís y tus clientes ven lo que vendés.',
      'Con la página pública de WALTI mostrás tus productos y tus ofertas en un solo link, con los colores de {biz}.',
    ],
    visual: [
      'Grabación real de la página pública en un celular, scrolleando el catálogo.',
      'Captura real de la página pública dentro del marco de celular, fondo grafito.',
    ],
  },
  {
    key: 'control',
    name: 'Stock y compras en orden',
    idea: 'Productos, stock, compras y proveedores ordenados para saber qué tenés y qué compraste.',
    features: ['productos', 'compras', 'gastos'],
    headlines: [
      'Tu stock, *a la vista*.',
      'Stock, compras y proveedores, *en orden*.',
      'Sabé qué le compraste *a cada proveedor*.',
      'Productos y precios, *siempre actualizados*.',
    ],
    questions: [
      '¿Sabés cuánto stock tenés *ahora*?',
      '¿Dónde quedó la última compra al proveedor?',
    ],
    bodies: [
      'Cargás tus productos con precio y stock, registrás las compras y tenés a tus proveedores ordenados en WALTI.',
      'En WALTI tenés productos, stock, compras y proveedores en el mismo lugar, para que {biz} no dependa de la memoria de nadie.',
    ],
    visual: [
      'Grabación real del listado de Productos filtrando por categoría.',
      'Captura real de Compras en ventana de navegador, con una flecha lima señalando el proveedor.',
    ],
  },
  {
    key: 'demo',
    name: 'Conocelo en una demo',
    idea: 'Invitación directa, sin vueltas, a ver WALTI funcionando con alguien del equipo.',
    features: ['gestion'],
    headlines: [
      'Mirá WALTI *funcionando*.',
      'Te lo mostramos *en una demo*.',
      'Conocé WALTI *con alguien del equipo*.',
      'Antes de decidir, *miralo en acción*.',
    ],
    questions: [
      '¿Querés ver cómo funciona *antes de decidir*?',
      '¿Tenés dudas? *Te lo mostramos*.',
    ],
    bodies: [
      'Te mostramos WALTI en una demostración personalizada y respondemos tus dudas. Escribinos por WhatsApp y coordinamos.',
      'Pedí una demostración personalizada: vemos WALTI juntos, con foco en lo que necesita {biz}.',
    ],
    visual: [
      'Pieza tipográfica con la mascota de WALTI y el número de WhatsApp grande.',
      'Grabación real de alguien del equipo navegando WALTI en una notebook (sin audio de terceros).',
    ],
  },
];

export const ANGLE_MAP: Record<string, Angle> = Object.fromEntries(ANGLES.map((a) => [a.key, a]));

export const CTAS = [
  'Solicitá una demostración personalizada',
  'Escribinos por WhatsApp',
  'Pedí tu demo por WhatsApp',
  'Coordiná una demo con el equipo',
  'Consultanos y te mostramos WALTI',
];

// ─── Interpolation ──────────────────────────────────────────────────────────

interface Vars {
  biz: string;
  plural: string;
  wa: string;
  cta: string;
}

function vars(audience: AudienceKey, cta?: string, whatsapp?: string): Vars {
  const a = AUDIENCE_MAP[audience] ?? AUDIENCE_MAP.general;
  return {
    biz: a.biz,
    plural: a.plural,
    wa: formatWhatsapp(whatsapp || DEFAULT_BRAND_KIT.whatsapp),
    cta: cta || DEFAULT_BRAND_KIT.cta,
  };
}

function fill(s: string, v: Vars): string {
  const out = s.replace(/\{(biz|plural|wa|cta)\}/g, (_, k: keyof Vars) => v[k]);
  // "{biz} ..." at the start of a sentence → capitalized.
  return out.replace(/(^|[.!?]\s+|^\*)([a-záéíóú])/g, (m, pre: string, ch: string) => pre + ch.toUpperCase());
}

function featuresFor(angle: Angle, selected: string[]): Feature[] {
  const keys = selected.length ? selected : angle.features;
  return keys.map((k) => FEATURE_MAP[k]).filter(Boolean);
}

// ─── Single-piece copy (Copywriter) ─────────────────────────────────────────

export type CopyKind = 'titulares' | 'descripcion' | 'historia' | 'guion' | 'post' | 'cta' | 'whatsapp' | 'anuncio';

export const COPY_KINDS: { key: CopyKind; label: string; hint: string }[] = [
  { key: 'titulares', label: 'Titulares', hint: 'Frases cortas para piezas' },
  { key: 'post', label: 'Copy de publicación', hint: 'Caption para Instagram/Facebook' },
  { key: 'historia', label: 'Textos para historias', hint: 'Secuencia de 4–5 pantallas' },
  { key: 'guion', label: 'Guion de reel', hint: 'Escenas con tiempos y voz en off' },
  { key: 'descripcion', label: 'Descripciones', hint: 'Párrafo explicativo' },
  { key: 'anuncio', label: 'Texto publicitario', hint: 'Texto principal, título y descripción' },
  { key: 'cta', label: 'CTA', hint: 'Llamados a la acción' },
  { key: 'whatsapp', label: 'Mensajes de WhatsApp', hint: 'Para iniciar o responder' },
];

export interface CopyRequest {
  kind: CopyKind;
  audience: AudienceKey;
  /** Angle key, or 'mix' to combine all angles. */
  angle: string;
  features: string[];
  seed: number;
  count?: number;
  offer?: string;
  cta?: string;
  whatsapp?: string;
}

export interface CopyItem {
  title?: string;
  text: string;
  /** For quick "Crear pieza": a short headline + optional body. */
  headline?: string;
  body?: string;
}

function anglesFor(key: string): Angle[] {
  return key === 'mix' || !ANGLE_MAP[key] ? ANGLES : [ANGLE_MAP[key]];
}

function storyFrames(angle: Angle, feats: Feature[], v: Vars, rand: () => number, offer?: string): string[] {
  const q = shuffle(angle.questions, rand)[0];
  const f1 = feats[0] ?? FEATURES[0];
  const frames = [
    fill(q, v),
    `¿Te suena?\n${f1.pain.charAt(0).toUpperCase()}${f1.pain.slice(1)}.`,
    fill(shuffle(angle.headlines, rand)[0], v),
    ...feats.slice(0, 2).map((f) => `*${f.name}*\n${f.fact}`),
  ];
  if (offer) frames.push(offer);
  frames.push(`${v.cta}.\nWhatsApp ${v.wa}`);
  return frames;
}

function reelScript(angle: Angle, feats: Feature[], v: Vars, rand: () => number, long: boolean) {
  const hook = stripEmphasis(fill(shuffle(angle.questions, rand)[0], v));
  const scenes: ReelScene[] = [
    {
      time: '0–3 s',
      visual: 'Primer plano real del problema (cuaderno, planilla o mostrador), grabación propia.',
      onScreen: hook,
      voiceover: hook,
    },
  ];
  const used = feats.slice(0, long ? 3 : 2);
  const step = long ? 6 : 4;
  let t = 3;
  for (const f of used) {
    scenes.push({
      time: `${t}–${t + step} s`,
      visual: `Grabación real de pantalla: ${f.screen}. Sin efectos que muestren funciones que no existen.`,
      onScreen: f.name,
      voiceover: f.fact,
    });
    t += step;
  }
  scenes.push({
    time: `${t}–${t + 4} s`,
    visual: 'Logo de WALTI sobre grafito + número de WhatsApp.',
    onScreen: `${v.cta} · ${v.wa}`,
    voiceover: `${v.cta}. Escribinos por WhatsApp.`,
  });
  return { title: `${angle.name} (${t + 4} s)`, duration: `${t + 4} s`, hook, scenes, cta: v.cta };
}

function postCaption(angle: Angle, feats: Feature[], v: Vars, rand: () => number, offer?: string): string {
  const q = fill(shuffle(angle.questions, rand)[0], v);
  const body = fill(shuffle(angle.bodies, rand)[0], v);
  const bullets = feats.slice(0, 3).map((f) => `• ${f.name}: ${f.fact}`).join('\n');
  const parts = [stripEmphasis(q), body, bullets];
  if (offer) parts.push(offer);
  parts.push(`👉 ${v.cta}.\nWhatsApp: ${v.wa}`);
  parts.push(`#WALTI #gestióncomercial #${v.plural} #pymes`);
  return parts.join('\n\n');
}

function whatsappMessages(v: Vars, feats: Feature[]): string[] {
  const names = feats.filter((f) => f.key !== 'gestion').slice(0, 3).map((f) => f.name.toLowerCase());
  if (!names.length) names.push('productos', 'ventas', 'caja');
  return [
    `Hola, ¿cómo estás? Te escribo de WALTI. Es un sistema de gestión comercial para ${v.plural}: ${names.join(', ')} y más, en un mismo lugar. ¿Te gustaría que coordinemos una demostración personalizada?`,
    `¡Hola! Gracias por escribirnos. Te cuento: WALTI reúne productos, clientes, ventas, compras, caja y gastos en un solo sistema, y arma estadísticas con esos datos. ¿Qué día te queda cómodo para una demo?`,
    `Hola, quiero solicitar una demostración personalizada de WALTI.`,
  ];
}

export function generateCopy(req: CopyRequest): CopyItem[] {
  const rand = rng(req.seed);
  const v = vars(req.audience, req.cta, req.whatsapp);
  const angles = anglesFor(req.angle);
  const count = req.count ?? 6;
  const offer = req.offer?.trim();
  const items: CopyItem[] = [];

  const featsOf = (a: Angle) => featuresFor(a, req.features);

  switch (req.kind) {
    case 'titulares': {
      const pool = angles.flatMap((a) => a.headlines.map((h) => ({ a, h: fill(h, v) })));
      for (const { a, h } of shuffle(pool, rand).slice(0, count)) {
        items.push({ title: a.name, text: h, headline: h });
      }
      break;
    }
    case 'descripcion': {
      const pool = angles.flatMap((a) =>
        a.bodies.map((b) => ({ a, t: `${fill(b, v)} ${featsOf(a).slice(1, 2).map((f) => f.fact).join(' ')}`.trim() })),
      );
      for (const { a, t } of shuffle(pool, rand).slice(0, count)) {
        items.push({ title: a.name, text: t, headline: fill(a.headlines[0], v), body: t });
      }
      break;
    }
    case 'historia': {
      for (const a of shuffle(angles, rand).slice(0, Math.min(count, 3))) {
        const frames = storyFrames(a, featsOf(a), v, rand, offer);
        items.push({ title: a.name, text: frames.map((f, i) => `${i + 1}. ${stripEmphasis(f).replace(/\n/g, ' — ')}`).join('\n') });
      }
      break;
    }
    case 'guion': {
      for (const [i, a] of shuffle(angles, rand).slice(0, Math.min(count, 3)).entries()) {
        const r = reelScript(a, featsOf(a), v, rand, i % 2 === 1);
        items.push({
          title: r.title,
          text: r.scenes.map((s) => `[${s.time}] ${s.visual}\n  Texto: ${s.onScreen}\n  Voz: ${s.voiceover}`).join('\n'),
          headline: r.hook,
        });
      }
      break;
    }
    case 'post': {
      for (const a of shuffle(angles, rand).slice(0, Math.min(count, 4))) {
        items.push({ title: a.name, text: postCaption(a, featsOf(a), v, rand, offer), headline: fill(a.headlines[0], v) });
      }
      break;
    }
    case 'anuncio': {
      for (const a of shuffle(angles, rand).slice(0, Math.min(count, 4))) {
        const h = stripEmphasis(fill(shuffle(a.headlines, rand)[0], v));
        const primary = `${stripEmphasis(fill(shuffle(a.questions, rand)[0], v))} ${fill(shuffle(a.bodies, rand)[0], v)}${offer ? ` ${offer}` : ''}`;
        items.push({
          title: a.name,
          text: `Texto principal:\n${primary}\n\nTítulo:\n${h}\n\nDescripción:\n${v.cta}`,
          headline: h,
          body: primary,
        });
      }
      break;
    }
    case 'cta': {
      for (const c of shuffle(CTAS, rand).slice(0, count)) items.push({ text: c });
      break;
    }
    case 'whatsapp': {
      for (const m of whatsappMessages(v, featuresFor(angles[0], req.features))) items.push({ text: m });
      break;
    }
  }
  return items;
}

// ─── Full campaign pack ─────────────────────────────────────────────────────

export function pickAngles(brief: CampaignBrief, seed: number, n = 3): Angle[] {
  const rand = rng(seed);
  const scored = shuffle(ANGLES, rand).map((a) => ({
    a,
    score: a.key === 'demo' ? -1 : a.features.filter((f) => brief.features.includes(f)).length,
  }));
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, n).map((s) => s.a);
}

export function generatePack(name: string, brief: CampaignBrief, seed: number, kit?: { cta?: string; whatsapp?: string }): CreativePack {
  const rand = rng(seed);
  const v = vars(brief.audience, kit?.cta, kit?.whatsapp);
  const offer = brief.offer?.trim() || undefined;
  const angles = pickAngles(brief, seed);
  const feats = brief.features.map((k) => FEATURE_MAP[k]).filter(Boolean);
  const featsFor = (a: Angle) => (feats.length ? feats : featuresFor(a, []));
  const main = brief.mainMessage.trim();
  const audience = AUDIENCE_MAP[brief.audience] ?? AUDIENCE_MAP.general;

  const headlines = [
    ...(main ? [main] : []),
    ...angles.flatMap((a) => shuffle(a.headlines, rand).slice(0, 3).map((h) => fill(h, v))),
  ];

  return {
    source: 'motor',
    generatedAt: new Date().toISOString(),
    concept: {
      title: main ? stripEmphasis(main) : angles[0].name,
      summary: [
        `Campaña "${name}" para ${audience.label.toLowerCase()}.`,
        brief.objective ? `Objetivo: ${brief.objective}.` : '',
        feats.length ? `Foco en ${feats.map((f) => f.name.toLowerCase()).join(', ')}.` : '',
        `Se trabaja desde ${angles.length} enfoques para no repetir el mismo mensaje: ${angles.map((a) => a.name).join(', ')}.`,
        offer ? `Propuesta comercial (tal como la cargó el equipo): ${offer}.` : 'Sin propuesta comercial cargada: las piezas no mencionan precios ni descuentos.',
        `Todas las piezas cierran con "${v.cta}".`,
      ]
        .filter(Boolean)
        .join(' '),
    },
    angles: angles.map((a) => ({ key: a.key, name: a.name, idea: a.idea })),
    headlines,
    copies: angles.map((a) => ({ angle: a.name, text: postCaption(a, featsFor(a), v, rand, offer) })),
    stories: angles.map((a) => ({ title: a.name, frames: storyFrames(a, featsFor(a), v, rand, offer) })),
    carousels: angles.slice(0, 2).map((a) => {
      const fs = featsFor(a).slice(0, 4);
      return {
        title: a.name,
        slides: [
          { title: fill(shuffle(a.headlines, rand)[0], v), body: '' },
          ...fs.map((f) => ({ title: f.name, body: f.fact })),
          ...(offer ? [{ title: 'Propuesta', body: offer }] : []),
          { title: v.cta, body: `Escribinos por WhatsApp: ${v.wa}` },
        ],
      };
    }),
    reels: angles.slice(0, 2).map((a, i) => reelScript(a, featsFor(a), v, rand, i === 1)),
    visualIdeas: angles.flatMap((a) => a.visual),
    ctas: shuffle(CTAS, rand).slice(0, 4),
    whatsapp: whatsappMessages(v, feats.length ? feats : FEATURES.slice(0, 3)),
  };
}
