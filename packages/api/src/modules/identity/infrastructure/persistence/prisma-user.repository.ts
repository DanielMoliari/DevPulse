import { Injectable } from '@nestjs/common'
import type { User } from '@prisma/client'
import { PrismaService } from '../../../../infrastructure/database/prisma.service'
import type { IUserRepository, UpdatePublicProfileData } from '../../ports/user.repository.port'

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  findByGithubId(githubId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { githubId } })
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } })
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } })
  }

  upsertFromGitHub(data: {
    githubId: string
    name: string | null
    email: string | null
    avatarUrl: string | null
    encryptedToken: string
  }): Promise<User> {
    return this.prisma.user.upsert({
      where: { githubId: data.githubId },
      create: {
        githubId: data.githubId,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl,
        githubToken: data.encryptedToken,
      },
      update: {
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl,
        githubToken: data.encryptedToken,
        updatedAt: new Date(),
      },
    })
  }

  updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data })
  }

  updatePublicProfile(userId: string, data: UpdatePublicProfileData): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data })
  }
}
