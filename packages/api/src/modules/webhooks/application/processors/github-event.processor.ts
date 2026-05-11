import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { QUEUE_SYNC_REPOSITORY } from '../../../../infrastructure/queue/queue.module'
import { PrismaService } from '../../../../infrastructure/database/prisma.service'

interface GitHubPushPayload {
  repository: { full_name: string }
}

interface GitHubPRPayload {
  action: string
  pull_request: { merged: boolean }
  repository: { full_name: string }
}

type GitHubEventPayload = GitHubPushPayload | GitHubPRPayload

@Injectable()
export class GitHubEventProcessor {
  private readonly logger = new Logger(GitHubEventProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_SYNC_REPOSITORY) private readonly syncQueue: Queue,
  ) {}

  async handleEvent(eventType: string, payload: GitHubEventPayload): Promise<void> {
    const fullName = payload.repository.full_name

    if (eventType === 'push' || (eventType === 'pull_request' && this.isPRMerged(payload))) {
      await this.enqueueSync(fullName)
    }
  }

  private isPRMerged(payload: GitHubEventPayload): boolean {
    const pr = payload as GitHubPRPayload
    return pr.action === 'closed' && pr.pull_request?.merged === true
  }

  private async enqueueSync(fullName: string): Promise<void> {
    const repo = await this.prisma.repository.findFirst({
      where: { fullName, isTracked: true },
    })

    if (!repo) {
      this.logger.debug(`No tracked repo found for ${fullName}, skipping sync`)
      return
    }

    await this.syncQueue.add(
      'sync',
      { userId: repo.userId, repositoryId: repo.id, fullName },
      { jobId: `sync-${repo.id}`, removeOnComplete: true },
    )

    this.logger.log(`Webhook triggered sync for ${fullName}`)
  }
}
