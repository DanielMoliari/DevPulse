import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'

export interface JwtPayload {
  sub: string
  githubId: string
  plan: string
  iat: number
  exp: number
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtPayload => {
  if (ctx.getType<string>() === 'graphql') {
    const gqlCtx = GqlExecutionContext.create(ctx)
    return gqlCtx.getContext<{ request: { user: JwtPayload } }>().request.user
  }
  return ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user
})
