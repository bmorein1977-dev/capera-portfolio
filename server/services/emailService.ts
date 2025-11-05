import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailServiceConfig {
  provider: 'smtp' | 'resend' | 'sendgrid';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  apiKey?: string;
  from: string;
}

class EmailService {
  private config: EmailServiceConfig | null = null;
  private transporter: Transporter | null = null;

  initialize(config: EmailServiceConfig) {
    this.config = config;

    if (config.provider === 'smtp') {
      if (!config.smtp) {
        throw new Error('SMTP configuration is required for SMTP provider');
      }
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    }
  }

  initializeFromEnv() {
    // Skip email configuration in development if not explicitly set
    const isDevelopment = process.env.NODE_ENV === 'development';
    const provider = process.env.EMAIL_SERVICE as 'smtp' | 'resend' | 'sendgrid' | undefined;
    
    // If no EMAIL_SERVICE is set in development, skip initialization
    if (isDevelopment && !provider) {
      console.warn('Email service not configured (development mode). Set EMAIL_SERVICE to enable notifications.');
      return;
    }

    const effectiveProvider = (provider || 'smtp') as 'smtp' | 'resend' | 'sendgrid';
    const from = process.env.EMAIL_FROM || 'noreply@capera.com';

    if (effectiveProvider === 'smtp') {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true';
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host || !user || !pass) {
        const errorMsg = 'Email service configuration error: Missing SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS required)';
        console.error(errorMsg);
        if (!isDevelopment) {
          throw new Error('Email service not configured: Missing SMTP credentials');
        }
        return;
      }

      console.log(`Email service initialized with SMTP provider (${host}:${port})`);
      this.initialize({
        provider: 'smtp',
        from,
        smtp: { host, port, secure, user, pass },
      });
    } else if (effectiveProvider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        const errorMsg = 'Email service configuration error: Missing RESEND_API_KEY';
        console.error(errorMsg);
        if (!isDevelopment) {
          throw new Error('Email service not configured: Missing Resend API key');
        }
        return;
      }

      console.log('Email service initialized with Resend provider');
      this.initialize({
        provider: 'resend',
        from,
        apiKey,
      });
    } else if (effectiveProvider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        const errorMsg = 'Email service configuration error: Missing SENDGRID_API_KEY';
        console.error(errorMsg);
        if (!isDevelopment) {
          throw new Error('Email service not configured: Missing SendGrid API key');
        }
        return;
      }

      console.log('Email service initialized with SendGrid provider');
      this.initialize({
        provider: 'sendgrid',
        from,
        apiKey,
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.config) {
      throw new Error('Email service not initialized. Call initialize() or initializeFromEnv() first.');
    }

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    if (this.config.provider === 'smtp' && this.transporter) {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipients.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      });
    } else if (this.config.provider === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          from: this.config.from,
          to: recipients,
          subject: options.subject,
          html: options.html,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Resend API error: ${JSON.stringify(error)}`);
      }
    } else if (this.config.provider === 'sendgrid') {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          personalizations: recipients.map(email => ({ to: [{ email }] })),
          from: { email: this.config.from },
          subject: options.subject,
          content: [
            {
              type: 'text/html',
              value: options.html,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }
    }
  }

  async sendBulkEmails(emails: EmailOptions[]): Promise<void> {
    for (const email of emails) {
      await this.sendEmail(email);
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  async sendAssessmentOutcomeEmail(
    to: string, 
    data: { 
      candidateName: string;
      elementTitle: string; 
      outcome: string; 
      expiryDate: Date | null;
      assessorName: string;
    }
  ): Promise<void> {
    const formattedOutcome = data.outcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const expiryText = data.expiryDate 
      ? `<p><strong>Expiry / Reassessment due:</strong> ${new Date(data.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` 
      : '';
    
    const subject = `Assessment Outcome: ${data.elementTitle}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Assessment Outcome</h2>
        <p>Dear ${data.candidateName},</p>
        <p>Your assessment for <strong>${data.elementTitle}</strong> has been completed.</p>
        <p><strong>Outcome:</strong> ${formattedOutcome}</p>
        <p><strong>Assessed by:</strong> ${data.assessorName}</p>
        ${expiryText}
        <p>Please log in to your account to view the full details, evidence, and provide feedback if needed.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from the Capera assessment system.</p>
      </div>
    `;

    await this.sendEmail({ to, subject, html });
  }
}

export const emailService = new EmailService();
