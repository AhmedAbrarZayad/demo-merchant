import { attributionCookie, TOKEN_PATTERN } from './_shared.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const value = typeof req.query.mm_ref === 'string' ? req.query.mm_ref : '';
  if (!TOKEN_PATTERN.test(value)) return res.status(400).send('Invalid or missing mm_ref attribution token.');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const host = String(req.headers.host || '');
  const secure = forwardedProto === 'https' || (!host.startsWith('localhost') && !host.startsWith('127.0.0.1'));
  res.setHeader('Set-Cookie', attributionCookie(value, secure));
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, '/');
}
