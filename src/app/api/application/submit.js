import { connectToDatabase } from "../../../lib/mongodb.js";
import Application from "../../../models/Application.js";
import crypto from "crypto";
import { sendReceiptEmail } from "../../../utils/sendReceiptEmail";

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

    const body = await request.json();

    const {
      application,
      payment,
    } = body;

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_SECRET
      )
      .update(
        payment.orderId +
          "|" +
          payment.paymentId
      )
      .digest("hex");

    if (
      generatedSignature !== payment.signature
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Payment Verification Failed",
        },
        {
          status: 400,
        }
      );
    }

    const savedApplication =
      await Application.create({

        fullName: application.fullName,

        mobileNumber:
          application.mobileNumber,

        email: application.email,

        service: application.service,

        paymentMethod:
          application.paymentMethod,

        location: {
          latitude:
            application.latitude,

          longitude:
            application.longitude,

          address:
            application.locationAddress,
        },

        images: application.images,

        payment: {
          orderId: payment.orderId,

          paymentId:
            payment.paymentId,

          signature:
            payment.signature,

          amount: payment.amount,

          currency: payment.currency,

          status: "SUCCESS",
        },
      });
await sendReceiptEmail({

  customerName: savedApplication.fullName,

  customerEmail: savedApplication.email,

  mobileNumber: savedApplication.mobileNumber,

  service: savedApplication.service,

  amount: payment.amount,

  paymentId: payment.paymentId,

  orderId: payment.orderId,

  applicationId: savedApplication._id,

});
    return jsonResponse({
      success: true,

      application: savedApplication,
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