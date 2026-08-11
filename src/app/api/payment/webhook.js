import crypto from "crypto";
import connectToDatabase from "../../../lib/db";
import Payment from "../../../models/Payment";
import Application from "../../../models/Application";

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
    await connectToDatabase();

    // Read Raw Body
    const rawBody = await request.text();

    // Razorpay Signature
    const razorpaySignature = request.headers.get(
      "x-razorpay-signature"
    );

    if (!razorpaySignature) {
      return jsonResponse(
        {
          success: false,
          message: "Webhook Signature Missing",
        },
        {
          status: 400,
        }
      );
    }

    // Verify Signature
    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET
      )
      .update(rawBody)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid Webhook Signature",
        },
        {
          status: 401,
        }
      );
    }

    // Parse Payload
    const payload = JSON.parse(rawBody);

    console.log("Webhook Event :", payload.event);

    switch (payload.event) {
      case "payment.captured": {
        const payment = payload.payload.payment.entity;

        console.log(
          "Payment Captured:",
          payment.id
        );

        /**
         * Update Payment Collection
         */

        await Payment.findOneAndUpdate(
          {
            orderId: payment.order_id,
          },
          {
            paymentId: payment.id,

            amount: payment.amount / 100,

            currency: payment.currency,

            status: "SUCCESS",

            method: payment.method,

            email: payment.email,

            contact: payment.contact,

            capturedAt: new Date(),
          },
          {
            upsert: true,
            new: true,
          }
        );

        /**
         * Update Application
         */

        await Application.findOneAndUpdate(
          {
            "payment.orderId":
              payment.order_id,
          },
          {
            $set: {
              "payment.paymentId":
                payment.id,

              "payment.status":
                "SUCCESS",
            },
          }
        );

        /**
         * Future Integrations
         */

        // await sendWhatsApp()

        // await sendEmail()

        // await generateInvoice()

        console.log(
          "Payment Updated Successfully"
        );

        break;
      }

      case "payment.failed": {
        const payment =
          payload.payload.payment.entity;

        console.log(
          "Payment Failed:",
          payment.id
        );

        await Payment.findOneAndUpdate(
          {
            orderId: payment.order_id,
          },
          {
            status: "FAILED",
          }
        );

        break;
      }

      case "refund.created": {
        const refund =
          payload.payload.refund.entity;

        console.log(
          "Refund Created:",
          refund.id
        );

        await Payment.findOneAndUpdate(
          {
            paymentId: refund.payment_id,
          },
          {
            refundId: refund.id,

            refundStatus: "SUCCESS",
          }
        );

        break;
      }

      default:
        console.log(
          `Ignored Event : ${payload.event}`
        );
    }

    return jsonResponse({
      success: true,
      event: payload.event,
    });
  } catch (err) {
    console.log(err);

    return jsonResponse(
      {
        success: false,
        message: err.message,
      },
      {
        status: 500,
      }
    );
  }
}