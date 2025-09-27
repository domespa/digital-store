import nodemailer from "nodemailer";
import { OrderResponse } from "../types/order";

// Interface per EmailService
interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

// CONF GMAIL
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

class EmailService {
  // Metodo generico per inviare email (necessario per NotificationService)
  async sendEmail(options: EmailOptions): Promise<void> {
    await transporter.sendMail({
      from: options.from || process.env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  // EMAIL RESET
  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reset Password - Digital Store</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #333; text-align: center;">Reset Your Password</h1>
          
          <p>Hi ${firstName},</p>
          
          <p>You requested to reset your password for your Digital Store account. Click the button below to set a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p><strong>This link will expire in 1 hour.</strong></p>
          
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link in your browser:<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: "Reset Your Password - Digital Store",
      html: htmlContent,
    });
  }

  // VERIFICA EMAIL
  async sendEmailVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Verify Your Email - Digital Store</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #333; text-align: center;">Welcome to Digital Store!</h1>
          
          <p>Hi ${firstName},</p>
          
          <p>Thank you for registering with Digital Store! To complete your registration, please verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </div>
          
          <p><strong>This link will expire in 7 days.</strong></p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link in your browser:<br>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: "Verify Your Email - Digital Store",
      html: htmlContent,
    });
  }

  // EMAIL NOTIFICA CAMBIO PASSWORD
  async sendPasswordChangedNotificationEmail(
    email: string,
    firstName: string
  ): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Changed - Digital Store</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #333; text-align: center;">Password Changed Successfully</h1>
          
          <p>Hi ${firstName},</p>
          
          <p>This email confirms that your Digital Store account password was successfully changed on ${new Date().toLocaleString()}.</p>
          
          <p><strong>If you didn't make this change:</strong></p>
          <ul>
            <li>Someone may have accessed your account</li>
            <li>Contact our support immediately</li>
            <li>Consider changing your password again</li>
          </ul>
          
          <p>If you made this change, no further action is needed.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            For security reasons, this notification was sent to all email addresses associated with your account.
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: "Password Changed - Digital Store",
      html: htmlContent,
    });
  }

  // EMAIL CONFERMA ORDINE
  async sendOrderConfirmation(order: OrderResponse): Promise<boolean> {
    try {
      const emailSubject = `Order Confirmation #${order.id.slice(
        -8
      )} - Digital Store`;
      const emailHTML = this.generateOrderConfirmationHTML(order);

      await this.sendEmail({
        to: order.customerEmail,
        subject: emailSubject,
        html: emailHTML,
        from: `"Digital Store" <${process.env.EMAIL_USER}>`,
      });

      console.log(`Order confirmation email sent to: ${order.customerEmail}`);
      return true;
    } catch (error) {
      console.error("Failed to send order confirmation email:", error);
      return false;
    }
  }

  // EMAIL AGGIORNAMENTO ORDINE
  async sendOrderStatusUpdate(
    order: OrderResponse,
    previousStatus?: string
  ): Promise<boolean> {
    try {
      let subject = `Order Update #${order.id.slice(-8)}`;

      if (order.status === "PAID") {
        subject = `Payment Completed - Order #${order.id.slice(-8)}`;
      } else if (order.status === "COMPLETED") {
        subject = `Your products are ready - Order${order.id.slice(-8)}`;
      }

      const emailHTML = this.generateOrderConfirmationHTML(order);

      await this.sendEmail({
        to: order.customerEmail,
        subject: subject,
        html: emailHTML,
        from: `"Digital Store" <${process.env.EMAIL_USER}>`,
      });

      console.log(
        `Order status update email sent to: ${order.customerEmail} (${previousStatus} → ${order.status})`
      );
      return true;
    } catch (error) {
      console.error("Failed to send order status update email:", error);
      return false;
    }
  }

  // VERIFICA CONNESSIONE
  async testEmailConnection(): Promise<boolean> {
    try {
      await transporter.verify();
      console.log("Email service is ready");
      return true;
    } catch (error) {
      console.error("Email service connection failed:", error);
      return false;
    }
  }

  // Metodo privato per generare HTML dell'ordine
  private generateOrderConfirmationHTML(order: OrderResponse): string {
    const orderItemsHTML = order.orderItems
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; font-weight: 500;">${
          item.product?.name || "Product not available"
        }</td>
        <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; text-align: right;">€${item.price.toFixed(
          2
        )}</td>
        <td style="padding: 12px 8px; text-align: right;">€${(
          item.price * item.quantity
        ).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - Digital Store</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th { background: #f8f9fa; padding: 12px 8px; text-align: left; font-weight: 600; }
          .total-row { background: #4F46E5; color: white; font-weight: bold; }
          .footer { text-align: center; margin: 30px 0; color: #666; font-size: 14px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .status-pending { background: #FEF3C7; color: #92400E; }
          .status-paid { background: #D1FAE5; color: #065F46; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Order Confirmation</h1>
            <p style="margin: 10px 0 0 0;">Thank you for your purchase!</p>
          </div>
          
          <div class="content">
            <div class="order-info">
              <h2>Order Details</h2>
              <p><strong>Order Number:</strong> ${order.id}</p>
              <p><strong>Email:</strong> ${order.customerEmail}</p>
              ${
                order.customerFirstName
                  ? `<p><strong>Nome:</strong> ${order.customerFirstName} ${
                      order.customerLastName || ""
                    }</p>`
                  : ""
              }
              <p><strong>Data:</strong> ${new Date(
                order.createdAt
              ).toLocaleString("it-IT")}</p>
              <p><strong>Status:</strong> 
                <span class="status-badge ${
                  order.status === "PAID" ? "status-paid" : "status-pending"
                }">
                  ${
                    order.status === "PENDING"
                      ? "Pending payment"
                      : order.status === "PAID"
                      ? "Payment successful"
                      : order.status === "COMPLETED"
                      ? "Completed"
                      : order.status
                  }
                </span>
              </p>
            </div>

            <h3>Purchased Products</h3>
            <table class="table" style="background: white; border-radius: 8px;">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${orderItemsHTML}
                <tr class="total-row">
                  <td colspan="3" style="padding: 15px 8px; text-align: right;"><strong>TOTAL:</strong></td>
                  <td style="padding: 15px 8px; text-align: right;"><strong>€${order.total.toFixed(
                    2
                  )}</strong></td>
                </tr>
              </tbody>
            </table>

            ${
              order.status === "PENDING"
                ? `
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #92400E;">Payment pending</h4>
                <p style="margin: 0; color: #92400E;">
                  Your order has been received! Please complete the payment to proceed. You will receive another confirmation email once the payment is completed.
                </p>
              </div>
            `
                : ""
            }

            ${
              order.status === "PAID" || order.status === "COMPLETED"
                ? `
              <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #065F46;">Payment Completed!</h4>
                <p style="margin: 0; color: #065F46;">
                  Your payment has been successfully processed. Your digital products are ready for download!
                </p>
              </div>
            `
                : ""
            }

            <div class="footer">
              <p>If you have any questions about your order, please contact us and include your order number: <strong>${
                order.id
              }</strong></p>
              <p>Digital Store - Your digital products platform</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default EmailService;
