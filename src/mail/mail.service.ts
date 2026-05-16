import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly fromAddress: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const allowInvalidTls =
      this.configService.get<string>('SMTP_ALLOW_INVALID_TLS') === 'true';
    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') ??
      `no-reply@${host ?? 'example.com'}`;

    if (!host || !user || !pass) {
      throw new InternalServerErrorException(
        'SMTP mailer is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: !allowInvalidTls,
      },
    });
  }

  async sendVerificationOtpEmail(email: string, name: string, otp: string) {
    const html = this.buildOtpTemplate(name, otp);
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Verify your email with your OTP code',
        html,
      });
    } catch (error) {
      this.logger.error('Failed to send verification email', error as unknown);
      throw new InternalServerErrorException(
        'Unable to send verification email.',
      );
    }
  }

  private buildOtpTemplate(name: string, otp: string) {
    return `
      <div style="background:#f5f7fb;padding:32px;font-family:Inter,system-ui,sans-serif;color:#1f2937;line-height:1.6;">
        <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,0.08);">
          <div style="background:linear-gradient(135deg,#4f46e5 0%,#2563eb 100%);padding:36px 30px;color:#fff;text-align:center;">
            <h1 style="margin:0;font-size:28px;letter-spacing:-0.03em;">Verify your email</h1>
            <p style="margin:12px 0 0;font-size:16px;opacity:0.9;">Complete your registration by entering the OTP below.</p>
          </div>
          <div style="padding:32px 30px;">
            <p style="margin:0 0 18px;font-size:16px;">Hi ${name},</p>
            <p style="margin:0 0 24px;font-size:16px;color:#4b5563;">Thanks for registering. Use the security code below to verify your email address. This code will expire in <strong>10 minutes</strong>.</p>
            <div style="background:#eef2ff;border:1px dashed #c7d2fe;border-radius:18px;padding:28px 16px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:14px;color:#4338ca;text-transform:uppercase;letter-spacing:0.08em;">Your OTP code</p>
              <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:0.12em;color:#1d4ed8;">${otp}</p>
            </div>
            <p style="margin:0 0 16px;font-size:15px;color:#6b7280;">If you did not request this email, you can safely ignore it.</p>
            <p style="margin:0;font-size:15px;color:#6b7280;">Need help? Reply to this email and we’ll be happy to assist.</p>
          </div>
          <div style="background:#f8fafc;padding:24px 30px;text-align:center;font-size:13px;color:#6b7280;">
            <p style="margin:0;">This OTP expires in 10 minutes. For your security, do not share it with anyone.</p>
          </div>
        </div>
      </div>
    `;
  }
}
