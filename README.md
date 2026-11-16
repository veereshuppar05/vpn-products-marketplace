# VPN Products and Services Marketplace

India-wide second-hand marketplace branded **VPN Products and Services**, using https://veereshuppar.com/.

## Features
- Responsive React + Vite website
- Product categories, keyword and location search
- Email-only sign-up and sign-in with Supabase Auth
- Email password recovery using a Supabase reset link and secure new-password form
- Email/password sign-up with email confirmation. Existing phone-based accounts can still sign in if enabled in Supabase.
- Seller product submissions with up to five photos
- New listings are held for review before becoming public
- WhatsApp contact links for active listings
- Signed-in customer cart with add/remove and saved cart contents
- Saved delivery addresses with default address selection
- Checkout with saved address selection, order review and order-request confirmation
- Shiprocket courier serviceability and delivery-rate quotes, with the selected courier and fee saved on the order
- Single Shiprocket pickup location at the VPN Products and Services shop
- Server-side Shiprocket shipment-booking and AWB-tracking actions
- Parcel weight and packed dimensions captured when a seller creates a listing
- Demo/sample listings can also submit order requests, flagged for manual seller verification
- Order requests stored for seller confirmation
- Public product image storage with seller-scoped upload policies
- Demo products are shown when Supabase variables are not configured

Online payments, escrow, in-app chat, OTP login, identity verification, and a full admin dashboard are not included. Checkout submits an order request and a Shiprocket delivery estimate; it does not collect payment or book a courier automatically. An administrator must confirm the order, record that payment was received, and then call the protected shipment-booking action. The customer can send the order reference to the business on WhatsApp for manual confirmation.

## Registration method

New customer accounts and sign-ins both use an email address and password. Phone number is not accepted as a login identifier. SMS provider configuration is not required for authentication.

## Supabase setup
1. Run `supabase/schema.sql` in Supabase SQL Editor (already completed in the current project).
2. Run `supabase/commerce.sql` in Supabase SQL Editor to create the cart, customer address and order-request tables and checkout function.
3. Run `supabase/address-district.sql` in Supabase SQL Editor to add the district field to existing saved delivery addresses.
4. Run (or re-run after updates to the checkout function) `supabase/cart-quantity.sql` in Supabase SQL Editor to enable quantities, quantity-aware order totals, demo low-stock limits and demo order requests. Re-run this migration to allow demo/sample listings to reach checkout.
5. Run `supabase/shipping-integration.sql` in Supabase SQL Editor to add parcel dimensions, secure Shiprocket quotes and shipping fields to marketplace orders.
4. Set these environment variables in Cloudflare Pages:
   - `VITE_SUPABASE_URL=https://huvpbhmqeijhksjfkoqa.supabase.co` (verify under Supabase Settings > Data API)
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<your sb_publishable key>`
5. Never put a Supabase secret/service_role key in frontend code, GitHub, or browser-visible settings.
7. First account: obtain its UUID from Authentication > Users, then set `profiles.is_admin=true` for that UUID in SQL Editor. Admins can approve listings by changing `listings.status` to `active`.

## Shiprocket setup

This project uses one Shiprocket pickup location for all orders. Register your shop's real pickup address in Shiprocket first. The pickup-location name used in API requests must exactly match the name saved in your Shiprocket account. Every third-party seller must bring accepted items to this shop for consolidation, packing and courier pickup; sellers do not dispatch directly from their own addresses.

### 1. Add Supabase server secrets

In Supabase Dashboard > Edge Functions > Secrets, add:

- `SHIPROCKET_EMAIL` — the email used for your Shiprocket API account.
- `SHIPROCKET_PASSWORD` — the Shiprocket API password.
- `SHIPROCKET_PICKUP_LOCATION` — exact pickup-location name registered in Shiprocket.
- `SHIPROCKET_PICKUP_POSTCODE` — the shop's six-digit pickup PIN code.

Do not add these secrets to Vite environment variables, GitHub, or browser code. The Edge Function reads the Supabase server environment and keeps the Shiprocket token server-side.

### 2. Deploy the protected Edge Function

With Supabase CLI installed and this repository linked to the correct project:

```bash
supabase functions deploy shiprocket --project-ref huvpbhmqeijhksjfkoqa
```

Use the actual project reference shown in Supabase Dashboard if it differs. Keep JWT verification enabled for this function. The website calls the function with the signed-in customer's Supabase session.

### 3. Update existing product parcel details

New listings require packed weight (kg) and package length, breadth and height (cm). Existing active listings will have these new columns empty until you fill them with the real packed measurements in Supabase Table Editor:

- `package_weight_kg`
- `package_length_cm`
- `package_breadth_cm`
- `package_height_cm`

Courier estimates are not returned for products without these values. For multi-item carts, the quote calculation sums packed weight and stacks package heights using the largest length and breadth as an estimate. Confirm the final parcel dimensions when the order is physically packed; courier charges may change.

### 4. How order fulfilment works

1. Customer selects a saved delivery address and checks Shiprocket courier options.
2. The customer chooses a courier; the quote is saved securely for 20 minutes.
3. The order request is submitted with the selected delivery fee and courier.
4. The shop confirms product availability with the customer and collects payment outside this website.
5. An administrator changes the order status to `confirmed` and payment status to `paid` in Supabase. Only then can the protected Edge Function book a Shiprocket shipment.

Example after confirming and receiving payment:

```sql
update public.marketplace_orders
set status = 'confirmed', payment_status = 'paid'
where id = '<marketplace-order-uuid>';
```

Then an authenticated administrator can invoke the function with `{"action":"book","orderId":"<marketplace-order-uuid>"}`. The function creates the Shiprocket order, assigns the selected courier/AWB, schedules pickup, and attempts to generate the label and manifest. The tracking action is `{"action":"track","orderId":"<marketplace-order-uuid>"}` and is restricted to the buyer or an administrator.

Example administrator booking request (run from a secure computer; do not put the access token in GitHub or frontend code):

```bash
curl -X POST "$SUPABASE_URL/functions/v1/shiprocket" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"book","orderId":"<marketplace-order-uuid>"}'
```

A buyer or administrator can request tracking with the same endpoint and their own valid access token, using `{"action":"track","orderId":"<marketplace-order-uuid>"}`.

This project currently has no admin order-management screen; the confirmation/payment update and the admin booking call are manual server-side operations. No Shiprocket booking is made when a customer only submits an unconfirmed order request.

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

The delivery-address state/district dropdown uses the [CodingMation India States & Districts dataset](https://github.com/CodingMation/indian-states-districts), distributed under the MIT License. Its license text is included at `src/data/INDIA_STATES_DISTRICTS_LICENSE.txt`. The directory should be checked periodically against the Government of India's [Local Government Directory](https://panchayat.gov.in/lgd/), which is maintained by the Ministry of Panchayati Raj.
