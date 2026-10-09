export default function handler(req, res) {
  res.status(200).json({ status: 'ok', service: 'demo-merchant-backend' });
}