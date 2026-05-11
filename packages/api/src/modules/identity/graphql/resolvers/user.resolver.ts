import { NotFoundException, UseGuards } from '@nestjs/common'
import { Args, Field, InputType, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql'
import { GqlAuthGuard } from '../../../../common/guards/gql-auth.guard'
import { CurrentUser, type JwtPayload } from '../../../../common/decorators/current-user.decorator'
import { IdentityService } from '../../application/services/identity.service'
import { UpdateProfileInput } from '../types/update-profile.input'
import { UserType } from '../types/user.type'

@InputType()
class UpdatePublicProfilePrefsInput {
  @Field({ nullable: true }) showRepos?: boolean
  @Field({ nullable: true }) showStreak?: boolean
}

@ObjectType()
class PlatformStatsType {
  @Field() userCount: number
  @Field() commitCount: number
}

@Resolver(() => UserType)
export class UserResolver {
  constructor(private readonly identityService: IdentityService) {}

  @Query(() => UserType, { nullable: true, description: 'Get the authenticated user profile' })
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() currentUser: JwtPayload): Promise<UserType | null> {
    const user = await this.identityService.findById(currentUser.sub)
    if (!user) return null
    return user as unknown as UserType
  }

  @Query(() => PlatformStatsType, { description: 'Public platform stats for the landing page' })
  async platformStats(): Promise<PlatformStatsType> {
    return this.identityService.getPlatformStats()
  }

  @Mutation(() => UserType, { description: 'Update the authenticated user profile' })
  @UseGuards(GqlAuthGuard)
  async updateProfile(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateProfileInput,
  ): Promise<UserType> {
    const user = await this.identityService.updateProfile(currentUser.sub, input)
    if (!user) throw new NotFoundException('User not found')
    return user as unknown as UserType
  }

  @Mutation(() => UserType, { description: 'Update public profile visibility preferences' })
  @UseGuards(GqlAuthGuard)
  async updatePublicProfilePrefs(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdatePublicProfilePrefsInput,
  ): Promise<UserType> {
    const user = await this.identityService.updatePublicProfilePrefs(currentUser.sub, {
      ...(input.showRepos !== undefined ? { showRepos: input.showRepos } : {}),
      ...(input.showStreak !== undefined ? { showStreak: input.showStreak } : {}),
    })
    return user as unknown as UserType
  }

  @Mutation(() => Boolean, { description: 'Permanently delete the authenticated user account and all data' })
  @UseGuards(GqlAuthGuard)
  async deleteAccount(@CurrentUser() currentUser: JwtPayload): Promise<boolean> {
    return this.identityService.deleteAccount(currentUser.sub)
  }
}
