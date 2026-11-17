/**
 * Safety net for generated copy (mainly AI output): flags phrases that could
 * be an invented price, discount, result, testimonial or capability. It does
 * not edit anything — the Studio shows the warnings so a person decides.
 */

const RULES: { re: RegExp; reason: string }[] = [
  { re: /(?:US\$|USD|ARS|\$)\s?\d[\d.,]*/i, reason: 'Precio o monto' },
  { re: /\d+\s?%/, reason: 'Porcentaje' },
  { re: /\b(gratis|sin costo|bonificad[oa]s?)\b/i, reason: 'Beneficio comercial' },
  { re: /\b(cupos?|últimos lugares|solo por hoy|hasta agotar)\b/i, reason: 'Cupo o urgencia' },
  { re: /\b(garantiza(?:do|mos)?|asegura(?:do|mos)?|100\s?%)\b/i, reason: 'Promesa' },
  { re: /\b(automáticamente|automatiza|lo hace solo|hace todo por vos|inteligencia artificial|con IA)\b/i, reason: 'Capacidad no verificada' },
  { re: /\b(duplic|triplic)\w*/i, reason: 'Resultado' },
  { re: /\b(integra(?:do|ción) con|se conecta con|mercado ?pago|afip|arca|tienda ?nube|shopify)\b/i, reason: 'Integración' },
  { re: /\b(más de \d+|miles de|cientos de)\s+(clientes|comercios|negocios|usuarios)/i, reason: 'Dato comercial' },
  { re: /[“"]\s?[A-ZÁÉÍÓÚ][^"”]{12,}["”]\s?[—-]\s?[A-ZÁÉÍÓÚ]/, reason: 'Posible testimonio' },
];

export interface ClaimWarning {
  phrase: string;
  reason: string;
}

/** `allowed` = text the team typed themselves (e.g. the campaign's offer); matches inside it are fine. */
export function findRiskyClaims(text: string, allowed = ''): ClaimWarning[] {
  const out: ClaimWarning[] = [];
  const allowedLc = allowed.toLowerCase();
  for (const { re, reason } of RULES) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      const phrase = m[0].trim();
      if (allowedLc && allowedLc.includes(phrase.toLowerCase())) continue;
      if (!out.some((w) => w.phrase === phrase)) out.push({ phrase, reason });
    }
  }
  return out;
}

export function packText(pack: unknown): string {
  return JSON.stringify(pack ?? '');
}
