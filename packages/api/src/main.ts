import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'

const logger = new Logger('Bootstrap')

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env['NODE_ENV'] === 'development' }),
    { rawBody: true },
  )

  // Passport-github2 uses Express-style res.setHeader/redirect — Fastify needs the express compat layer
  const fastifyExpress = await import('@fastify/express')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyExpress.default as any)

  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:38929'],
    credentials: true,
  })

  app.setGlobalPrefix('api/v1', { exclude: ['/api/graphql', '/api/docs'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DevPulse API')
    .setDescription('Developer analytics API — REST endpoints (webhooks, auth). Main API is GraphQL at /api/graphql')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env['PORT'] ?? 17642
  await app.listen(Number(port), '0.0.0.0')
  logger.log(`API running on http://localhost:${port}`)
  logger.log(`GraphQL playground: http://localhost:${port}/api/graphql`)
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`)
}

bootstrap().catch((err: unknown) => {
  logger.error('Failed to start application', err)
  process.exit(1)
})
