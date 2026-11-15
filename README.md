# VPN Products Marketplace

An India-wide second-hand marketplace branded **VPN Products**, using the existing domain **https://veereshuppar.com/**.

## Included in this initial release
- Responsive English website for mobile and desktop
- Product categories, keyword search and location search
- Price and condition filters; sorting by price and newest
- Product detail view and WhatsApp / phone contact
- Browser-saved favourites
- Supabase email/password sign-up and sign-in
- Seller listing form with up to five image uploads
- New listings default to pending review
- Supabase Row Level Security and storage policies
- Demo browsing when Supabase environment variables are not set

This is an initial marketplace release. It does **not** include online payments, escrow, in-app chat, OTP phone login, identity verification, or a dedicated admin dashboard. For launch, review pending listings in Supabase Table Editor and change status to `active` only after checking them.

## Supabase configuration
Project reference from your dashboard: `huvpbhmqeijhksjfkoqa`.

Expected Project URL: `https://huvpbhmqeijhksjfkoqa.supabase.co`. Verify it under Supabase **Settings → Data API**.

In Cloudflare Pages build environment variables, add:
- `VITE_SUPABASE_URL` = your verified Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the Publishable key from **Settings → API Keys**

The app also supports the older `VITE_SUPABASE_ANON_KEY` variable name. Never put a Supabase Secret or `service_role` key in frontend code, GitHub, or build variables exposed to the browser.

The SQL in `supabase/schema.sql` is the same database setup script already run successfully in the owner's Supabase project. It includes explicit Data API grants because automatic exposure of new tables was disabled when the project was created.

## Run locally
Requires Node.js 20 or newer and npm:
```bash
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env
npm run dev
```

## Deploy to Cloudflare Pages
1. Open Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select this repository: `veereshuppar05/vpn-products-marketplace`.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Build output directory: `dist`.
6. Add the two Supabase environment variables above to the Pages project.
7. Deploy, then test the generated `pages.dev` address before adding the custom domain.

## Connect the existing Hostinger domain
The selected domain is **veereshuppar.com**. No new domain purchase is required.

For the apex/root domain, Cloudflare Pages requires the domain to be added to Cloudflare as a zone and the authoritative nameservers assigned by Cloudflare to be used. Before changing nameservers at Hostinger, review and preserve all existing DNS records, especially MX, SPF, DKIM and DMARC records used for email, plus any records for other services. Follow the exact nameservers shown in your Cloudflare account. After the zone is active, add `veereshuppar.com` under Pages → Custom domains and complete verification. Add `www.veereshuppar.com` separately if desired.

## Supabase Auth URLs
After the site is deployed, set the Supabase Authentication → URL Configuration Site URL to `https://veereshuppar.com` and add the site and required callback paths to the Redirect URLs list. Include the temporary `pages.dev` URL while testing.

## Brand
- Company / marketplace: **VPN Products**
- Domain: **https://veereshuppar.com/**
- Market: India
- Language: English
