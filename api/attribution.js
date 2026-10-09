import { attributionFromRequest, publicConfig } from './_shared.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Only GET is allowed.' } });
  const trackingCode = attributionFromRequest(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ...publicConfig(), attributed: Boolean(trackingCode) });
}
