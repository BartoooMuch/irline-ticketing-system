const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Email templates
const templates = {
  welcome: (data) => ({
    subject: '🎉 Welcome to Miles&Smiles!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .member-number { font-size: 24px; font-weight: bold; color: #c41e3a; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 30px; background: #c41e3a; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✈️ Miles&Smiles</h1>
            <p>Turkish Airlines Loyalty Program</p>
          </div>
          <div class="content">
            <h2>Welcome, ${data.firstName} ${data.lastName}!</h2>
            <p>Congratulations! You are now a member of Miles&Smiles, the award-winning loyalty program of Turkish Airlines.</p>
            <p>Your member number is:</p>
            <div class="member-number">${data.memberNumber}</div>
            <p>With Miles&Smiles, you can:</p>
            <ul>
              <li>Earn miles on every Turkish Airlines flight</li>
              <li>Redeem miles for award tickets</li>
              <li>Enjoy exclusive member benefits</li>
              <li>Earn miles with partner airlines</li>
            </ul>
            <p>Start earning miles today!</p>
            <a href="#" class="btn">Explore Benefits</a>
          </div>
          <div class="footer">
            <p>This email was sent by Miles&Smiles. Please do not reply to this email.</p>
            <p>© 2024 Turkish Airlines. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to Miles&Smiles, ${data.firstName}!
      
      Your member number is: ${data.memberNumber}
      
      Start earning miles on every Turkish Airlines flight today!
      
      Best regards,
      Miles&Smiles Team
    `,
  }),

  milesUpdate: (data) => ({
    subject: `✨ You've earned ${data.miles} miles!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .miles-box { background: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .miles { font-size: 36px; font-weight: bold; color: #c41e3a; }
          .balance { font-size: 18px; color: #666; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✈️ Miles&Smiles</h1>
            <p>Miles Update</p>
          </div>
          <div class="content">
            <h2>Great news, ${data.firstName}!</h2>
            <p>You've earned miles from ${data.source}:</p>
            <div class="miles-box">
              <div class="miles">+${data.miles.toLocaleString()} Miles</div>
              <div class="balance">New Balance: ${data.newBalance.toLocaleString()} Miles</div>
            </div>
            <p>Keep flying to earn more miles and unlock exclusive rewards!</p>
          </div>
          <div class="footer">
            <p>© 2024 Turkish Airlines. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Great news, ${data.firstName}!
      
      You've earned ${data.miles} miles from ${data.source}!
      
      New Balance: ${data.newBalance} Miles
      
      Best regards,
      Miles&Smiles Team
    `,
  }),

  ticketConfirmation: (data) => ({
    subject: `✈️ Booking Confirmed - ${data.bookingReference}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-ref { font-size: 28px; font-weight: bold; color: #c41e3a; margin: 10px 0; }
          .flight-info { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .route { font-size: 24px; text-align: center; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✈️ Booking Confirmed</h1>
            <p>Turkish Airlines</p>
          </div>
          <div class="content">
            <p>Your booking is confirmed!</p>
            <p>Booking Reference:</p>
            <div class="booking-ref">${data.bookingReference}</div>
            
            <div class="flight-info">
              <div class="route">${data.flight.from} → ${data.flight.to}</div>
              <p><strong>Flight:</strong> ${data.flight.code}</p>
              <p><strong>Date:</strong> ${data.flight.date}</p>
              <p><strong>Time:</strong> ${data.flight.time}</p>
            </div>
            
            <p><strong>Passengers:</strong></p>
            <ul>
              ${data.passengers.map((p) => `<li>${p}</li>`).join('')}
            </ul>
            
            <p><strong>Total:</strong> $${data.totalPrice}</p>
            
            <p>Please arrive at the airport at least 2 hours before departure.</p>
          </div>
          <div class="footer">
            <p>© 2024 Turkish Airlines. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Booking Confirmed!
      
      Booking Reference: ${data.bookingReference}
      
      Flight: ${data.flight.code}
      Route: ${data.flight.from} → ${data.flight.to}
      Date: ${data.flight.date}
      Time: ${data.flight.time}
      
      Passengers: ${data.passengers.join(', ')}
      Total: $${data.totalPrice}
      
      Best regards,
      Turkish Airlines
    `,
  }),
};

// Send email function
const sendEmail = async (to, template, data, pool) => {
  const emailContent = templates[template](data);
  
  try {
    const info = await transporter.sendMail({
      from: `"Miles&Smiles" <${process.env.SMTP_USER}>`,
      to,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    logger.info(`Email sent: ${info.messageId}`);

    // Log to database if pool provided
    if (pool) {
      await pool.query(
        `INSERT INTO notification_log (id, recipient_email, notification_type, subject, status, sent_at)
         VALUES ($1, $2, $3, $4, 'SENT', NOW())`,
        [uuidv4(), to, template.toUpperCase(), emailContent.subject]
      );
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);

    // Log failure to database
    if (pool) {
      await pool.query(
        `INSERT INTO notification_log (id, recipient_email, notification_type, subject, status, error_message)
         VALUES ($1, $2, $3, $4, 'FAILED', $5)`,
        [uuidv4(), to, template.toUpperCase(), emailContent.subject, error.message]
      );
    }

    throw error;
  }
};

module.exports = {
  sendWelcomeEmail: (data) => sendEmail(data.email, 'welcome', data),
  sendMilesUpdateEmail: (data) => sendEmail(data.email, 'milesUpdate', data),
  sendTicketConfirmationEmail: (data) => sendEmail(data.email, 'ticketConfirmation', data),
  sendEmail,
};
