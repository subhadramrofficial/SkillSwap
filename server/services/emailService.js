const nodemailer = require('nodemailer');

class EmailService {
  /**
   * Helper to get current SMTP configuration from environment dynamically
   */
  getConfig() {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : '';
    const pass = process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.trim() : '';
    const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

    // Use custom EMAIL_FROM if set and valid, otherwise default to user's authenticated address
    let from = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : '';
    if (!from || from.includes('@skillswap.local')) {
      from = user ? `"SkillSwap" <${user}>` : '"SkillSwap" <no-reply@skillswap.com>';
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return { host, port, user, pass, secure, from, frontendUrl };
  }

  /**
   * Check whether real SMTP credentials are provided in the environment
   */
  isConfigured() {
    const config = this.getConfig();
    return Boolean(config.host && config.user && config.pass);
  }

  /**
   * Create nodemailer transporter if credentials are valid
   */
  getTransporter() {
    if (!this.isConfigured()) {
      return null;
    }

    const config = this.getConfig();

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // false for 587 (STARTTLS), true for 465
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  /**
   * Verify whether the configured SMTP connection works
   */
  async verifyConnection() {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        configured: false,
        success: false,
        message: 'SMTP credentials (EMAIL_USER or EMAIL_PASSWORD) are not configured in .env',
      };
    }

    try {
      await transporter.verify();
      return {
        configured: true,
        success: true,
        message: 'SMTP connection verified successfully',
      };
    } catch (err) {
      return {
        configured: true,
        success: false,
        code: err.code || 'UNKNOWN',
        responseCode: err.responseCode,
        message: err.message,
      };
    }
  }

  /**
   * Send a password reset email containing a secure link
   * @param {Object} options
   * @param {string} options.to - Recipient email (looked up in MongoDB)
   * @param {string} options.name - User's name
   * @param {string} options.resetUrl - Full reset link URL
   * @param {string} options.resetToken - Raw single-use token
   */
  async sendPasswordResetEmail({ to, name, resetUrl, resetToken }) {
    const config = this.getConfig();
    const transporter = this.getTransporter();

    const subject = 'Reset Your SkillSwap Password';
    const textContent = `Hello ${name},\n\nYou requested a password reset for your SkillSwap account.\n\nPlease click the link below or copy and paste it into your browser to reset your password:\n${resetUrl}\n\nThis link is valid for 15 minutes. If you did not request this, please ignore this email and your password will remain unchanged.\n\nBest regards,\nThe SkillSwap Team`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #f8fafc; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SkillSwap</h1>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Peer-to-Peer Knowledge Sharing</p>
        </div>

        <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; margin-bottom: 12px;">Password Reset Request</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Hello <strong>${name}</strong>,<br/>
            We received a request to reset your password for your SkillSwap account. Click the button below to choose a new password.
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #10b981; color: #020617; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; display: inline-block;">
              Reset Password
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-top: 20px;">
            Or copy and paste this link in your browser:<br/>
            <a href="${resetUrl}" style="color: #38bdf8; word-break: break-all; font-size: 12px;">${resetUrl}</a>
          </p>
        </div>

        <div style="font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #1e293b; padding-top: 16px;">
          <p style="margin: 0 0 8px 0;">⚠️ This link will expire in <strong>15 minutes</strong> for security reasons.</p>
          <p style="margin: 0;">If you did not make this request, you can safely ignore this email. Your account remains secure.</p>
        </div>
      </div>
    `;

    if (!transporter) {
      console.error('[Email Service] Cannot send email - SMTP credentials are not configured in .env');
      const err = new Error('SMTP credentials are not configured in environment variables');
      err.code = 'ENOCONFIG';
      throw err;
    }

    try {
      // Send actual email via configured SMTP
      const info = await transporter.sendMail({
        from: config.from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Application': 'SkillSwap',
          'X-Priority': '1',
        },
      });

      // Verify recipient was accepted
      if (info.rejected && info.rejected.length > 0 && info.rejected.includes(to)) {
        console.error(`[Email Service] Recipient ${to} was rejected by SMTP server`);
        const rejErr = new Error(`Recipient ${to} was rejected by the mail server`);
        rejErr.code = 'ERECIPIENTREJECTED';
        throw rejErr;
      }

      console.log(`[Email Service] Password reset email accepted by SMTP server for ${to}. MessageId: ${info.messageId}, Response: ${info.response}`);
      return {
        sent: true,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      };
    } catch (err) {
      // Structured error logging without leaking secrets or passwords
      console.error('[Email Service Error]', {
        code: err.code || 'UNKNOWN',
        responseCode: err.responseCode || null,
        command: err.command || null,
        recipient: to,
        errorMessage: err.message,
      });

      // In non-production, log the reset URL to console so development is never blocked
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Email Service Fallback] In development, reset URL is: ${resetUrl}`);
      }

      // Re-throw with clean metadata
      const customErr = new Error(err.message || 'Failed to send email via SMTP');
      customErr.code = err.code || 'ESMTP';
      customErr.responseCode = err.responseCode;
      throw customErr;
    }
  }
}

module.exports = new EmailService();
