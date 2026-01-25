import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    // Security: Restrict to frontend domain only. Add production URL here.
    origin: (origin) => {
      // Allow all origins for production (since Vercel URLs vary)
      return origin || "*";
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// --- SERVICES ---

// 1. Payment Service (Paystack)
async function verifyPayment(reference: string) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("Missing PAYSTACK_SECRET_KEY");
      return { status: false, message: "Server configuration error" };
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const data = await response.json();
    return data; // returns { status: true, data: { status: 'success', ... } }
  } catch (error) {
    console.error("Paystack verification error:", error);
    return { status: false, message: "Verification failed" };
  }
}

async function initiatePayment(orderId: string, email: string, amount: number) {
  // MOCK IMPLEMENTATION (Not used in new flow, but kept for reference)
  return {
    status: true,
    data: {
      authorization_url: `https://checkout.paystack.com/mock-checkout-${orderId}`,
      access_code: "mock_access_code",
      reference: orderId,
    },
  };
}

// 2. Airtime Service (Danibest Tech API)
async function sendAirtime(
  phoneNumber: string,
  networkName: string,
  bundleData: string,
  orderId: string,
) {
  const apiKey = process.env.AIRTIME_PROVIDER_API_KEY;
  if (!apiKey) {
    console.error("Missing AIRTIME_PROVIDER_API_KEY in .env");
    return { success: false, error: "Server configuration error" };
  }

  // 1. Map Network Name to API Code
  // Frontend sends: "MTN", "Telecel", "AirtelTigo"
  // API expects: "MTN", "TEL", "AT", "BIG"
  const networkMap: Record<string, string> = {
    MTN: "MTN",
    Telecel: "TEL",
    AirtelTigo: "AT",
    Vodafone: "TEL", // Just in case
  };

  const apiNetwork = networkMap[networkName];
  if (!apiNetwork) {
    console.error(`Unknown network: ${networkName}`);
    return { success: false, error: `Network ${networkName} not supported` };
  }

  // 2. Map Volume (Extract number from "1GB", "500MB")
  // API expects "1" for 1GB.
  const volume = parseFloat(bundleData);
  if (isNaN(volume)) {
    return { success: false, error: `Invalid bundle data: ${bundleData}` };
  }

  console.log(
    `[Real Airtime] Sending ${volume}GB to ${phoneNumber} on ${apiNetwork} options:`,
    {
      network: apiNetwork,
      volume: volume.toString(),
      customer_number: phoneNumber,
      externalref: orderId,
    },
  );

  try {
    const response = await fetch(
      "https://danibesttech.com/wp-json/api/v1/place",
      {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: apiNetwork,
          volume: volume.toString(),
          customer_number: phoneNumber,
          externalref: orderId,
        }),
      },
    );

    const data = await response.json();
    console.log("[Real Airtime] Response:", data);

    if (data.status === 1) {
      return { success: true, transactionId: data.txref, raw: data };
    } else {
      return { success: false, error: data.message || "Provider failed" };
    }
  } catch (err: any) {
    console.error("[Real Airtime] Network Error:", err);
    return { success: false, error: err.message };
  }
}

// --- ROUTES ---

// Health check endpoint
app.get("/make-server-e68f4b01/health", (c) => {
  return c.json({ status: "ok" });
});

// Create Data Bundle Order
app.post("/make-server-e68f4b01/orders", async (c) => {
  try {
    const body = await c.req.json();
    const {
      network,
      bundleId,
      bundleData,
      bundlePrice,
      recipientNumber,
      paymentNumber,
    } = body;

    // Validate required fields
    if (!network || !bundleId || !recipientNumber || !paymentNumber) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    // Parse price to number (remove currency symbol)
    const priceNumeric = parseFloat(bundlePrice.replace(/[^\d.]/g, ""));

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const order = {
      id: orderId,
      network,
      bundleId,
      bundleData,
      bundlePrice: priceNumeric,
      recipientNumber,
      paymentNumber,
      status: "pending_payment", // pending_payment, paid, processing, completed, failed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(orderId, order);

    // Initiate Payment
    const paymentLinks = await initiatePayment(
      orderId,
      "customer@example.com",
      priceNumeric,
    );

    return c.json({
      success: true,
      orderId,
      order,
      paymentUrl: paymentLinks.data.authorization_url,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// VERIFY Payment and Fulfill Order (Called by Frontend after success)
app.post("/make-server-e68f4b01/orders/verify", async (c) => {
  try {
    const { reference, orderId } = await c.req.json();
    const order = await kv.get(orderId);

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    if (order.status === "completed" || order.status === "paid") {
      return c.json({ success: true, message: "Order already processed" });
    }

    // 1. Verify with Paystack
    const verification = await verifyPayment(reference);

    if (verification.status && verification.data.status === "success") {
      // 2. Mark as Paid
      order.status = "paid";
      order.paymentReference = reference;
      order.updatedAt = new Date().toISOString();
      await kv.set(orderId, order);

      // 3. Trigger Airtime Dispatch
      order.status = "processing";
      await kv.set(orderId, order);

      const airtimeResult = await sendAirtime(
        order.recipientNumber,
        order.network,
        order.bundleData,
        orderId,
      );

      if (airtimeResult.success) {
        order.status = "completed";
      } else {
        order.status = "failed";
        order.error = "Airtime provider failed";
      }

      order.updatedAt = new Date().toISOString();
      await kv.set(orderId, order);

      return c.json({ success: true, order });
    } else {
      return c.json(
        { success: false, error: "Payment verification failed" },
        400,
      );
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// SIMULATE Payment Success (For testing without real payment gateway)
app.post("/make-server-e68f4b01/test/simulate-payment/:orderId", async (c) => {
  try {
    const { orderId } = c.req.param();
    const order = await kv.get(orderId);

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    // 1. Mark as Paid
    order.status = "paid";
    order.updatedAt = new Date().toISOString();
    await kv.set(orderId, order);

    // 2. Trigger Airtime Dispatch (Async in real world, awaiting here for demo)
    order.status = "processing";
    await kv.set(orderId, order);

    const airtimeResult = await sendAirtime(
      order.recipientNumber,
      order.network,
      order.bundleData,
      orderId,
    );

    if (airtimeResult.success) {
      order.status = "completed";
      order.transactionId = airtimeResult.transactionId;
    } else {
      order.status = "failed";
      order.error = "Airtime provider failed";
    }

    order.updatedAt = new Date().toISOString();
    await kv.set(orderId, order);

    return c.json({ success: true, order });
  } catch (error) {
    console.error("Error simulating payment:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get Order Status
app.get("/make-server-e68f4b01/orders/:orderId", async (c) => {
  try {
    const { orderId } = c.req.param();
    const order = await kv.get(orderId);

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    return c.json({ success: true, order });
  } catch (error) {
    console.error("Error getting order:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Admin: Get All Orders (In production, this needs auth)
app.get("/make-server-e68f4b01/admin/orders", async (c) => {
  try {
    const allOrders = await kv.getByPrefix("ord_");
    // Sort by date desc
    allOrders.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return c.json({ success: true, orders: allOrders });
  } catch (error) {
    console.error("Error listing orders:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Admin: Update Order Status
app.post("/make-server-e68f4b01/admin/orders/:orderId/status", async (c) => {
  try {
    const { orderId } = c.req.param();
    const body = await c.req.json();
    const { status } = body;

    const order = await kv.get(orderId);
    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    await kv.set(orderId, order);

    return c.json({ success: true, order });
  } catch (error) {
    console.error("Error updating status:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;
