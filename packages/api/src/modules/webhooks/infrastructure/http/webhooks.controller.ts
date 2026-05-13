import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { GitHubEventProcessor } from '../../application/processors/github-event.processor'

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(private readonly eventProcessor: GitHubEventProcessor) {}

  @Post('github')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive GitHub webhook events' })
  async handleGitHubEvent(
    @RawBody() rawBody: Buffer,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') eventType: string | undefined,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    if (!eventType) throw new BadRequestException('Missing X-GitHub-Event header')

    const webhookSecret = process.env['GITHUB_WEBHOOK_SECRET']
    if (!webhookSecret) throw new Error('GITHUB_WEBHOOK_SECRET is not configured')
    if (!signature) throw new UnauthorizedException('Missing webhook signature')
    this.verifySignature(rawBody ?? Buffer.alloc(0), signature, webhookSecret)

    this.logger.log(`Received GitHub event: ${eventType}`)

    // Process asynchronously — respond to GitHub immediately
    setImmediate(() => {
      this.eventProcessor.handleEvent(eventType, payload as never).catch((err: unknown) =>
        this.logger.error(`Event processing failed for ${eventType}`, err),
      )
    })

    return { received: true }
  }

  private verifySignature(body: Buffer, signature: string, secret: string): void {
    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    const sigBuffer = Buffer.from(signature)
    const expBuffer = Buffer.from(expected)

    if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
      throw new UnauthorizedException('Invalid webhook signature')
    }
  }
}
