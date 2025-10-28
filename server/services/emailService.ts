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
    const provider = (process.env.EMAIL_PROVIDER || 'smtp') as 'smtp' | 'resend' | 'sendgrid';
    const from = process.env.EMAIL_FROM || 'noreply@capera.com';

    if (provider === 'smtp') {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true';
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host || !user || !pass) {
        console.warn('Email service not configured: Missing SMTP credentials');
        return;
      }

      this.initialize({
        provider: 'smtp',
        from,
        smtp: { host, port, secure, user, pass },
      });
    } else if (provider === 'resend' || provider === 'sendgrid') {
      const apiKey = process.env.EMAIL_API_KEY;
      if (!apiKey) {
        console.warn(`Email service not configured: Missing ${provider.toUpperCase()} API key`);
        return;
      }

      this.initialize({
        provider,
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
}

export const emailService = new EmailService();
