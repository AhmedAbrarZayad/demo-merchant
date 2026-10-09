import crypto from 'crypto';

const API_ENDPOINT = '/api/v1/webhooks/sale/';

function generateSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: {
        code: 'method_not_allowed',
        message: 'Only POST method is allowed'
      }
    });
  }

  try {
    const { apiBaseUrl, shopId, webhookSecret, webhookType, payload } = req.body;

    if (!apiBaseUrl || !shopId || !webhookSecret || !webhookType || !payload) {
      return res.status(400).json({
        error: {
          code: 'missing_fields',
          message: 'Missing required fields: apiBaseUrl, shopId, webhookSecret, webhookType, payload'
        }
      });
    }

    if (!['order_confirmation', 'order_cancellation'].includes(webhookType)) {
      return res.status(400).json({
        error: {
          code: 'invalid_webhook_type',
          message: 'webhookType must be order_confirmation or order_cancellation'
        }
      });
    }

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(payloadStr, webhookSecret);

    const targetUrl = `${apiBaseUrl.replace(/\/$/, '')}${API_ENDPOINT}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-ID': shopId,
        'X-Webhook-Signature': signature,
        'X-Webhook-Type': webhookType
      },
      body: payloadStr
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return res.status(500).json({
      error: {
        code: 'proxy_error',
        message: error.message || 'Internal proxy error'
      }
    });
  }
}