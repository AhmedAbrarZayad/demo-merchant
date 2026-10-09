import crypto from 'crypto';

export const ATTRIBUTION_COOKIE = 'mm_ref';
export const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    const key = separator < 0 ? part : part.slice(0, separator);
    const value = separator < 0 ? '' : part.slice(separator + 1);
    try { return [key, decodeURIComponent(value)]; } catch { return [key, value]; }
  }));
}

export function attributionFromRequest(req) {
  const value = parseCookies(req.headers.cookie)[ATTRIBUTION_COOKIE] || '';
  return TOKEN_PATTERN.test(value) ? value : '';
}

export function attributionCookie(value, secure = true) {
  return `${ATTRIBUTION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${ATTRIBUTION_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function merchantConfig() {
  return {
    apiBaseUrl: (process.env.MASSIVEMARKET_API_BASE_URL || '').replace(/\/+$/, ''),
    shopId: process.env.MASSIVEMARKET_SHOP_ID || '',
    webhookSecret: process.env.MASSIVEMARKET_WEBHOOK_SECRET || ''
  };
}

export function publicConfig() {
  const config = merchantConfig();
  return { configured: Boolean(config.apiBaseUrl && config.shopId && config.webhookSecret), shopId: config.shopId || null };
}

export async function forwardWebhook({ trackingCode, webhookType, sale }) {
  const config = merchantConfig();
  if (!config.apiBaseUrl || !config.shopId || !config.webhookSecret) {
    return { status: 503, body: { success: false, error: { code: 'merchant_not_configured', message: 'The demo merchant server is missing its MassiveMarket credentials.' } } };
  }
  const payload = {
    schema_version: '1.0',
    event_type: webhookType === 'order_cancellation' ? 'sale.cancelled' : 'sale.completed',
    occurred_at: new Date().toISOString(),
    data: {
      order_id: String(sale.order_id || '').trim(),
      tracking_code: trackingCode,
      amount: Number(sale.amount).toFixed(2),
      currency: 'USD',
      product: {
        name: String(sale.product_name || '').trim(),
        category: String(sale.product_category || '').trim(),
        image_url: String(sale.product_image_url || '').trim()
      },
      customer: { name: String(sale.customer_name || '').trim() },
      metadata: sale.metadata && typeof sale.metadata === 'object' && !Array.isArray(sale.metadata) ? sale.metadata : {}
    }
  };
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
  const response = await fetch(`${config.apiBaseUrl}/api/v1/webhooks/sale/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shop-ID': config.shopId, 'X-Webhook-Type': webhookType, 'X-Webhook-Signature': signature },
    body: rawBody
  });
  let body;
  try { body = await response.json(); }
  catch { body = { success: false, error: { code: 'invalid_upstream_response', message: 'MassiveMarket returned a non-JSON response.' } }; }
  return { status: response.status, body };
}
