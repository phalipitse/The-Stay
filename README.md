# The Stay: booking page

The public booking page for The Stay, 501 Rachel de Beer. Guests pick a room, choose a short stay (per night) or a monthly student rental, enter their details and continue to the payment step.

It's a static site (HTML, CSS and plain JavaScript) with no build step. It can be hosted anywhere: Vercel, Netlify, GitHub Pages or any web host.

## How it fits together

```
the-stay (this repo)                 stay-payments service
booking page  ── GET  /api/rooms ──▶  rooms, rates, policy
              ── POST /api/quote ──▶  price + availability
              ── POST /api/bookings ▶ holds the room, returns payUrl
              ◀── guest is sent to payUrl: pays by card/EFT, can cancel after paying
```

Rooms, prices, monthly rates, the cancellation fee and hold times all come from the payments service (`rooms.json` and its environment settings), so this page never needs editing to change prices.

## Setup

1. Deploy the `stay-payments` service and note its address (e.g. `https://pay.thestay.co.za`).
2. In `config.js` set `paymentsUrl` to that address.
3. In the payments service settings, add this site's address to `ALLOWED_ORIGINS` and set `BOOKING_SITE_URL` to it.
4. Deploy this folder as a static site.

## Try it locally

```bash
# terminal 1: the payments service, allowing this page to call it
cd stay-payments
ALLOWED_ORIGINS=http://localhost:5500 PAYMENT_PROVIDER=mock BANK_ACCOUNT_NO=62000000000 ADMIN_PASSWORD=localtestpass npm start

# terminal 2: this site
python3 -m http.server 5500
# open http://localhost:5500
```
