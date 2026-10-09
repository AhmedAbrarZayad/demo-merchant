import express from 'express';
import 'dotenv/config';
import { attributionCookie, attributionFromRequest, forwardWebhook, publicConfig, TOKEN_PATTERN } from './api/_shared.js';

const app = express();
const port = process.env.PORT || 3001;
app.use(express.json({ limit: '64kb' }));

app.get('/capture', (req, res) => {
  const value = typeof req.query.mm_ref === 'string' ? req.query.mm_ref : '';
  if (!TOKEN_PATTERN.test(value)) return res.status(400).send('Invalid or missing mm_ref attribution token.');
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', attributionCookie(value, secure));
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, '/');
});

app.get('/api/attribution', (req, res) => {
  const trackingCode = attributionFromRequest(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ...publicConfig(), attributed: Boolean(trackingCode) });
});

app.post('/api/send-webhook', async (req, res) => {
  const trackingCode = attributionFromRequest(req);
  if (!trackingCode) return res.status(400).json({ success: false, error: { code: 'missing_attribution', message: 'Enter this shop through a marketer link before checking out.' } });
  const webhookType = req.body?.webhookType;
  if (!['order_confirmation', 'order_cancellation'].includes(webhookType)) return res.status(400).json({ success: false, error: { code: 'invalid_webhook_type', message: 'Invalid webhook type.' } });
  try {
    const result = await forwardWebhook({ trackingCode, webhookType, sale: req.body?.sale || {} });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(502).json({ success: false, error: { code: 'upstream_error', message: error.message || 'Could not reach MassiveMarket.' } });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'demo-merchant' }));
app.use(express.static('.'));
app.listen(port, () => console.log(`Demo merchant running on http://localhost:${port}`));
