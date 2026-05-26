interface LowStockItem {
  articleName: string;
  articleSku: string;
  unit: string;
  quantity: string;
  reorderPoint: string;
  locationName: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function stockAlertEmailHtml(items: LowStockItem[]): string {
  const rows = items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 12px; font-size: 13px; color: #111827; font-weight: 500;">
        ${escapeHtml(item.articleName)}
        <div style="font-size: 11px; color: #6b7280; font-family: monospace;">${escapeHtml(item.articleSku)}</div>
      </td>
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${escapeHtml(item.locationName)}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #d97706; font-weight: 500;">
        ${parseFloat(item.quantity).toFixed(3)} ${escapeHtml(item.unit)}
      </td>
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">
        mín. ${parseFloat(item.reorderPoint).toFixed(3)} ${escapeHtml(item.unit)}
      </td>
    </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f0f3f7; font-family: -apple-system, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background: #064875; padding: 24px 32px;">
      <div style="font-size: 20px; font-weight: 600; color: #fff;">StockBridge</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 4px;">
        Alerta de estoque baixo
      </div>
    </div>

    <!-- Body -->
    <div style="padding: 24px 32px;">
      <p style="font-size: 14px; color: #374151; margin: 0 0 8px;">
        <strong>${items.length} ${items.length === 1 ? 'item está' : 'itens estão'} abaixo do ponto de reposição.</strong>
      </p>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">
        Verifique o estoque e faça a reposição necessária.
      </p>

      <!-- Tabela -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Artigo</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Location</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Atual</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Mínimo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">
        StockBridge · Enviado automaticamente · ${new Date().toLocaleString('pt-BR')}
      </p>
    </div>
  </div>
</body>
</html>`;
}
