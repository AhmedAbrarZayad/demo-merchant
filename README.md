# MassiveMarket third-party merchant demo

This separate storefront demonstrates the production merchant integration contract.

## Visitor and sale flow

1. Set the shop website URL in MassiveMarket to `https://your-merchant.example/capture`.
2. A shopper selects the shop through a marketer's public gateway link.
3. MassiveMarket redirects to `/capture?mm_ref=<opaque-token>`.
4. The merchant server validates `mm_ref`, replaces the previous attribution, stores it in a 30-day `HttpOnly; SameSite=Lax` cookie, and redirects to `/` so the token leaves the address bar.
5. Checkout reads attribution on the server and sends `mm_ref` unchanged as `data.tracking_code`.
6. The server signs the exact JSON body with the webhook secret and sends it with the Shop ID to MassiveMarket.

The browser never receives the webhook secret. Endpoint, Shop ID, and secret are server environment variables.

The storefront also forwards `/?mm_ref=...` to `/capture` as a compatibility fallback when a shop was configured with only the merchant origin. `/capture` remains the recommended shop URL because it captures attribution directly on the server.

## Configuration

Copy `.env.example` to `.env` and set:

```dotenv
MASSIVEMARKET_API_BASE_URL=http://localhost:8000
MASSIVEMARKET_SHOP_ID=your-shop-uuid
MASSIVEMARKET_WEBHOOK_SECRET=your-webhook-secret
```

Never use a client-exposed environment-variable prefix for the secret.

## Run locally

```bash
npm install
npm start
```

The merchant runs at `http://localhost:3001`, with capture URL `http://localhost:3001/capture`.

For the complete behavior, enter through a MassiveMarket marketer link and select this shop. For an isolated capture check, use a valid URL-safe token:

```text
http://localhost:3001/capture?mm_ref=example-token-1234
```

## Vercel

Set the same three environment variables in the Vercel project. Configure the shop website as `https://<deployment>/capture`.

## Cancellations

Confirmation and cancellation both send the complete schema required by the current MassiveMarket API. The demo retains the last completed order in the current browser session for its Cancel button. A production merchant must persist its order and attribution data in its own database.
