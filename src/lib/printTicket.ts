export interface TicketItem {
  name: string;
  quantity: number;
  price: number;
  soldByWeight?: boolean;
}

export interface TicketData {
  businessName: string;
  widthMm: number;
  saleId: string;
  date: Date;
  items: TicketItem[];
  total: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  cashReceived?: number;
  change?: number;
  clientName?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildTicketHtml(data: TicketData): string {
  const { businessName, widthMm, saleId, date, items, total, paymentMethod, cashReceived, change, clientName } = data;

  const itemRows = items
    .map((item) => {
      const qtyLabel = item.soldByWeight ? `${item.quantity.toFixed(3)}kg` : `${item.quantity}x`;
      const subtotal = item.price * item.quantity;
      return `
        <tr>
          <td colspan="2" class="name">${esc(item.name)}</td>
        </tr>
        <tr>
          <td class="qty">${qtyLabel} · $${item.price.toFixed(2)}</td>
          <td class="subtotal">$${subtotal.toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: ${widthMm}mm;
    margin: 0;
    padding: 2mm;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #000;
  }
  h1 { font-size: 13px; text-align: center; margin: 0 0 2mm; }
  .meta { text-align: center; font-size: 10px; margin-bottom: 2mm; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0.5mm 0; vertical-align: top; }
  td.name { font-weight: bold; }
  td.qty { color: #333; text-align: left; }
  td.subtotal { text-align: right; white-space: nowrap; }
  .total-row td { font-weight: bold; font-size: 13px; padding-top: 2mm; }
  .footer { text-align: center; margin-top: 3mm; font-size: 10px; }
</style>
</head>
<body>
  <h1>${esc(businessName)}</h1>
  <div class="meta">
    ${date.toLocaleString()}<br />
    Venta #${esc(saleId.slice(0, 8))}
    ${clientName ? `<br />Cliente: ${esc(clientName)}` : ''}
  </div>
  <hr />
  <table>
    ${itemRows}
    <tr><td colspan="2"><hr /></td></tr>
    <tr class="total-row">
      <td>TOTAL</td>
      <td class="subtotal">$${total.toFixed(2)}</td>
    </tr>
    ${paymentMethod ? `<tr><td>${PAYMENT_LABELS[paymentMethod] || paymentMethod}</td><td class="subtotal"></td></tr>` : ''}
    ${cashReceived !== undefined ? `<tr><td>Recibido</td><td class="subtotal">$${cashReceived.toFixed(2)}</td></tr>` : ''}
    ${change !== undefined && change > 0 ? `<tr><td>Vuelto</td><td class="subtotal">$${change.toFixed(2)}</td></tr>` : ''}
  </table>
  <div class="footer">¡Gracias por su compra!</div>
</body>
</html>`;
}

/**
 * Prints a receipt through a hidden iframe (no popup window, so it can't be
 * blocked by the browser's popup blocker) sized to the business's configured
 * thermal-printer paper width.
 */
export function printTicket(data: TicketData) {
  const html = buildTicketHtml(data);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };
  // Most browsers fire `afterprint` once the print dialog is dismissed
  // (printed or cancelled); a fallback timeout covers browsers that don't.
  iframe.contentWindow?.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
}
