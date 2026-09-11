const nodemailer = require("nodemailer");

/**
 * ==========================================
 * EmailService
 * ------------------------------------------
 * Real SMTP delivery via nodemailer. Credentials come
 * ONLY from environment variables (SMTP_HOST/PORT/USER/
 * PASSWORD/FROM) - never hardcoded, never logged.
 *
 * If SMTP isn't configured, this throws a clear
 * "not configured" error rather than pretending to send
 * or falling back to logging the OTP anywhere. Callers
 * (passwordResetService) are responsible for still
 * returning the generic "if the account exists..."
 * response to the client either way, so a missing SMTP
 * config can never be used to enumerate accounts - it's
 * an operational limitation, logged server-side only.
 * ==========================================
 */
class EmailService {
    constructor() {
        this._transporter = null;
    }

    isConfigured() {
        return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
    }

    _getTransporter() {
        if (this._transporter) return this._transporter;

        if (!this.isConfigured()) {
            const error = new Error("Email delivery is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing).");
            error.code = "EMAIL_NOT_CONFIGURED";
            throw error;
        }

        this._transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });

        return this._transporter;
    }

    /**
     * @param {string} toEmail
     * @param {string} otp exactly 6 digits, plaintext - only ever passed here,
     *   never logged, never returned from an API response.
     * @param {number} expiresInMinutes
     */
    async sendPasswordResetOtp(toEmail, otp, expiresInMinutes) {
        const transporter = this._getTransporter();
        const from = process.env.SMTP_FROM || process.env.SMTP_USER;

        await transporter.sendMail({
            from,
            to: toEmail,
            subject: "Yuna password reset verification code",
            text: `Yuna password reset verification code:\n${otp}\n\nThis code expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
            html: `<p>Yuna password reset verification code:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p><p>This code expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>`
        });
        // Deliberately no logging of `otp` here, or anywhere else.
    }
}

module.exports = new EmailService();
module.exports.EmailService = EmailService;
