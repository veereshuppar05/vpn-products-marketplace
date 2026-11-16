import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const API = "https://apiv2.shiprocket.in/v1/external";
let cachedToken = "";
let tokenExpiresAt = 0;

function respond(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function secret(name: string) {
  return Deno.env.get(name)?.trim() || "";
}
function publishableKey() {
  const direct = secret("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const value = JSON.parse(secret("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return value.default || Object.values(value)[0] || "";
  } catch {
    return "";
  }
}
function serviceKey() {
  const direct = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  try {
    const value = JSON.parse(secret("SUPABASE_SECRET_KEYS") || "{}");
    return value.default || Object.values(value)[0] || "";
  } catch {
    return "";
  }
}
async function shiprocketToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const email = secret("SHIPROCKET_EMAIL");
  const password = secret("SHIPROCKET_PASSWORD");
  if (!email || !password) {
    throw new Error("Shiprocket API email/password are not configured in Supabase Edge Function secrets.");
  }
  const response = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token) {
    console.error("Shiprocket auth failed:", payload.message || response.status);
    throw new Error("Shiprocket authentication failed. Check the API email and password in Supabase secrets.");
  }
  cachedToken = String(payload.token);
  // Shiprocket documents a 10-day JWT lifetime; refresh before expiry.
  tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return cachedToken;
}
async function sr(path: string, method = "GET", body?: unknown) {
  const token = await shiprocketToken();
  const response = await fetch(API + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result.message === "string" ? result.message : "Shiprocket returned HTTP " + response.status;
    console.error("Shiprocket API error:", path, response.status, message);
    throw new Error(message);
  }
  return result;
}
function deepValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  for (const child of Object.values(record)) {
    const found = deepValue(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}
function positive(value: unknown, label: string, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > max) {
    throw new Error("Invalid " + label + ". Update the packed product details and try again.");
  }
  return number;
}
function splitCustomerName(fullName: string) {
  const pieces = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: pieces[0] || "Customer", last: pieces.slice(1).join(" ") };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return respond({ error: "Please sign in first." }, 401);

    const url = secret("SUPABASE_URL");
    const anon = publishableKey();
    const service = serviceKey();
    if (!url || !anon || !service) {
      return respond({ error: "Supabase server environment is incomplete. Configure the Edge Function environment." }, 500);
    }
    const userDb = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminDb = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userDb.auth.getUser();
    if (authError || !authData.user) return respond({ error: "Your session is invalid. Please sign in again." }, 401);
    const user = authData.user;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const { data: profile } = await adminDb.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.is_admin === true;

    if (action === "quote") {
      const addressId = String(body.addressId || "");
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map((id: unknown) => String(id)) : [];
      if (!addressId || itemIds.length < 1 || itemIds.length > 20 || new Set(itemIds).size !== itemIds.length) {
        return respond({ error: "Select a delivery address and between 1 and 20 cart products." }, 400);
      }
      let pickupPostcode = secret("SHIPROCKET_PICKUP_POSTCODE");
      const hasConfiguredPickupPostcode = /^\d{6}$/.test(pickupPostcode);
      const { data: address, error: addressError } = await userDb
        .from("customer_addresses").select("id,pincode").eq("id", addressId).eq("user_id", user.id).maybeSingle();
      if (addressError || !address) return respond({ error: "The selected delivery address could not be found." }, 404);
      if (!/^\d{6}$/.test(String(address.pincode || ""))) return respond({ error: "The delivery address needs a valid six-digit PIN code." }, 400);

      const { data: cartRows, error: cartError } = await userDb
        .from("cart_items").select("item_key,quantity").eq("user_id", user.id).in("item_key", itemIds);
      if (cartError) throw new Error("Could not verify your cart. Refresh and try again.");
      if (!cartRows || cartRows.length !== itemIds.length) return respond({ error: "Some products are no longer in your cart. Refresh and try again." }, 409);

      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (itemIds.some((id: string) => !uuid.test(id))) {
        return respond({ error: "Shiprocket rates need real seller listings with parcel details. Demo/sample products cannot be rated for delivery." }, 400);
      }
      const { data: listings, error: listingsError } = await userDb
        .from("listings")
        .select("id,title,price,seller_id,status,package_weight_kg,package_length_cm,package_breadth_cm,package_height_cm,is_test_product")
        .in("id", itemIds).eq("status", "active");
      if (listingsError) throw new Error("Could not load the product packing details.");
      if (!listings || listings.length !== itemIds.length) return respond({ error: "A product is no longer available." }, 409);

      let weight = 0;
      let height = 0;
      let length = 0;
      let breadth = 0;
      let declaredValue = 0;
      const packageLines: Array<Record<string, unknown>> = [];
      for (const cartRow of cartRows) {
        const item = listings.find((listing: any) => listing.id === cartRow.item_key) as any;
        if (!item) return respond({ error: "A cart product is unavailable." }, 409);
        if (item.seller_id === user.id) return respond({ error: "You cannot order your own listing." }, 400);
        const quantity = Number(cartRow.quantity || 1);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return respond({ error: "A cart item has an invalid quantity." }, 400);
        const w = positive(item.package_weight_kg, item.title + " packed weight", 1000);
        const l = positive(item.package_length_cm, item.title + " length", 500);
        const b = positive(item.package_breadth_cm, item.title + " breadth", 500);
        const h = positive(item.package_height_cm, item.title + " height", 500);
        weight += w * quantity;
        height += h * quantity;
        length = Math.max(length, l);
        breadth = Math.max(breadth, b);
        declaredValue += Number(item.price) * quantity;
        packageLines.push({ listing_id: item.id, quantity, weight_kg: w, length_cm: l, breadth_cm: b, height_cm: h, is_test_product: item.is_test_product === true });
      }
      const packageDetails = {
        weight_kg: Number(weight.toFixed(3)),
        length_cm: Number(length.toFixed(2)),
        breadth_cm: Number(breadth.toFixed(2)),
        height_cm: Number(height.toFixed(2)),
        packing_method: "stacked_product_packages",
        lines: packageLines,
      };
      const testFlags = packageLines.map(line => line.is_test_product === true);
      const isTestOrder = testFlags.every(Boolean);
      if (testFlags.some(Boolean) && !isTestOrder) {
        return respond({ error: "The ₹1 test item must be checked out by itself, not mixed with normal products." }, 400);
      }
      if (isTestOrder && (itemIds.length !== 1 || Number(cartRows[0]?.quantity || 1) !== 1)) {
        return respond({ error: "The ₹1 test product is limited to one item per test order." }, 400);
      }
      if (!isTestOrder && !hasConfiguredPickupPostcode) {
        return respond({ error: "Your shop pickup PIN code is not configured. Set SHIPROCKET_PICKUP_POSTCODE in Supabase secrets." }, 503);
      }
      if (isTestOrder && !hasConfiguredPickupPostcode) pickupPostcode = "000000";

      let couriers: Array<{courier_id:number;courier_name:string;rate:number;etd:string;estimated_delivery_days?:number}> = [];
      if (isTestOrder) {
        // Test orders bypass Shiprocket completely: no actual courier quote or pickup is requested.
        couriers = [{
          courier_id: 0,
          courier_name: "TEST ONLY — No courier shipment",
          rate: 0,
          etd: "Cancellation testing only",
        }];
      } else {
        const params = new URLSearchParams({
          pickup_postcode: pickupPostcode,
          delivery_postcode: String(address.pincode),
          cod: "0",
          weight: String(packageDetails.weight_kg),
          length: String(packageDetails.length_cm),
          breadth: String(packageDetails.breadth_cm),
          height: String(packageDetails.height_cm),
          declared_value: String(Math.round(declaredValue)),
        });
        const serviceability = await sr("/courier/serviceability/?" + params.toString());
        const available = serviceability?.data?.available_courier_companies || serviceability?.available_courier_companies || [];
        couriers = (Array.isArray(available) ? available : [])
          .map((item: any) => ({
            courier_id: Number(item.courier_company_id ?? item.courier_id),
            courier_name: String(item.courier_name || item.name || "Courier service"),
            rate: Number(item.rate ?? item.freight_charge ?? item.total_shipping_charges),
            etd: String(item.etd || item.estimated_delivery_date || ""),
            estimated_delivery_days: Number(item.estimated_delivery_days) || undefined,
          }))
          .filter((item: any) => Number.isInteger(item.courier_id) && item.courier_id > 0 && Number.isFinite(item.rate) && item.rate >= 0)
          .sort((a: any, b: any) => a.rate - b.rate);
      }
      if (!couriers.length) return respond({ quoteId: null, couriers: [], message: "No courier service is available for this PIN code and package." });

      const { data: quote, error: quoteError } = await adminDb.from("shipping_quotes").insert({
        user_id: user.id,
        pickup_postcode: pickupPostcode,
        delivery_postcode: String(address.pincode),
        package_details: packageDetails,
        declared_value: Number(declaredValue.toFixed(2)),
        couriers,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }).select("id").single();
      if (quoteError || !quote) {
        console.error("Could not save shipping quote:", quoteError?.message);
        throw new Error("Courier rates were returned but could not be saved. Please try again.");
      }
      return respond({ quoteId: quote.id, couriers, validForMinutes: 20, paymentMethod: "Prepaid", codAvailable: false, testMode: isTestOrder });
    }

    if (action === "book") {
      if (!isAdmin) return respond({ error: "Only a VPN Products administrator can book shipments." }, 403);
      const orderId = String(body.orderId || "");
      if (!orderId) return respond({ error: "Order request ID is required." }, 400);
      const { data: order, error: orderError } = await adminDb.from("marketplace_orders").select("*").eq("id", orderId).maybeSingle();
      if (orderError || !order) return respond({ error: "Order request was not found." }, 404);
      if (!["confirmed", "processing"].includes(order.status)) return respond({ error: "Confirm the order with the customer before booking the shipment." }, 409);
      if (String(order.payment_method || "prepaid").toLowerCase() !== "prepaid") {
        return respond({ error: "Cash on Delivery is not supported. Shiprocket orders must use prepaid payment only." }, 409);
      }
      if (String(order.payment_status || "").toLowerCase() === "cod") {
        return respond({ error: "Cash on Delivery is not available. Receive and verify advance payment before booking this shipment." }, 409);
      }
      if (order.payment_status !== "paid") return respond({ error: "Prepaid payment must be received and verified before booking the shipment." }, 409);
      if (order.is_test_order === true) return respond({ error: "This is a ₹1 checkout test order. It can be cancelled in My Orders, but it cannot be shipped or booked with Shiprocket." }, 409);
      if (!order.shipping_courier_id || !order.shipping_package || !order.shipping_quote_id) return respond({ error: "This order has no saved Shiprocket courier quote." }, 409);
      const pickupLocation = secret("SHIPROCKET_PICKUP_LOCATION");
      if (!pickupLocation) return respond({ error: "Set SHIPROCKET_PICKUP_LOCATION to the exact pickup-location name registered in Shiprocket." }, 503);

      const { data: orderItems, error: itemsError } = await adminDb.from("marketplace_order_items").select("*").eq("order_id", orderId);
      if (itemsError || !orderItems?.length) throw new Error("Order products could not be loaded.");
      const buyerResult = await adminDb.auth.admin.getUserById(order.buyer_id);
      if (buyerResult.error || !buyerResult.data.user) throw new Error("Customer account could not be loaded.");
      const buyer = buyerResult.data.user;
      const address = order.delivery_address || {};
      const customer = splitCustomerName(String(address.full_name || buyer.user_metadata?.full_name || "Customer"));
      const address2 = [address.address_line2, address.landmark, address.district].filter(Boolean).join(", ");
      const phone = String(address.phone || "");
      const pack = order.shipping_package;
      let srOrderId = order.shiprocket_order_id;
      let shipmentId = order.shiprocket_shipment_id;

      if (!shipmentId) {
        const created = await sr("/orders/create/adhoc", "POST", {
          order_id: "VPN-" + String(order.id).replace(/-/g, "").slice(0, 18),
          order_date: new Date().toISOString().replace("T", " ").slice(0, 16),
          pickup_location: pickupLocation,
          billing_customer_name: customer.first,
          billing_last_name: customer.last,
          billing_address: String(address.address_line1 || ""),
          billing_address_2: address2,
          billing_city: String(address.city || ""),
          billing_state: String(address.state || ""),
          billing_pincode: String(address.pincode || ""),
          billing_country: "India",
          billing_email: buyer.email || "",
          billing_phone: phone,
          shipping_is_billing: true,
          shipping_customer_name: customer.first,
          shipping_last_name: customer.last,
          shipping_address: String(address.address_line1 || ""),
          shipping_address_2: address2,
          shipping_city: String(address.city || ""),
          shipping_state: String(address.state || ""),
          shipping_pincode: String(address.pincode || ""),
          shipping_country: "India",
          shipping_email: buyer.email || "",
          shipping_phone: phone,
          order_items: orderItems.map((item: any) => ({
            name: item.product_title,
            sku: String(item.product_key),
            units: Number(item.quantity),
            selling_price: Number(item.unit_price),
            discount: 0,
            tax: 0,
            hsn: "",
          })),
          payment_method: "Prepaid",
          sub_total: Number(order.subtotal),
          shipping_charges: Number(order.delivery_fee || 0),
          cod_amount: 0,
          length: Number(pack.length_cm),
          breadth: Number(pack.breadth_cm),
          height: Number(pack.height_cm),
          weight: Number(pack.weight_kg),
        });
        srOrderId = Number(deepValue(created, ["order_id"]));
        shipmentId = Number(deepValue(created, ["shipment_id"]));
        if (!Number.isFinite(srOrderId) || !Number.isFinite(shipmentId)) {
          console.error("Shiprocket create-order response did not include the expected IDs.");
          throw new Error("Shiprocket did not return the order and shipment IDs. Check the Shiprocket panel before retrying.");
        }
        await adminDb.from("marketplace_orders").update({
          shiprocket_order_id: srOrderId,
          shiprocket_shipment_id: shipmentId,
          shipping_status: "order_created",
          shipping_error: null,
        }).eq("id", orderId);
      }

      let awb = String(order.shipping_awb || "");
      let courierName = String(order.shipping_courier_name || "");
      if (!awb) {
        const assigned = await sr("/courier/assign/awb", "POST", {
          shipment_id: shipmentId,
          courier_id: Number(order.shipping_courier_id),
        });
        awb = String(deepValue(assigned, ["awb_code"]) || "");
        courierName = String(deepValue(assigned, ["courier_name"]) || courierName);
        if (!awb) throw new Error("The Shiprocket shipment was created, but no AWB was returned. Check the Shiprocket panel before retrying.");
        await adminDb.from("marketplace_orders").update({
          shipping_awb: awb,
          shipping_courier_name: courierName || order.shipping_courier_name,
          shipping_status: "awb_assigned",
        }).eq("id", orderId);
      }

      if (order.shipping_status !== "pickup_scheduled" && order.shipping_status !== "booked") {
        await sr("/courier/generate/pickup", "POST", { shipment_id: [shipmentId] });
        await adminDb.from("marketplace_orders").update({ shipping_status: "pickup_scheduled" }).eq("id", orderId);
      }

      let labelUrl = String(order.shipping_label_url || "");
      if (!labelUrl) {
        const label = await sr("/courier/generate/label", "POST", { shipment_id: [shipmentId] });
        labelUrl = String(deepValue(label, ["label_url", "url"]) || "");
      }
      let manifestUrl = String(order.shipping_manifest_url || "");
      try {
        const manifest = await sr("/manifests/generate", "POST", { shipment_id: [shipmentId] });
        manifestUrl = String(deepValue(manifest, ["manifest_url", "url"]) || manifestUrl);
      } catch (error) {
        console.warn("Manifest not generated yet:", error instanceof Error ? error.message : error);
      }
      const trackingUrl = "https://shiprocket.co/tracking/" + encodeURIComponent(awb);
      const { error: updateError } = await adminDb.from("marketplace_orders").update({
        shipping_status: "pickup_scheduled",
        shipping_awb: awb,
        shipping_courier_name: courierName || order.shipping_courier_name,
        shipping_tracking_url: trackingUrl,
        shipping_label_url: labelUrl || null,
        shipping_manifest_url: manifestUrl || null,
        shipping_error: null,
      }).eq("id", orderId);
      if (updateError) throw new Error("The shipment was booked, but your order record could not be updated. Check Shiprocket before retrying.");
      return respond({ ok: true, orderId, shiprocketOrderId: srOrderId, shipmentId, awb, courierName, trackingUrl, labelUrl, manifestUrl });
    }

    if (action === "cancel") {
      const orderId = String(body.orderId || "");
      const reason = String(body.reason || "Cancelled by customer").trim().slice(0,500);
      if (!orderId) return respond({ error: "Order request ID is required." }, 400);
      const { data: order, error: orderError } = await adminDb.from("marketplace_orders").select("*").eq("id", orderId).maybeSingle();
      if (orderError || !order) return respond({ error: "Order request was not found." }, 404);
      if (order.buyer_id !== user.id && !isAdmin) return respond({ error: "You are not allowed to cancel this order." }, 403);
      const currentStatus = String(order.shipping_status || "").toLowerCase();
      const orderStatus = String(order.status || "").toLowerCase();
      if (orderStatus === "cancelled") return respond({ ok: true, alreadyCancelled: true, orderId });
      if (orderStatus === "delivered" || /shipped|in transit|out for delivery|delivered|picked up/.test(currentStatus)) {
        return respond({ error: "This order has already been dispatched or delivered. It cannot be cancelled; request a return after delivery instead." }, 409);
      }
      // If a Shiprocket order exists, cancel it at Shiprocket first. Never mark the
      // website order cancelled if the carrier refuses the cancellation.
      if (order.shiprocket_order_id) {
        await sr("/orders/cancel", "POST", { ids: [Number(order.shiprocket_order_id)] });
      }
      const { error: updateError } = await adminDb.from("marketplace_orders").update({
        status: "cancelled",
        shipping_status: order.shiprocket_order_id ? "cancelled" : (order.is_test_order ? "test_order_cancelled" : "cancelled"),
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
      }).eq("id", orderId);
      if (updateError) throw new Error("The courier/order cancellation was requested, but the website order could not be updated. Contact support before retrying.");
      return respond({ ok: true, orderId, status: "cancelled" });
    }

    if (action === "admin-update-order") {
      if (!isAdmin) return respond({ error: "Only a VPN Products administrator can update order confirmation and payment." }, 403);
      const orderId = String(body.orderId || "");
      const status = String(body.status || "");
      const paymentStatus = String(body.paymentStatus || "");
      if (!orderId) return respond({ error: "Order request ID is required." }, 400);
      if (status && !["pending_confirmation", "confirmed", "processing", "cancelled"].includes(status)) {
        return respond({ error: "Invalid order status." }, 400);
      }
      if (paymentStatus && !["pending", "paid"].includes(paymentStatus)) {
        return respond({ error: "Only prepaid payment states pending and paid are accepted. COD is not supported." }, 400);
      }
      const patch: Record<string, unknown> = {};
      if (status) patch.status = status;
      if (paymentStatus) patch.payment_status = paymentStatus;
      const { data, error } = await adminDb.from("marketplace_orders").update(patch).eq("id", orderId).select("id,status,payment_status").single();
      if (error || !data) throw new Error(error?.message || "Order update failed.");
      return respond({ ok: true, order: data });
    }

    if (action === "reject-return") {
      if (!isAdmin) return respond({ error: "Only a VPN Products administrator can process return requests." }, 403);
      const returnRequestId = String(body.returnRequestId || "");
      const note = String(body.note || "").trim().slice(0, 1200);
      if (!returnRequestId) return respond({ error: "Return request ID is required." }, 400);
      const { data: returnRequest, error: returnError } = await adminDb.from("marketplace_return_requests")
        .select("id,status").eq("id", returnRequestId).maybeSingle();
      if (returnError || !returnRequest) return respond({ error: "Return request was not found." }, 404);
      if (returnRequest.status !== "requested") return respond({ error: "Only pending return requests can be rejected." }, 409);
      const { error } = await adminDb.from("marketplace_return_requests").update({
        status: "rejected", admin_note: note || "Return request not approved.", updated_at: new Date().toISOString(),
      }).eq("id", returnRequestId);
      if (error) throw new Error("Could not update the return request.");
      return respond({ ok: true, returnRequestId, status: "rejected" });
    }

    if (action === "approve-return") {
      if (!isAdmin) return respond({ error: "Only a VPN Products administrator can approve and book return pickups." }, 403);
      const returnRequestId = String(body.returnRequestId || "");
      if (!returnRequestId) return respond({ error: "Return request ID is required." }, 400);
      const { data: returnRequest, error: returnError } = await adminDb.from("marketplace_return_requests")
        .select("*").eq("id", returnRequestId).maybeSingle();
      if (returnError || !returnRequest) return respond({ error: "Return request was not found." }, 404);
      if (returnRequest.status !== "requested") return respond({ error: "This return request has already been processed." }, 409);
      const { data: order, error: orderError } = await adminDb.from("marketplace_orders").select("*").eq("id", returnRequest.order_id).maybeSingle();
      if (orderError || !order) return respond({ error: "Original order was not found." }, 404);
      if (order.is_test_order) return respond({ error: "The ₹1 test order cannot be returned or shipped." }, 409);
      if (order.status !== "delivered" && !/delivered/i.test(String(order.shipping_status || ""))) return respond({ error: "The original order must be delivered before a return pickup can be booked." }, 409);
      if (order.payment_status !== "paid") return respond({ error: "Verify the original prepaid payment before arranging a reverse pickup." }, 409);
      const shopAddress = secret("SHIPROCKET_PICKUP_ADDRESS");
      const shopCity = secret("SHIPROCKET_PICKUP_CITY");
      const shopState = secret("SHIPROCKET_PICKUP_STATE");
      const shopPhone = secret("SHIPROCKET_PICKUP_PHONE");
      const shopPostcode = secret("SHIPROCKET_PICKUP_POSTCODE");
      if (!shopAddress || !shopCity || !shopState || !shopPhone || !/^\d{6}$/.test(shopPostcode)) {
        return respond({ error: "To book reverse pickups, also configure SHIPROCKET_PICKUP_ADDRESS, SHIPROCKET_PICKUP_CITY, SHIPROCKET_PICKUP_STATE and SHIPROCKET_PICKUP_PHONE in Supabase secrets." }, 503);
      }
      if (!order.shipping_package) return respond({ error: "Original parcel dimensions are missing; a reverse pickup cannot be booked." }, 409);
      const { data: orderItems, error: itemError } = await adminDb.from("marketplace_order_items").select("*").eq("order_id", order.id);
      if (itemError || !orderItems?.length) throw new Error("Original order products could not be loaded.");
      const buyerResult = await adminDb.auth.admin.getUserById(order.buyer_id);
      if (buyerResult.error || !buyerResult.data.user) throw new Error("Customer account could not be loaded.");
      const buyer = buyerResult.data.user;
      const address = order.delivery_address || {};
      const customer = splitCustomerName(String(address.full_name || buyer.user_metadata?.full_name || "Customer"));
      const packageDetails = order.shipping_package;
      const returnOrderCode = "R" + String(returnRequest.id).replace(/-/g, "").slice(0, 19);
      const returnPayload = {
        order_id: returnOrderCode,
        order_date: new Date().toISOString().slice(0, 10),
        payment_method: "Prepaid",
        sub_total: Number(order.subtotal),
        pickup_customer_name: customer.first,
        pickup_last_name: customer.last,
        pickup_address: String(address.address_line1 || ""),
        pickup_address_2: [address.address_line2, address.landmark, address.district].filter(Boolean).join(", "),
        pickup_city: String(address.city || ""),
        pickup_state: String(address.state || ""),
        pickup_country: "India",
        pickup_pincode: String(address.pincode || ""),
        pickup_email: buyer.email || "",
        pickup_phone: String(address.phone || ""),
        shipping_customer_name: "VPN Products and Services",
        shipping_address: shopAddress,
        shipping_city: shopCity,
        shipping_state: shopState,
        shipping_country: "India",
        shipping_pincode: shopPostcode,
        shipping_phone: shopPhone,
        shipping_email: secret("SHIPROCKET_EMAIL"),
        order_items: orderItems.map((item: any) => ({
          name: item.product_title,
          sku: String(item.product_key),
          units: Number(item.quantity),
          selling_price: Number(item.unit_price),
          discount: 0,
          tax: 0,
          hsn: "",
        })),
        weight: Number(packageDetails.weight_kg),
        length: Number(packageDetails.length_cm),
        breadth: Number(packageDetails.breadth_cm),
        height: Number(packageDetails.height_cm),
        declared_value: Math.round(Number(order.subtotal)),
        is_return: 1,
      };
      const created = await sr("/orders/create/return", "POST", returnPayload);
      const returnOrderId = Number(deepValue(created, ["order_id"]));
      const returnShipmentId = Number(deepValue(created, ["shipment_id"]));
      if (!Number.isFinite(returnOrderId) || !Number.isFinite(returnShipmentId)) {
        throw new Error("Shiprocket did not return the reverse-order and shipment IDs. Check the Shiprocket panel before retrying.");
      }
      const returnParams = new URLSearchParams({
        pickup_postcode: String(address.pincode || ""),
        delivery_postcode: shopPostcode,
        cod: "0",
        weight: String(packageDetails.weight_kg),
        length: String(packageDetails.length_cm),
        breadth: String(packageDetails.breadth_cm),
        height: String(packageDetails.height_cm),
        declared_value: String(Math.round(Number(order.subtotal))),
        is_return: "1",
      });
      const serviceability = await sr("/courier/serviceability/?" + returnParams.toString());
      const available = serviceability?.data?.available_courier_companies || serviceability?.available_courier_companies || [];
      const couriers = (Array.isArray(available) ? available : [])
        .map((item: any) => ({
          courier_id: Number(item.courier_company_id ?? item.courier_id),
          rate: Number(item.rate ?? item.freight_charge ?? item.total_shipping_charges),
        }))
        .filter((item: any) => Number.isInteger(item.courier_id) && item.courier_id > 0 && Number.isFinite(item.rate) && item.rate >= 0)
        .sort((a: any, b: any) => a.rate - b.rate);
      if (!couriers.length) throw new Error("No reverse-pickup courier is available for the customer's PIN code.");
      const assigned = await sr("/courier/assign/awb", "POST", {
        shipment_id: returnShipmentId,
        courier_id: couriers[0].courier_id,
      });
      const awb = String(deepValue(assigned, ["awb_code"]) || "");
      if (!awb) throw new Error("The return order was created but Shiprocket did not return a reverse-pickup AWB.");
      await sr("/courier/generate/pickup", "POST", { shipment_id: [returnShipmentId] });
      const trackingUrl = "https://shiprocket.co/tracking/" + encodeURIComponent(awb);
      const { error: updateError } = await adminDb.from("marketplace_return_requests").update({
        status: "pickup_scheduled",
        admin_note: "Return approved. Reverse pickup booked with Shiprocket.",
        shiprocket_return_order_id: returnOrderId,
        shiprocket_return_shipment_id: returnShipmentId,
        return_awb: awb,
        return_tracking_url: trackingUrl,
        return_shipping_status: "pickup_scheduled",
        updated_at: new Date().toISOString(),
      }).eq("id", returnRequestId);
      if (updateError) throw new Error("Shiprocket reverse pickup was booked, but the return request could not be updated. Check Shiprocket before retrying.");
      return respond({ ok: true, returnRequestId, returnOrderId, returnShipmentId, awb, trackingUrl });
    }

    if (action === "track-return") {
      const returnRequestId = String(body.returnRequestId || "");
      if (!returnRequestId) return respond({ error: "Return request ID is required." }, 400);
      const { data: returnRequest, error } = await adminDb.from("marketplace_return_requests")
        .select("id,buyer_id,return_awb,status").eq("id", returnRequestId).maybeSingle();
      if (error || !returnRequest) return respond({ error: "Return request was not found." }, 404);
      if (returnRequest.buyer_id !== user.id && !isAdmin) return respond({ error: "You are not allowed to view this return." }, 403);
      if (!returnRequest.return_awb) return respond({ error: "Reverse pickup has not been booked yet." }, 409);
      const tracking = await sr("/courier/track/awb/" + encodeURIComponent(returnRequest.return_awb));
      const status = String(deepValue(tracking, ["current_status", "shipment_status", "status"]) || "Return in progress");
      const received = /delivered/i.test(status);
      const { error: updateError } = await adminDb.from("marketplace_return_requests").update({
        return_shipping_status: status,
        status: received ? "received" : (returnRequest.status === "pickup_scheduled" ? "in_transit" : returnRequest.status),
        updated_at: new Date().toISOString(),
      }).eq("id", returnRequestId);
      if (updateError) throw new Error("Could not save the latest reverse-pickup status.");
      return respond({ returnRequestId, awb: returnRequest.return_awb, status, received, trackingUrl: "https://shiprocket.co/tracking/" + encodeURIComponent(returnRequest.return_awb), tracking });
    }

    if (action === "track") {
      const orderId = String(body.orderId || "");
      if (!orderId) return respond({ error: "Order request ID is required." }, 400);
      const { data: order, error: orderError } = await adminDb.from("marketplace_orders")
        .select("id,buyer_id,shipping_awb,shipping_status").eq("id", orderId).maybeSingle();
      if (orderError || !order) return respond({ error: "Order request was not found." }, 404);
      if (order.buyer_id !== user.id && !isAdmin) return respond({ error: "You are not allowed to view this shipment." }, 403);
      if (!order.shipping_awb) return respond({ error: "This order has not been booked with a courier yet." }, 409);
      const tracking = await sr("/courier/track/awb/" + encodeURIComponent(order.shipping_awb));
      const status = String(deepValue(tracking, ["current_status", "shipment_status", "status"]) || order.shipping_status);
      const delivered = /delivered/i.test(status);
      const update: Record<string, unknown> = {
        shipping_status: status,
        tracking_payload: tracking,
        tracking_updated_at: new Date().toISOString(),
      };
      if (delivered) update.status = "delivered";
      await adminDb.from("marketplace_orders").update(update).eq("id", orderId);
      return respond({ orderId, awb: order.shipping_awb, trackingUrl: "https://shiprocket.co/tracking/" + encodeURIComponent(order.shipping_awb), status, delivered, tracking });
    }

    return respond({ error: "Unsupported Shiprocket action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shiprocket delivery request failed.";
    return respond({ error: message }, 400);
  }
});
