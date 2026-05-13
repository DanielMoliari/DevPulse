import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Plan } from '@prisma/client'
import { PrismaService } from '../../../../infrastructure/database/prisma.service'
import { BILLING_PORT, type IBillingPort } from '../../ports/billing.port'

interface StripeCheckoutSessionLike {
  client_reference_id?: string | null
  customer?: string | null
  subscription?: string | null
  metadata?: Record<string, string> | null
  // expanded subscription object when retrieve is called
  subscription_details?: { current_period_end?: number } | null
}

interface StripeSubscriptionLike {
  id: string
  status: string
  current_period_end: number | null
  cancel_at_period_end?: boolean
  items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> }
  metadata?: Record<string, string> | null
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)

  constructor(
    @Inject(BILLING_PORT) private readonly billing: IBillingPort,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.billing.isConfigured()
  }

  async createCheckoutSession(
    userId: string,
    plan: 'PRO' | 'TEAM',
    interval: 'monthly' | 'yearly',
  ): Promise<{ url: string }> {
    if (!this.billing.isConfigured()) {
      throw new ForbiddenException(
        'Billing is not yet available — payments will be enabled soon. Check back next week.',
      )
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    const baseUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:38929'
    const result = await this.billing.createCheckoutSession({
      userId,
      customerId: user.stripeCustomerId,
      customerEmail: user.email,
      plan,
      interval,
      successUrl: `${baseUrl}/settings?billing=success`,
      cancelUrl: `${baseUrl}/settings?billing=canceled`,
    })
    return { url: result.url }
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    if (!this.billing.isConfigured()) {
      throw new ForbiddenException('Billing is not configured')
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.stripeCustomerId) {
      throw new NotFoundException('No active subscription — nothing to manage')
    }
    const baseUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:38929'
    return this.billing.createPortalSession(user.stripeCustomerId, `${baseUrl}/settings`)
  }

  async handleWebhookEvent(type: string, data: unknown): Promise<void> {
    this.logger.log(`Webhook received: ${type}`)

    if (type === 'checkout.session.completed') {
      const session = data as StripeCheckoutSessionLike
      const userId = session.client_reference_id ?? session.metadata?.['userId']
      const planRaw = session.metadata?.['plan']
      const interval = session.metadata?.['interval']
      if (!userId || !planRaw) {
        this.logger.warn('checkout.session.completed missing userId or plan')
        return
      }
      const plan = planRaw as Plan
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: session.customer ?? null,
          stripeSubscriptionId: session.subscription ?? null,
          subscriptionStatus: 'active',
          plan,
          billingInterval: interval ?? 'monthly',
        },
      })
      this.logger.log(`User ${userId} upgraded to ${plan}`)
      return
    }

    if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const sub = data as StripeSubscriptionLike
      const user = await this.prisma.user.findFirst({ where: { stripeSubscriptionId: sub.id } })
      if (!user) return

      const isCanceled = ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)
      const interval = sub.items?.data?.[0]?.price?.recurring?.interval
      const billingInterval = interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : undefined

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: sub.cancel_at_period_end ? 'canceled' : sub.status,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          ...(billingInterval ? { billingInterval } : {}),
          ...(isCanceled ? { plan: 'FREE' as Plan, stripeSubscriptionId: null } : {}),
        },
      })
      this.logger.log(`Subscription for user ${user.id} updated: status=${sub.status}`)
    }
  }

  async updateAutoSyncPrefs(
    userId: string,
    prefs: { autoSyncEnabled?: boolean; autoSyncIntervalHours?: number },
  ): Promise<void> {
    if (prefs.autoSyncIntervalHours !== undefined && ![1, 6, 24].includes(prefs.autoSyncIntervalHours)) {
      throw new ForbiddenException('Invalid interval — must be 1, 6, or 24 hours')
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(prefs.autoSyncEnabled !== undefined ? { autoSyncEnabled: prefs.autoSyncEnabled } : {}),
        ...(prefs.autoSyncIntervalHours !== undefined ? { autoSyncIntervalHours: prefs.autoSyncIntervalHours } : {}),
      },
    })
  }
}
