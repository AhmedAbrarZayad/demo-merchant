import { attributionFromRequest, forwardWebhook } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: 'method_not_allowed', message: 'Only POST is allowed.' }
    });
  }

  try {
    const trackingCode = attributionFromRequest(req);
    if (!trackingCode) return res.status(400).json({ success: false, error: { code: 'missing_attribution', message: 'Enter this shop through a marketer link before checking out.' } });
    const webhookType = req.body?.webhookType;
    if (!['order_confirmation', 'order_cancellation'].includes(webhookType)) {
      return res.status(400).json({ success: false, error: { code: 'invalid_webhook_type', message: 'Invalid webhook type.' } });
    }
    const result = await forwardWebhook({ trackingCode, webhookType, sale: req.body?.sale || {} });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return res.status(500).json({
      error: {
        code: 'upstream_error',
        message: error.message || 'Could not reach MassiveMarket.'
      }
    });
  }
}
