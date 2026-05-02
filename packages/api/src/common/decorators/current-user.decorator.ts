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
    const c = gqlCtx.getContext<{ request?: { user: JwtPayload }; req?: { user: JwtPayload } }>()
    const req = c.request ?? c.req
    if (!req) throw new Error('No request found in GraphQL context')
    return req.user
  }
  return ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user
})
