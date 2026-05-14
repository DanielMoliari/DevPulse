import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import type { DigestSummaryData, INotificationService } from '../../ports/notification.port'

@Injectable()
export class ResendAdapter implements INotificationService {
  private readonly logger = new Logger(ResendAdapter.name)
  private readonly fromAddress: string
  private _resend: Resend | null = null

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = configService.get<string>('EMAIL_FROM', 'digest@reflog.dev')
  }

  // Lazy init — Resend only matters when we actually try to send. Lets the API boot without RESEND_API_KEY in dev.
  private get resend(): Resend | null {
    if (this._resend) return this._resend
    const apiKey = this.configService.get<string>('RESEND_API_KEY')
    if (!apiKey) return null
    this._resend = new Resend(apiKey)
    return this._resend
  }

  async sendWeeklyDigest(
    _userId: string,
    email: string,
    weekStart: Date,
    summary: DigestSummaryData,
  ): Promise<void> {
    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — skipping digest email to ${email}`)
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: email,
        subject: `Your reflog week in review — ${weekLabel}`,
        html: this.buildDigestHtml(weekLabel, summary),
      })
      this.logger.log(`Weekly digest sent to ${email}`)
    } catch (err: unknown) {
      this.logger.error(`Failed to send digest to ${email}`, err)
    }
  }

  async sendStreakAlert(_userId: string, email: string, streakLength: number): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — skipping streak alert to ${email}`)
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: email,
        subject: `🔥 ${streakLength}-day streak broken — come back!`,
        html: `<p>Your ${streakLength}-day coding streak just ended. Start a new one today!</p>`,
      })
    } catch (err: unknown) {
      this.logger.error(`Failed to send streak alert to ${email}`, err)
    }
  }

  async sendWelcomeEmail(_userId: string, email: string, displayName: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — skipping welcome email to ${email}`)
      return
    }
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: email,
        subject: `Welcome to reflog, ${displayName} 👋`,
        html: this.buildWelcomeHtml(displayName),
      })
      this.logger.log(`Welcome email sent to ${email}`)
    } catch (err: unknown) {
      this.logger.error(`Failed to send welcome email to ${email}`, err)
    }
  }

  private buildWelcomeHtml(displayName: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://reflog.app'
    return `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#e2e2e2;padding:32px;border-radius:12px;">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;color:#fff;">Hey ${displayName}, welcome to reflog 👋</h1>
        <p style="color:#888;margin-bottom:24px;font-size:15px;line-height:1.6;">
          reflog tracks your coding life — commit streaks, PR throughput, code review patterns, and language trends.
          Think of it as your personal engineering record, always up to date.
        </p>

        <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">What reflog tracks for you</p>
          <ul style="margin:0;padding:0;list-style:none;color:#c4c4c4;font-size:14px;line-height:2;">
            <li>🔥 Commit streaks and milestone celebrations</li>
            <li>📊 PR throughput and code review patterns</li>
            <li>📈 Language evolution over time</li>
            <li>🗺️ Contribution heatmaps across all your repos</li>
          </ul>
        </div>

        <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:20px;margin-bottom:28px;">
          <p style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Get started in 3 steps</p>
          <ol style="margin:0;padding-left:18px;color:#c4c4c4;font-size:14px;line-height:2.2;">
            <li>Open your dashboard and go to <strong style="color:#e2e2e2;">Repos</strong></li>
            <li>Click <strong style="color:#e2e2e2;">Track</strong> on any repository you want to follow</li>
            <li>Share your public profile link — show the world your streak</li>
          </ol>
        </div>

        <a href="${appUrl}/dashboard" style="display:inline-block;background:#06b6d4;color:#fff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:8px;">
          Open your dashboard →
        </a>

        <p style="margin-top:32px;color:#555;font-size:12px;">
          You're receiving this because you signed up for reflog. If this wasn't you, you can safely ignore this email.
        </p>
      </div>
    `
  }

  private buildDigestHtml(weekLabel: string, s: DigestSummaryData): string {
    return `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#e2e2e2;padding:32px;border-radius:12px;">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;">Week of ${weekLabel}</h1>
        <p style="color:#888;margin-bottom:24px;">Your reflog summary</p>
        <div style="display:grid;gap:12px;">
          <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.08em;">Commits</div>
            <div style="font-size:32px;font-weight:700;color:#fff;">${s.totalCommits}</div>
          </div>
          <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.08em;">PRs Merged</div>
            <div style="font-size:32px;font-weight:700;color:#7c3aed;">${s.totalPrsMerged}</div>
          </div>
          <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.08em;">Active Days</div>
            <div style="font-size:32px;font-weight:700;color:#fff;">${s.activeDays}/7</div>
          </div>
          ${s.topRepository ? `<p style="color:#888;font-size:14px;">Top repo: <strong style="color:#e2e2e2;">${s.topRepository}</strong></p>` : ''}
        </div>
      </div>
    `
  }
}
