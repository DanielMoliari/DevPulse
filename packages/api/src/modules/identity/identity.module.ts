import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { EncryptionService } from '../../infrastructure/crypto/encryption.service'
import { JwtStrategy } from './application/strategies/jwt.strategy'
import { IdentityService } from './application/services/identity.service'
import { AuthController } from './infrastructure/http/auth.controller'
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository'
import { USER_REPOSITORY } from './ports/user.repository.port'
import { UserResolver } from './graphql/resolvers/user.resolver'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') as `${number}${'s'|'m'|'h'|'d'}` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    IdentityService,
    EncryptionService,
    JwtStrategy,
    UserResolver,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
