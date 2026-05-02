import { ExecutionContext, Injectable } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  override getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context)
    const gqlCtx = ctx.getContext<{ request?: unknown; req?: unknown }>()
    return gqlCtx.request ?? gqlCtx.req
  }
}
