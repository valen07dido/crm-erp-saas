import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { AUDIENCE_MAP, DEFAULT_BRAND_KIT, FEATURES, formatWhatsapp } from '@/lib/marketing/brand';
import { ANGLE_MAP, COPY_KINDS } from '@/lib/marketing/copy';
import { briefSchema } from '@/lib/marketing/validation';
import { findRiskyClaims } from '@/lib/marketing/claims';

/**
 * Optional AI copy generation for Marketing Studio.
 *
 * The API key only lives on the server (ANTHROPIC_API_KEY); the Studio works
 * fully without it using the offline copy engine (src/lib/marketing/copy.ts).
 * The model only writes text — designs are always edited by hand.
 */

export const config = { maxDuration: 120 };

const MODEL = 'claude-opus-5-5';

const requestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('copy'),
    kind: z.enum(['titulares', 'descripcion', 'historia', 'guion', 'post', 'cta', 'whatsapp', 'anuncio']),
    audience: z.enum(['general', 'minorista', 'distribuidora', 'emprendedor', 'pyme']),
    angle: z.string().max(40),
    features: z.array(z.string().max(40)).max(20),
    offer: z.string().max(500).default(''),
    count: z.number().int().min(1).max(10).default(6),
    instructions: z.string().max(600).default(''),
  }),
  z.object({
    task: z.literal('pack'),
    name: z.string().max(120),
    brief: briefSchema,
  }),
]);

function systemPrompt(cta: string, whatsapp: string): string {
  const facts = FEATURES.map(
    (f) => `- ${f.name}: ${f.fact}${f.needsConfirmation ? ' (pendiente de confirmar: usalo solo si la campaña lo pide explícitamente)' : ''}`,
  ).join('\n');
  return `Sos el equipo de contenidos de WALTI, un sistema de gestión comercial (CRM + ERP) para pymes y comercios de Argentina. Escribís piezas para Instagram, Facebook y WhatsApp.

Lo único que sabemos de WALTI y podés afirmar:
${facts}
- WALTI organiza la información y genera estadísticas. No ejecuta tareas por su cuenta: nunca lo describas como algo que "hace todo solo", que automatiza decisiones o que usa inteligencia artificial.

Datos de contacto: WhatsApp ${whatsapp}. CTA principal: "${cta}".

Cómo escribir:
- Español rioplatense natural, con voseo ("tenés", "registrás"). Cercano, profesional, claro y comercial, sin exagerar.
- No inventes precios, descuentos, cupos, plazos, clientes, testimonios, cifras, resultados, premios ni integraciones con otros sistemas. Si la campaña trae una propuesta comercial, usala tal cual está escrita; si no trae, no menciones condiciones comerciales.
- Nada de promesas sin sustento ("vas a duplicar tus ventas", "garantizado").
- Para reels, las escenas muestran grabaciones reales de la pantalla de WALTI; no describas animaciones de funciones que no existen ni uses música o material de terceros.
- En titulares podés marcar una o dos palabras clave entre *asteriscos* para resaltarlas en el diseño.`;
}

const STR = { type: 'string' } as const;
const strArr = { type: 'array', items: STR } as const;
function obj(properties: Record<string, unknown>) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

const COPY_SCHEMA = obj({
  items: { type: 'array', items: obj({ title: STR, text: STR, headline: STR }) },
});

const PACK_SCHEMA = obj({
  concept: obj({ title: STR, summary: STR }),
  angles: { type: 'array', items: obj({ key: STR, name: STR, idea: STR }) },
  headlines: strArr,
  copies: { type: 'array', items: obj({ angle: STR, text: STR }) },
  stories: { type: 'array', items: obj({ title: STR, frames: strArr }) },
  carousels: { type: 'array', items: obj({ title: STR, slides: { type: 'array', items: obj({ title: STR, body: STR }) } }) },
  reels: {
    type: 'array',
    items: obj({
      title: STR,
      duration: STR,
      hook: STR,
      scenes: { type: 'array', items: obj({ time: STR, visual: STR, onScreen: STR, voiceover: STR }) },
      cta: STR,
    }),
  },
  visualIdeas: strArr,
  ctas: strArr,
  whatsapp: strArr,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;

  const enabled = Boolean(process.env.ANTHROPIC_API_KEY);
  if (req.method === 'GET') return res.status(200).json({ enabled, model: MODEL });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!enabled) {
    return res.status(400).json({ error: 'La IA no está configurada. Agregá ANTHROPIC_API_KEY en las variables del servidor.' });
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Pedido inválido' });
  const input = parsed.data;

  const kitCta = typeof req.body?.cta === 'string' && req.body.cta ? String(req.body.cta).slice(0, 120) : DEFAULT_BRAND_KIT.cta;
  const kitWa = formatWhatsapp(typeof req.body?.whatsapp === 'string' && req.body.whatsapp ? req.body.whatsapp : DEFAULT_BRAND_KIT.whatsapp);

  let userPrompt: string;
  let schema: object;
  let offer = '';
  if (input.task === 'copy') {
    const kind = COPY_KINDS.find((k) => k.key === input.kind)!;
    const angle = ANGLE_MAP[input.angle];
    offer = input.offer;
    userPrompt = [
      `Escribí ${input.count} variantes de: ${kind.label} (${kind.hint}).`,
      `Público: ${AUDIENCE_MAP[input.audience].label}.`,
      angle ? `Enfoque creativo: ${angle.name}. ${angle.idea}` : 'Mezclá distintos enfoques creativos para que las variantes no repitan el mismo mensaje.',
      input.features.length ? `Funcionalidades a destacar: ${input.features.join(', ')}.` : '',
      input.offer ? `Propuesta comercial (usala textual): ${input.offer}` : 'No hay propuesta comercial: no menciones precios ni condiciones.',
      input.instructions ? `Indicaciones del equipo: ${input.instructions}` : '',
      'En cada item: "title" es una etiqueta corta del enfoque, "text" es el texto completo listo para copiar y "headline" un titular corto para usar en una pieza gráfica.',
    ]
      .filter(Boolean)
      .join('\n');
    schema = COPY_SCHEMA;
  } else {
    const b = input.brief;
    offer = b.offer;
    userPrompt = [
      `Armá el paquete creativo de la campaña "${input.name}".`,
      `Objetivo: ${b.objective || '(sin especificar)'}.`,
      `Público: ${AUDIENCE_MAP[b.audience].label}. ${b.audienceNotes}`,
      `Mensaje principal: ${b.mainMessage || '(proponelo vos)'}.`,
      b.offer ? `Propuesta comercial (usala textual): ${b.offer}` : 'No hay propuesta comercial: no menciones precios ni condiciones.',
      `Canales: ${b.channels.join(', ') || 'Instagram'}. Vigencia: ${b.startDate || '?'} a ${b.endDate || '?'}.`,
      b.features.length ? `Funcionalidades foco: ${b.features.join(', ')}.` : '',
      `Piezas pedidas: ${b.pieces.stories} historias, ${b.pieces.posts} publicaciones, ${b.pieces.carousels} carruseles, ${b.pieces.reels} reels.`,
      'Proponé 3 enfoques creativos distintos, de 6 a 9 titulares, un copy por enfoque, una secuencia de historias por enfoque (4 a 6 pantallas), 1 o 2 carruseles (5 a 7 láminas), 1 o 2 guiones de reel de 15 a 30 segundos, ideas visuales, CTAs y mensajes de WhatsApp.',
    ]
      .filter(Boolean)
      .join('\n');
    schema = PACK_SCHEMA;
  }

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system: systemPrompt(kitCta, kitWa),
      messages: [{ role: 'user', content: userPrompt }],
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'El modelo no generó contenido para este pedido. Probá reformularlo.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'La respuesta quedó incompleta. Probá pedir menos variantes.' });
    }
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const data = JSON.parse(text);
    const warnings = findRiskyClaims(text, offer);
    if (input.task === 'pack') {
      return res.status(200).json({ pack: { ...data, source: 'ia', generatedAt: new Date().toISOString() }, warnings });
    }
    return res.status(200).json({ items: data.items, warnings });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Demasiados pedidos a la IA. Esperá un momento.' });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'La clave de IA del servidor no es válida.' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Marketing AI error', error.status, error.message);
      return res.status(502).json({ error: 'El servicio de IA no respondió. Usá el motor de textos mientras tanto.' });
    }
    console.error('Marketing AI error', error);
    return res.status(500).json({ error: 'No se pudo generar el contenido con IA.' });
  }
}
