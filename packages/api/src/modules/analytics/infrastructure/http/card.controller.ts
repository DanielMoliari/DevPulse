import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { Res } from '@nestjs/common'
import { PublicProfileService } from '../../application/services/public-profile.service'
import { renderProfileCard, renderNotFoundCard } from './card.svg'

@ApiTags('card')
@Controller('card')
export class CardController {
  constructor(private readonly publicProfileService: PublicProfileService) {}

  @Get(':username')
  @ApiOperation({
    summary: 'Embeddable SVG profile card',
    description:
      'Returns an SVG image suitable for embedding in a GitHub README via ![](https://reflog.dev/api/v1/card/{username}). Cached by CDN for 1 hour.',
  })
  @ApiParam({ name: 'username', description: 'reflog public username' })
  @ApiProduces('image/svg+xml')
  async getCard(
    @Param('username') username: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const profile = await this.publicProfileService.getPublicProfile(username)

    const svg = profile ? renderProfileCard(profile) : renderNotFoundCard(username)

    await reply
      .status(200)
      .headers({
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(svg)
  }
}
