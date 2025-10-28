import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { assessments, users, competencyElements, notificationSettings, notificationLogs, jobRoles, roleElements } from '@shared/schema';
import { emailService } from './emailService';
import type { NotificationSetting, InsertNotificationLog } from '@shared/schema';

export interface ExpiringAssessment {
  assessmentId: string;
  userId: string;
  userEmail: string;
  userName: string;
  elementName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export class NotificationService {
  async findExpiringAssessments(daysBeforeExpiry: number): Promise<ExpiringAssessment[]> {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const results = await db
      .select({
        assessmentId: assessments.id,
        userId: users.id,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        elementName: competencyElements.name,
        expiryDate: assessments.expiryDate,
      })
      .from(assessments)
      .innerJoin(users, eq(assessments.candidateId, users.id))
      .innerJoin(competencyElements, eq(assessments.elementId, competencyElements.id))
      .where(
        and(
          gte(assessments.expiryDate, startOfDay),
          lte(assessments.expiryDate, endOfDay),
          eq(assessments.outcome, 'competent')
        )
      );

    return results.map(row => ({
      assessmentId: row.assessmentId,
      userId: row.userId,
      userEmail: row.userEmail || '',
      userName: `${row.userFirstName} ${row.userLastName}`,
      elementName: row.elementName,
      expiryDate: row.expiryDate!,
      daysUntilExpiry: daysBeforeExpiry,
    }));
  }

  async findExpiredAssessments(): Promise<ExpiringAssessment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await db
      .select({
        assessmentId: assessments.id,
        userId: users.id,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        elementName: competencyElements.name,
        expiryDate: assessments.expiryDate,
      })
      .from(assessments)
      .innerJoin(users, eq(assessments.candidateId, users.id))
      .innerJoin(competencyElements, eq(assessments.elementId, competencyElements.id))
      .where(
        and(
          lte(assessments.expiryDate, today),
          eq(assessments.outcome, 'competent')
        )
      );

    return results.map(row => {
      const daysUntilExpiry = Math.floor((row.expiryDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        assessmentId: row.assessmentId,
        userId: row.userId,
        userEmail: row.userEmail || '',
        userName: `${row.userFirstName} ${row.userLastName}`,
        elementName: row.elementName,
        expiryDate: row.expiryDate!,
        daysUntilExpiry,
      };
    });
  }

  generateEmailHtml(
    recipientName: string,
    assessments: ExpiringAssessment[],
    notificationType: string
  ): string {
    const isExpiry = notificationType.includes('expiring');
    const title = isExpiry ? 'Upcoming Competence Expiry Notifications' : 'Expired Competence Notifications';
    
    const assessmentRows = assessments.map(a => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${a.elementName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${a.expiryDate.toLocaleDateString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${isExpiry ? `${a.daysUntilExpiry} days` : 'Expired'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #2563eb; color: #ffffff; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
          </div>
          
          <div style="padding: 24px;">
            <p style="margin-top: 0;">Hello ${recipientName},</p>
            
            <p>The following competence assessments require your attention:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Competence Element</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Expiry Date</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${assessmentRows}
              </tbody>
            </table>
            
            <p>Please log in to the Capera platform to update your assessments.</p>
            
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p style="margin: 0;">This is an automated notification from the Capera Skills Management Platform.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendNotifications(setting: NotificationSetting): Promise<number> {
    if (!setting.isEnabled) {
      return 0;
    }

    if (!emailService.isConfigured()) {
      console.warn('Email service not configured. Skipping notifications.');
      return 0;
    }

    let targetAssessments: ExpiringAssessment[] = [];

    if (setting.notificationType === 'expiring_soon' && setting.daysBeforeExpiry) {
      targetAssessments = await this.findExpiringAssessments(setting.daysBeforeExpiry);
    } else if (setting.notificationType === 'expired') {
      targetAssessments = await this.findExpiredAssessments();
    }

    const userAssessments = new Map<string, ExpiringAssessment[]>();
    for (const assessment of targetAssessments) {
      if (!userAssessments.has(assessment.userId)) {
        userAssessments.set(assessment.userId, []);
      }
      userAssessments.get(assessment.userId)!.push(assessment);
    }

    let sentCount = 0;

    for (const [userId, assessments] of Array.from(userAssessments.entries())) {
      const firstAssessment = assessments[0];
      if (!firstAssessment.userEmail) {
        continue;
      }

      const subject = setting.notificationType === 'expiring_soon'
        ? `Competence Expiry Reminder - ${assessments.length} item(s) expiring in ${setting.daysBeforeExpiry} days`
        : `Expired Competence Alert - ${assessments.length} item(s) expired`;

      const html = this.generateEmailHtml(
        firstAssessment.userName,
        assessments,
        setting.notificationType
      );

      const logEntry: InsertNotificationLog = {
        settingId: setting.id,
        recipientId: userId,
        recipientEmail: firstAssessment.userEmail,
        subject,
        body: html,
        status: 'pending',
        sentAt: null,
        errorMessage: null,
        metadata: { assessmentIds: assessments.map((a: ExpiringAssessment) => a.assessmentId) },
      };

      try {
        await emailService.sendEmail({
          to: firstAssessment.userEmail,
          subject,
          html,
        });

        logEntry.status = 'sent';
        logEntry.sentAt = new Date();
        sentCount++;
      } catch (error) {
        logEntry.status = 'failed';
        logEntry.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send email to ${firstAssessment.userEmail}:`, error);
      }

      await db.insert(notificationLogs).values(logEntry);
    }

    return sentCount;
  }

  async runScheduledNotifications(): Promise<{ sent: number; failed: number }> {
    const activeSettings = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.isEnabled, true));

    let totalSent = 0;
    let totalFailed = 0;

    for (const setting of activeSettings) {
      const sent = await this.sendNotifications(setting);
      totalSent += sent;
    }

    return { sent: totalSent, failed: totalFailed };
  }
}

export const notificationService = new NotificationService();
