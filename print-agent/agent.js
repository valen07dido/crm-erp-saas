/**
 * Walti — agente local de impresión silenciosa.
 *
 * Corre en la PC de la caja, escucha pedidos de impresión del POS por HTTP
 * (localhost) y los manda DIRECTO a la impresora de Windows (predeterminada,
 * o la que se configure) sin ningún diálogo de por medio.
 *
 * Uso:
 *   npm install
 *   npm start
 *
 * Variables de entorno opcionales:
 *   PRINT_AGENT_PORT    puerto HTTP local (default 9898)
 *   PRINT_AGENT_PRINTER nombre exacto de la impresora a usar (default: la
 *                       impresora predeterminada de Windows)
 */
const http = require('http');
const PDFDocument = require('pdfkit');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { print, getPrinters } = require('pdf-to-printer');

// Minimal .env loader (avoids pulling in the `dotenv` dependency for just
// two optional settings) — reads KEY=value lines next to this script.
// `pkg`'s compiled exe maps __dirname into a virtual snapshot, so when
// packaged we read next to the real executable instead (process.execPath).
function loadDotEnv() {
  const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;
  const envPath = path.join(baseDir, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const l = rawLine.trim();
    if (!l || l.startsWith('#')) continue;
    const eq = l.indexOf('=');
    if (eq === -1) continue;
    const key = l.slice(0, eq).trim();
    const value = l.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

const PORT = Number(process.env.PRINT_AGENT_PORT) || 9898;
const PRINTER_NAME = process.env.PRINT_AGENT_PRINTER || undefined;

const MM_TO_PT = 2.8346456693;
const mm = (v) => v * MM_TO_PT;
const lh = (size) => size * 1.3;

const FONT = 'Courier-Bold';
const SIZE_HEADER = 13;
const SIZE_META = 8;
const SIZE_NAME = 9;
const SIZE_DETAIL = 8;
const SIZE_TOTAL = 12;
const SIZE_PAYMENT = 9;
const SIZE_FOOTER = 8;

const PAYMENT_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

const GAP_SECTION = mm(1.5);
const HR_SPACE = 9; // matches drawHr's "+2 gap, 1pt line, +6 gap"

// NOTE: pdfkit auto-advances doc.y after every .text() call (even when an
// explicit y is passed), using ITS OWN font-metric line height — not our lh().
// Relying on that plus our own manual `doc.y += ...` double-counts the
// advance. Every helper below throws away whatever pdfkit computed and sets
// doc.y explicitly, so computeHeight()'s budget below is the only source of
// truth for vertical spacing (the two can never drift apart).
function computeHeight(ticket) {
  const margin = mm(2);
  let h = margin * 2;
  h += lh(SIZE_HEADER) + GAP_SECTION;
  const metaLineCount = 2 + (ticket.clientName ? 1 : 0);
  h += metaLineCount * lh(SIZE_META) + GAP_SECTION;
  h += HR_SPACE;
  for (const item of ticket.items || []) {
    h += lh(SIZE_NAME) + lh(SIZE_DETAIL);
  }
  h += HR_SPACE;
  h += lh(SIZE_TOTAL);
  let paymentRows = 0;
  if (ticket.paymentMethod) paymentRows++;
  if (ticket.cashReceived !== undefined && ticket.cashReceived !== null) paymentRows++;
  if (ticket.change !== undefined && ticket.change !== null && ticket.change > 0) paymentRows++;
  h += paymentRows * lh(SIZE_PAYMENT);
  h += mm(2) + lh(SIZE_FOOTER);
  return Math.ceil(h);
}

function drawHr(doc, x, width) {
  const y = doc.y + 2;
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(1).stroke();
  doc.y = y + HR_SPACE - 2;
}

// pdfkit's own `lineBreak:false` + `ellipsis:true` combo does NOT reliably
// stop wrapping (verified: it still splits overlong strings across multiple
// lines in this version), which would silently break our fixed per-line
// height budget. So truncation is done by hand, measuring with
// doc.widthOfString() under the already-set font/size, before ever calling
// .text() — this guarantees exactly one line every time.
function fitText(doc, str, maxWidth) {
  const s = String(str);
  if (doc.widthOfString(s) <= maxWidth) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = s.slice(0, mid) + '…';
    if (doc.widthOfString(candidate) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + '…';
}

// Draws one line of text and explicitly sets doc.y afterward — overriding
// pdfkit's own auto-advance so spacing stays exactly what computeHeight()
// budgeted for.
function drawLine(doc, str, x, width, size, align, gapAfter = 0) {
  const y = doc.y;
  doc.fontSize(size);
  doc.text(fitText(doc, str, width), x, y, { width, align, lineBreak: false });
  doc.y = y + lh(size) + gapAfter;
  return y;
}

// Same as drawLine but draws a right-hand amount at the same baseline.
function drawRow(doc, leftStr, leftX, leftWidth, rightStr, rightX, rightWidth, size, gapAfter = 0) {
  const y = doc.y;
  doc.fontSize(size);
  doc.text(fitText(doc, leftStr, leftWidth), leftX, y, { width: leftWidth, align: 'left', lineBreak: false });
  if (rightStr !== undefined) {
    doc.text(fitText(doc, rightStr, rightWidth), rightX, y, { width: rightWidth, align: 'right', lineBreak: false });
  }
  doc.y = y + lh(size) + gapAfter;
}

function buildTicketPdf(ticket) {
  return new Promise((resolve, reject) => {
    try {
      const nominalWidthMm = ticket.widthMm || 58;
      const widthPt = mm(nominalWidthMm);
      // Some thermal-roll printer drivers (seen with RONGTA's) auto-rotate
      // the page to landscape whenever width >= height, regardless of any
      // explicit orientation flag we pass to the print call. A short ticket
      // (few items) can end up wider than it is tall at 80mm, triggering
      // exactly that — so the page is never allowed to be that short.
      const heightPt = Math.max(computeHeight(ticket), Math.ceil(widthPt + mm(10)));
      const topBottomMarginPt = mm(2);
      // Some printers/drivers always print shifted right by a fixed physical
      // amount, regardless of what margins we request (a hardware/driver
      // quirk, not something our PDF controls — confirmed present even with
      // the old browser-print path on this printer). We can't eliminate the
      // shift, but we CAN compensate for it: reserve that same amount as
      // right margin (instead of as a symmetric decorative side margin) so
      // the content — laid out against the true left edge — lands correctly
      // placed after the hardware pushes it over. Measure the real-world
      // offset on a test print and set PRINT_AGENT_LEFT_OFFSET_MM to match.
      const leftOffsetMm = Number(process.env.PRINT_AGENT_LEFT_OFFSET_MM) || 0;
      const leftMarginPt = mm(0.5);
      const rightMarginPt = mm(0.5 + Math.max(0, leftOffsetMm));
      const marginPt = leftMarginPt; // x-origin for header/meta/footer/labels below
      const doc = new PDFDocument({
        size: [widthPt, heightPt],
        margins: { top: topBottomMarginPt, bottom: topBottomMarginPt, left: leftMarginPt, right: rightMarginPt },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const contentWidth = widthPt - leftMarginPt - rightMarginPt;
      const amountColWidth = Math.min(mm(22), contentWidth * 0.45);
      const labelColWidth = contentWidth - amountColWidth;
      const amountX = marginPt + labelColWidth;

      doc.font(FONT);

      drawLine(doc, ticket.businessName || '', marginPt, contentWidth, SIZE_HEADER, 'center', GAP_SECTION);

      const dateStr = new Date(ticket.date).toLocaleString('es-AR');
      drawLine(doc, dateStr, marginPt, contentWidth, SIZE_META, 'center');
      drawLine(doc, `Venta #${String(ticket.saleId || '').slice(0, 8)}`, marginPt, contentWidth, SIZE_META, 'center');
      if (ticket.clientName) {
        drawLine(doc, `Cliente: ${ticket.clientName}`, marginPt, contentWidth, SIZE_META, 'center');
      }
      doc.y += GAP_SECTION;
      drawHr(doc, marginPt, contentWidth);

      for (const item of ticket.items || []) {
        drawLine(doc, item.name, marginPt, contentWidth, SIZE_NAME, 'left');

        const qtyLabel = item.soldByWeight
          ? `${Number(item.quantity).toFixed(3)}kg`
          : `${item.quantity}x`;
        const subtotal = Number(item.price) * Number(item.quantity);
        drawRow(
          doc,
          `${qtyLabel} x $${Number(item.price).toFixed(2)}`, marginPt, labelColWidth,
          `$${subtotal.toFixed(2)}`, amountX, amountColWidth,
          SIZE_DETAIL
        );
      }

      drawHr(doc, marginPt, contentWidth);

      drawRow(doc, 'TOTAL', marginPt, labelColWidth, `$${Number(ticket.total).toFixed(2)}`, amountX, amountColWidth, SIZE_TOTAL);

      if (ticket.paymentMethod) {
        drawRow(doc, PAYMENT_LABELS[ticket.paymentMethod] || ticket.paymentMethod, marginPt, labelColWidth, undefined, amountX, amountColWidth, SIZE_PAYMENT);
      }
      if (ticket.cashReceived !== undefined && ticket.cashReceived !== null) {
        drawRow(doc, 'Recibido', marginPt, labelColWidth, `$${Number(ticket.cashReceived).toFixed(2)}`, amountX, amountColWidth, SIZE_PAYMENT);
      }
      if (ticket.change !== undefined && ticket.change !== null && ticket.change > 0) {
        drawRow(doc, 'Vuelto', marginPt, labelColWidth, `$${Number(ticket.change).toFixed(2)}`, amountX, amountColWidth, SIZE_PAYMENT);
      }

      doc.y += mm(2);
      drawLine(doc, '¡Gracias por su compra!', marginPt, contentWidth, SIZE_FOOTER, 'center');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/ping') {
    return sendJson(res, 200, { ok: true, agent: 'walti-print-agent' });
  }

  if (req.method === 'GET' && req.url === '/printers') {
    try {
      const printers = await getPrinters();
      return sendJson(res, 200, { ok: true, printers, configured: PRINTER_NAME || '(predeterminada de Windows)' });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: String(err) });
    }
  }

  if (req.method === 'POST' && req.url === '/print') {
    try {
      const raw = await readBody(req);
      const ticket = JSON.parse(raw);
      const pdfBuffer = await buildTicketPdf(ticket);

      const tmpFile = path.join(os.tmpdir(), `walti-ticket-${Date.now()}.pdf`);
      fs.writeFileSync(tmpFile, pdfBuffer);

      try {
        // Many thermal/receipt printer drivers define their roll "page" as
        // landscape internally, so SumatraPDF's default "shrink to fit" can
        // rotate + rescale our exact-size portrait PDF. Force portrait and
        // disable auto-scaling so it prints 1:1, at the size we computed.
        await print(tmpFile, {
          ...(PRINTER_NAME ? { printer: PRINTER_NAME } : {}),
          orientation: 'portrait',
          scale: 'noscale',
          monochrome: true,
        });
        return sendJson(res, 200, { ok: true });
      } finally {
        fs.unlink(tmpFile, () => {});
      }
    } catch (err) {
      console.error('Error al imprimir:', err);
      return sendJson(res, 500, { ok: false, error: String(err) });
    }
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Walti print-agent escuchando en http://localhost:${PORT}`);
    console.log(`Impresora: ${PRINTER_NAME || '(predeterminada de Windows)'}`);
  });
}

module.exports = { buildTicketPdf, computeHeight, server };
