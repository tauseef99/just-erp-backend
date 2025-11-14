// // backend/utils/mailer.js
// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || "smtp.gmail.com",
//   port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
//   secure: process.env.SMTP_PORT && Number(process.env.SMTP_PORT) === 465, // true for 465
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
//   // 👇 ADD THESE TIMEOUT SETTINGS
//   connectionTimeout: 30000, // 30 seconds
//   greetingTimeout: 30000,
//   socketTimeout: 30000,
// });

// export const sendVerificationEmail = async (toEmail, code) => {
//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: toEmail,
//     subject: "Verify your email",
//     text: `Your verification code is ${code}. It expires in 10 minutes.`,
//     html: `<p>Your verification code is <b>${code}</b>. It expires in 10 minutes.</p>`,
//   };
//   return transporter.sendMail(mailOptions);
// };


// ===============new imbeded code for resemd 


// backend/utils/mailer.js - REPLACE WITH THIS
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (toEmail, code) => {
  try {
    console.log("📧 Attempting to send email via Resend to:", toEmail);
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // You can use this default address
      to: toEmail,
      subject: 'Verify Your Email - ERP Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Thank you for registering! Use the verification code below to complete your registration:</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #333;">
            ${code}
          </div>
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">ERP Platform Team</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log(`✅ Email sent successfully to ${toEmail}`);
    console.log('📧 Email ID:', data?.id);
    return true;
  } catch (error) {
    console.error(' Email sending failed:', error);
    throw error;
  }
};