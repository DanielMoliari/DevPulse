import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common'
import { TEAM_REPOSITORY, type ITeamRepository } from '../../ports/team.repository.port'
import type { TeamEntity, TeamMemberEntity, TeamRole } from '../../domain/team.entity'
import { PrismaService } from '../../../../infrastructure/database/prisma.service'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

@Injectable()
export class TeamService {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teamRepo: ITeamRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createTeam(ownerId: string, name: string): Promise<TeamEntity> {
    const baseSlug = slugify(name)
    let slug = baseSlug
    let i = 1
    while (await this.teamRepo.findBySlug(slug)) {
      slug = `${baseSlug}-${i++}`
    }
    const team = await this.teamRepo.create({ name, slug, ownerId })
    await this.teamRepo.addMember(team.id, ownerId, 'ADMIN')
    return team
  }

  async getMyTeams(userId: string): Promise<TeamEntity[]> {
    return this.teamRepo.findByMember(userId)
  }

  async getTeam(id: string, userId: string): Promise<TeamEntity> {
    const team = await this.teamRepo.findById(id)
    if (!team) throw new NotFoundException('Team not found')
    const membership = await this.teamRepo.getMembership(id, userId)
    if (!membership) throw new ForbiddenException('Not a member of this team')
    return team
  }

  async getMembers(teamId: string, userId: string) {
    await this.assertMember(teamId, userId)
    return this.teamRepo.getMembers(teamId)
  }

  async inviteMember(teamId: string, inviterId: string, email: string, role: TeamRole) {
    await this.assertRole(teamId, inviterId, ['ADMIN', 'MANAGER'])
    const existing = await this.teamRepo.findInviteByEmail(teamId, email)
    if (existing && !existing.usedAt && existing.expiresAt > new Date()) {
      throw new ConflictException('An active invite already exists for this email')
    }
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    return this.teamRepo.createInvite({ teamId, email, role, expiresAt })
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.teamRepo.findInviteByToken(token)
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('Invite not found or expired')
    }
    const existing = await this.teamRepo.getMembership(invite.teamId, userId)
    if (existing) throw new ConflictException('Already a member of this team')
    await this.teamRepo.addMember(invite.teamId, userId, invite.role)
    await this.teamRepo.markInviteUsed(token)
    return this.teamRepo.findById(invite.teamId)
  }

  async removeMember(teamId: string, requesterId: string, targetUserId: string): Promise<void> {
    const team = await this.teamRepo.findById(teamId)
    if (!team) throw new NotFoundException('Team not found')
    if (targetUserId === team.ownerId) throw new ForbiddenException('Cannot remove team owner')
    if (requesterId !== targetUserId) await this.assertRole(teamId, requesterId, ['ADMIN'])
    await this.teamRepo.removeMember(teamId, targetUserId)
  }

  async updateMemberRole(
    teamId: string,
    requesterId: string,
    targetUserId: string,
    role: TeamRole,
  ): Promise<TeamMemberEntity> {
    const team = await this.teamRepo.findById(teamId)
    if (!team) throw new NotFoundException('Team not found')
    if (targetUserId === team.ownerId) throw new ForbiddenException('Cannot change owner role')
    await this.assertRole(teamId, requesterId, ['ADMIN'])
    return this.teamRepo.updateMemberRole(teamId, targetUserId, role)
  }

  async getPendingInvites(teamId: string, userId: string) {
    await this.assertRole(teamId, userId, ['ADMIN', 'MANAGER'])
    return this.teamRepo.getPendingInvites(teamId)
  }

  async deleteTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.teamRepo.findById(teamId)
    if (!team) throw new NotFoundException('Team not found')
    if (team.ownerId !== userId) throw new ForbiddenException('Only the owner can delete the team')
    await this.teamRepo.delete(teamId)
  }

  async joinWaitlist(
    email: string,
    name?: string,
    company?: string,
    teamSize?: string,
    source?: string,
  ) {
    const existing = await this.prisma.waitlistEntry.findUnique({ where: { email } })
    if (existing) return existing
    return this.prisma.waitlistEntry.create({
      data: {
        email,
        name: name ?? null,
        company: company ?? null,
        teamSize: teamSize ?? null,
        source: source ?? 'landing',
      },
    })
  }

  private async assertMember(teamId: string, userId: string) {
    const m = await this.teamRepo.getMembership(teamId, userId)
    if (!m) throw new ForbiddenException('Not a member of this team')
    return m
  }

  private async assertRole(teamId: string, userId: string, roles: TeamRole[]) {
    const m = await this.assertMember(teamId, userId)
    if (!roles.includes(m.role as TeamRole)) throw new ForbiddenException('Insufficient permissions')
    return m
  }
}
