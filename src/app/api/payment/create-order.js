import razorpay from "../../../config/razorpay.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { amount, service, customerName } = body || {};
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return jsonResponse(
        {
          success: false,
          message: "Amount is required and must be greater than 0.",
        },
        { status: 400 }
      );
    }

    const options = {
      amount: Math.round(numericAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        service: service || "Grow Cleaning",
        customerName: customerName || "",
      },
    };

    const order = await razorpay.orders.create(options);

    return jsonResponse(
      {
        success: true,
        order,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to create Razorpay order:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to create order right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
