import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventType = "order_placed" | "order_cancelled" | "return_requested";

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

function escapeHtml(value: unknown) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character] || character);
}

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

async function sendEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const apiKey = secret("RESEND_API_KEY");
  const from = secret("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to Supabase Edge Function secrets.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload.message || payload.name || "Resend email request failed with HTTP " + response.status));
  }
  return payload;
}

async function sendWhatsApp(input: { eventLabel: string; orderRef: string; customer: string; details: string }) {
  const token = secret("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = secret("WHATSAPP_PHONE_NUMBER_ID");
  const recipient = secret("ORDER_NOTIFICATION_WHATSAPP").replace(/\D/g, "");
  const templateName = secret("WHATSAPP_TEMPLATE_NAME") || "vpn_order_alert";
  const language = secret("WHATSAPP_TEMPLATE_LANGUAGE") || "en";
  const graphVersion = secret("WHATSAPP_GRAPH_API_VERSION") || "v27.0";

  if (!token || !phoneNumberId || !recipient) {
    throw new Error("WhatsApp is not configured. Add WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and ORDER_NOTIFICATION_WHATSAPP to Supabase Edge Function secrets.");
  }
  if (recipient.length < 10 || recipient.length > 15) {
    throw new Error("ORDER_NOTIFICATION_WHATSAPP must include the country code and contain 10 to 15 digits.");
  }

  const response = await fetch(
    "https://graph.facebook.com/" + encodeURIComponent(graphVersion) + "/" + encodeURIComponent(phoneNumberId) + "/messages",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: input.eventLabel.slice(0, 120) },
              { type: "text", text: input.orderRef.slice(0, 80) },
              { type: "text", text: input.customer.slice(0, 120) },
              { type: "text", text: input.details.slice(0, 180) },
            ],
          }],
        },
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload?.error?.message || "WhatsApp Cloud API request failed with HTTP " + response.status;
    throw new Error(String(error));
  }
  return payload;
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
      return respond({ error: "Supabase server environment is incomplete. Check the project Edge Function environment." }, 500);
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
    const eventType = String(body.eventType || "") as EventType;
    const orderId = String(body.orderId || "");
    const returnRequestId = String(body.returnRequestId || "");

    if (!["order_placed", "order_cancelled", "return_requested"].includes(eventType)) {
      return respond({ error: "Unsupported notification event." }, 400);
    }
    if (!orderId) return respond({ error: "Order ID is required." }, 400);

    const { data: profile } = await adminDb.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.is_admin === true;

    const { data: order, error: orderError } = await adminDb
      .from("marketplace_orders")
      .select("id,buyer_id,status,subtotal,delivery_fee,is_test_order,cancelled_by,created_at")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError || !order) return respond({ error: "Order was not found." }, 404);

    if (order.buyer_id !== user.id && !isAdmin) {
      return respond({ error: "You are not allowed to send notifications for this order." }, 403);
    }
    if (eventType === "order_cancelled" && order.status !== "cancelled") {
      return respond({ error: "This order has not been cancelled." }, 409);
    }

    let returnRequest: any = null;
    if (eventType === "return_requested") {
      if (!returnRequestId) return respond({ error: "Return request ID is required." }, 400);
      const { data, error } = await adminDb.from("marketplace_return_requests")
        .select("id,order_id,buyer_id,reason,details,status")
        .eq("id", returnRequestId)
        .eq("order_id", orderId)
        .maybeSingle();
      if (error || !data) return respond({ error: "Return request was not found." }, 404);
      if (data.buyer_id !== user.id && !isAdmin) {
        return respond({ error: "You are not allowed to notify this return request." }, 403);
      }
      returnRequest = data;
    }

    const [{ data: itemRows, error: itemError }, { data: buyerProfile }] = await Promise.all([
      adminDb.from("marketplace_order_items")
        .select("product_title,quantity,unit_price")
        .eq("order_id", orderId),
      adminDb.from("profiles").select("full_name,phone").eq("id", order.buyer_id).maybeSingle(),
    ]);
    if (itemError) throw new Error("Could not load order items for the notification.");

    const { data: buyerAuth } = await adminDb.auth.admin.getUserById(order.buyer_id);
    const customerEmail = buyerAuth?.user?.email || "";
    const customerName = String(buyerProfile?.full_name || customerEmail || "Customer");
    const itemSummary = (itemRows || []).map((item: any) =>
      String(item.product_title) + " × " + String(item.quantity) + " (₹" + (Number(item.unit_price) * Number(item.quantity)).toFixed(2) + ")"
    ).join(", ").slice(0, 900);
    const orderRef = shortOrderId(order.id);
    const total = Number(order.subtotal || 0) + Number(order.delivery_fee || 0);

    let eventLabel = "";
    let detailText = itemSummary || "Order details unavailable";
    if (eventType === "order_placed") eventLabel = order.is_test_order ? "New ₹1 test order placed" : "New order placed";
    if (eventType === "order_cancelled") eventLabel = "Customer cancelled an order";
    if (eventType === "return_requested") {
      eventLabel = "Customer requested a return";
      detailText = (String(returnRequest.reason || "") + (returnRequest.details ? ": " + String(returnRequest.details) : "")).slice(0, 900);
    }

    const eventKey = eventType + ":" + (eventType === "return_requested" ? returnRequestId : orderId);
    const { error: insertError } = await adminDb.from("marketplace_notification_events").insert({
      event_key: eventKey,
      event_type: eventType,
      order_id: orderId,
      return_request_id: returnRequestId || null,
    });
    if (insertError && insertError.code !== "23505") {
      throw new Error("Could not record the notification event: " + insertError.message);
    }

    const { data: eventRow, error: eventError } = await adminDb.from("marketplace_notification_events")
      .select("*").eq("event_key", eventKey).single();
    if (eventError || !eventRow) throw new Error("Could not load the notification delivery record.");

    const summary = eventType === "return_requested"
      ? detailText
      : (detailText + " | Total ₹" + total.toFixed(2) + (order.is_test_order ? " | TEST ONLY" : ""));
    const emailHtml = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#14233b">
      <h2>VPN Products and Services</h2>
      <h3>${escapeHtml(eventLabel)}</h3>
      <p><b>Order:</b> #${escapeHtml(orderRef)}</p>
      <p><b>Customer:</b> ${escapeHtml(customerName)} (${escapeHtml(customerEmail || "email unavailable")})</p>
      <p><b>Details:</b> ${escapeHtml(summary)}</p>
      <p><b>Order status:</b> ${escapeHtml(order.status)}</p>
      <p>Open the VPN Products admin account and choose My Orders to review.</p>
    </body></html>`;

    const result: Record<string, string> = {};

    const claim = async (column: "email_status" | "whatsapp_status") => {
      const { data, error } = await adminDb.from("marketplace_notification_events")
        .update({ [column]: "sending", updated_at: new Date().toISOString() })
        .eq("id", eventRow.id)
        .in(column, ["pending", "failed"])
        .select("id")
        .maybeSingle();
      if (error) throw new Error("Could not claim notification delivery: " + error.message);
      return Boolean(data);
    };

    if (eventRow.email_status === "sent") {
      result.email = "already_sent";
    } else if (await claim("email_status")) {
      try {
        const recipient = secret("ORDER_NOTIFICATION_EMAIL");
        if (!recipient) throw new Error("Add ORDER_NOTIFICATION_EMAIL to Supabase Edge Function secrets.");
        await sendEmail({
          to: recipient,
          subject: eventLabel + " — Order #" + orderRef,
          html: emailHtml,
          idempotencyKey: eventKey + "/email",
        });
        await adminDb.from("marketplace_notification_events")
          .update({ email_status: "sent", email_error: null, updated_at: new Date().toISOString() })
          .eq("id", eventRow.id);
        result.email = "sent";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email delivery failed.";
        await adminDb.from("marketplace_notification_events")
          .update({ email_status: "failed", email_error: message.slice(0, 1000), updated_at: new Date().toISOString() })
          .eq("id", eventRow.id);
        result.email = "failed: " + message;
      }
    } else {
      result.email = eventRow.email_status;
    }

    if (eventRow.whatsapp_status === "sent") {
      result.whatsapp = "already_sent";
    } else if (await claim("whatsapp_status")) {
      try {
        await sendWhatsApp({
          eventLabel,
          orderRef: "#" + orderRef,
          customer: (customerName + (customerEmail ? " · " + customerEmail : "")).slice(0, 120),
          details: summary,
        });
        await adminDb.from("marketplace_notification_events")
          .update({ whatsapp_status: "sent", whatsapp_error: null, updated_at: new Date().toISOString() })
          .eq("id", eventRow.id);
        result.whatsapp = "sent";
      } catch (error) {
        const message = error instanceof Error ? error.message : "WhatsApp delivery failed.";
        await adminDb.from("marketplace_notification_events")
          .update({ whatsapp_status: "failed", whatsapp_error: message.slice(0, 1000), updated_at: new Date().toISOString() })
          .eq("id", eventRow.id);
        result.whatsapp = "failed: " + message;
      }
    } else {
      result.whatsapp = eventRow.whatsapp_status;
    }

    return respond({
      ok: true,
      eventType,
      orderRef,
      notifications: result,
      note: "A failed channel can be retried by invoking this event again after fixing its configuration.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order notification failed.";
    console.error("Order notification error:", message);
    return respond({ error: message }, 400);
  }
});
