# VPN Products Marketplace

India-wide second-hand marketplace branded **VPN Products**, using https://veereshuppar.com/.

## Features
- Responsive React + Vite website
- Product categories, keyword and location search
- Email/password sign-up and sign-in with Supabase Auth
- Seller product submissions with up to five photos
- New listings are held for review before becoming public
- WhatsApp contact links for active listings
- Public product image storage with seller-scoped upload policies
- Demo products are shown when Supabase variables are not configured

This initial release does not include online payments, escrow, in-app chat, OTP login, identity verification, or a full admin dashboard.

## Supabase setup
1. Run the SQL file at `supabase/schema.sql` in Supabase SQL Editor (already completed in the current project).
2. Set these environment variables in Cloudflare Pages:
   - `VITE_SUPABASE_URL=https://huvpbhmqeijhksjfkoqa.supabase.co` (verify under Supabase Settings > Data API)
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<your sb_publishable key>`
3. Never put a Supabase secret/service_role key in frontend code, GitHub, or browser-visible settings.
4. First account: obtain its UUID from Authentication > Users, then set `profiles.is_admin=true` for that UUID in SQL Editor. Admins can approve listings by changing `listings.status` to `active`.

## Deploy on Cloudflare Pages
- Connect this GitHub repository.
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Add the two Supabase environment variables above.
- Add `veereshuppar.com` as a custom domain after the first successful deployment. Update DNS only as prompted by Cloudflare. Preserve existing MX/TXT records if you use domain email.

## Run locally
Requires Node.js 20+:
```bash
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env
npm run dev
```
