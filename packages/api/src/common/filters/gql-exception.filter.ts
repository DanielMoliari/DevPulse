import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { GqlExceptionFilter } from '@nestjs/graphql'
import { GraphQLError } from 'graphql'

@Catch()
export class GqlAllExceptionsFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GqlAllExceptionsFilter.name)

  catch(exception: unknown, _host: ArgumentsHost): GraphQLError {
    if (exception instanceof HttpException) {
      return new GraphQLError(exception.message, {
        extensions: { code: this.httpStatusToCode(exception.getStatus()) },
      })
    }

    if (exception instanceof GraphQLError) return exception

    this.logger.error('Unhandled GraphQL error', exception)
    return new GraphQLError('Internal server error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    })
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      402: 'PLAN_LIMIT_EXCEEDED',
    }
    return map[status] ?? 'INTERNAL_SERVER_ERROR'
  }
}
