import nodemailer from "nodemailer";
import { OrderResponse } from "../types/order";

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

// EMAIL CONFERMA PROTOTIPO
const generateOrderConfirmationHTML = (order: OrderResponse) => {
  const orderItemsHTML = order.orderItems
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px 8px; font-weight: 500;">${item.product.name}</td>
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
      <title>Conferma Ordine - Digital Store</title>
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
          <h1 style="margin: 0;">Conferma Ordine</h1>
          <p style="margin: 10px 0 0 0;">Grazie per il tuo acquisto!</p>
        </div>
        
        <div class="content">
          <div class="order-info">
            <h2>Dettagli Ordine</h2>
            <p><strong>Numero Ordine:</strong> ${order.id}</p>
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
                    ? "In attesa di pagamento"
                    : order.status === "PAID"
                    ? "Pagamento completato"
                    : order.status === "COMPLETED"
                    ? "Completato"
                    : order.status
                }
              </span>
            </p>
          </div>

          <h3>Prodotti Acquistati</h3>
          <table class="table" style="background: white; border-radius: 8px;">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th style="text-align: center;">Quantità</th>
                <th style="text-align: right;">Prezzo Unit.</th>
                <th style="text-align: right;">Totale</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHTML}
              <tr class="total-row">
                <td colspan="3" style="padding: 15px 8px; text-align: right;"><strong>TOTALE:</strong></td>
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
              <h4 style="margin: 0 0 10px 0; color: #92400E;">Pagamento in sospeso</h4>
              <p style="margin: 0; color: #92400E;">
                Il tuo ordine è stato ricevuto! Completa il pagamento per procedere. 
                Riceverai un'altra email di conferma una volta completato il pagamento.
              </p>
            </div>
          `
              : ""
          }

          ${
            order.status === "PAID" || order.status === "COMPLETED"
              ? `
            <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 10px 0; color: #065F46;">Pagamento Completato!</h4>
              <p style="margin: 0; color: #065F46;">
                Il tuo pagamento è stato elaborato con successo. I tuoi prodotti digitali sono pronti per il download!
              </p>
            </div>
          `
              : ""
          }

          <div class="footer">
            <p>Se hai domande sul tuo ordine, contattaci includendo il numero ordine: <strong>${
              order.id
            }</strong></p>
            <p>Digital Store - La tua piattaforma per prodotti digitali</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// EMAIL CONFERMA ORDINE
export const sendOrderConfirmation = async (
  order: OrderResponse
): Promise<boolean> => {
  try {
    const emailSubject = `Conferma Ordine #${order.id.slice(
      -8
    )} - Digital Store`;
    const emailHTML = generateOrderConfirmationHTML(order);

    await transporter.sendMail({
      from: `"Digital Store" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: emailSubject,
      html: emailHTML,
    });

    console.log(`Order confirmation email sent to: ${order.customerEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
    return false;
  }
};

// EMAIL AGGIORNAMENTO ORDINE
export const sendOrderStatusUpdate = async (
  order: OrderResponse,
  previousStatus?: string
): Promise<boolean> => {
  try {
    let subject = `Aggiornamento Ordine #${order.id.slice(-8)}`;

    if (order.status === "PAID") {
      subject = `Pagamento Completato - Ordine #${order.id.slice(-8)}`;
    } else if (order.status === "COMPLETED") {
      subject = `I tuoi prodotti sono pronti - Ordine #${order.id.slice(-8)}`;
    }

    const emailHTML = generateOrderConfirmationHTML(order);

    await transporter.sendMail({
      from: `"Digital Store" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: subject,
      html: emailHTML,
    });

    console.log(
      `Order status update email sent to: ${order.customerEmail} (${previousStatus} → ${order.status})`
    );
    return true;
  } catch (error) {
    console.error("Failed to send order status update email:", error);
    return false;
  }
};

// VERIFICA CONNESSIONE
export const testEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log("Email service is ready");
    return true;
  } catch (error) {
    console.error("Email service connection failed:", error);
    return false;
  }
};
