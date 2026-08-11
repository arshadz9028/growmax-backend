import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,

  auth: {
    user: process.env.OTP_EMAIL,
    pass: process.env.OTP_EMAIL_PASSWORD,
  },
});

export async function sendReceiptEmail({
  customerName,
  customerEmail,
  mobileNumber,

  service,

  amount,

  paymentId,

  orderId,

  applicationId,
}) {
  const mailOptions = {
    from: `"Growmax Engineers" <${process.env.OTP_EMAIL}>`,

    to: customerEmail,

    subject: `Payment Receipt - ${service}`,

    html: `
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8"/>

<style>

body{

margin:0;

padding:30px;

background:#f4f6f9;

font-family:Arial;

}

.container{

max-width:700px;

margin:auto;

background:white;

border-radius:12px;

overflow:hidden;

box-shadow:0 5px 20px rgba(0,0,0,.08);

}

.header{

background:#16a34a;

padding:25px;

text-align:center;

color:white;

}

.header h1{

margin:0;

font-size:28px;

}

.content{

padding:30px;

}

table{

width:100%;

border-collapse:collapse;

margin-top:20px;

}

td{

padding:12px;

border-bottom:1px solid #eee;

}

.label{

font-weight:bold;

color:#555;

width:180px;

}

.amount{

font-size:32px;

font-weight:bold;

color:#16a34a;

text-align:center;

margin:25px 0;

}

.success{

background:#dcfce7;

padding:15px;

border-radius:8px;

text-align:center;

font-weight:bold;

color:#166534;

margin-bottom:25px;

}

.footer{

background:#f9fafb;

padding:20px;

font-size:14px;

text-align:center;

color:#666;

}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h1>Growmax Engineers</h1>

<p>Payment Receipt</p>

</div>

<div class="content">

<div class="success">

Payment Successful

</div>

<p>

Dear <b>${customerName}</b>,

</p>

<p>

Thank you for choosing Growmax Engineers.

Your payment has been received successfully.

</p>

<div class="amount">

₹ ${amount}

</div>

<table>

<tr>

<td class="label">

Application ID

</td>

<td>

${applicationId}

</td>

</tr>

<tr>

<td class="label">

Customer

</td>

<td>

${customerName}

</td>

</tr>

<tr>

<td class="label">

Mobile

</td>

<td>

${mobileNumber}

</td>

</tr>

<tr>

<td class="label">

Service

</td>

<td>

${service}

</td>

</tr>

<tr>

<td class="label">

Payment ID

</td>

<td>

${paymentId}

</td>

</tr>

<tr>

<td class="label">

Order ID

</td>

<td>

${orderId}

</td>

</tr>

<tr>

<td class="label">

Amount Paid

</td>

<td>

₹ ${amount}

</td>

</tr>

<tr>

<td class="label">

Payment Status

</td>

<td>

SUCCESS

</td>

</tr>

</table>

</div>

<div class="footer">

Growmax Engineers

<br/>

Thank you for your payment.

</div>

</div>

</body>

</html>
`,
  };

  return transporter.sendMail(mailOptions);
}