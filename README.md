# VPN Products and Services Marketplace

India-wide second-hand marketplace branded **VPN Products and Services**, using https://veereshuppar.com/.

## Features
- Responsive React + Vite website
- Product categories, keyword and location search
- Email/password sign-up and sign-in with Supabase Auth
- Seller product submissions with up to five photos
- New listings are held for review before becoming public
- WhatsApp contact links for active listings
- Signed-in customer cart with add/remove and saved cart contents
- Saved delivery addresses with default address selection
- Checkout with address selection, order review and order-request confirmation
- Demo/sample listings can also submit order requests, flagged for manual seller verification
- Order requests stored for seller confirmation
- Public product image storage with seller-scoped upload policies
- Demo products are shown when Supabase variables are not configured

Online payments, escrow, in-app chat, OTP login, identity verification, and a full admin dashboard are not included. Checkout submits an order request only; it does not automatically notify sellers or collect payments. The customer can send the order reference to the business on WhatsApp for manual confirmation.

## Supabase setup
1. Run `supabase/schema.sql` in Supabase SQL Editor (already completed in the current project).
2. Run `supabase/commerce.sql` in Supabase SQL Editor to create the cart, customer address and order-request tables and checkout function.
3. Run (or re-run after updates to the checkout function) `supabase/cart-quantity.sql` in Supabase SQL Editor to enable quantities, quantity-aware order totals, demo low-stock limits and demo order requests. Re-run this migration to allow demo/sample listings to reach checkout.
4. Set these environment variables in Cloudflare Pages:
   - `VITE_SUPABASE_URL=https://huvpbhmqeijhksjfkoqa.supabase.co` (verify under Supabase Settings > Data API)
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<your sb_publishable key>`
5. Never put a Supabase secret/service_role key in frontend code, GitHub, or browser-visible settings.
6. First account: obtain its UUID from Authentication > Users, then set `profiles.is_admin=true` for that UUID in SQL Editor. Admins can approve listings by changing `listings.status` to `active`.

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
