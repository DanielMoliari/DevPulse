import { ObjectType, Field, ID, registerEnumType, InputType } from '@nestjs/graphql'

export enum TeamRoleEnum {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}
registerEnumType(TeamRoleEnum, { name: 'TeamRole' })

@ObjectType()
export class TeamMemberUserType {
  @Field(() => ID)
  id: string

  @Field()
  name: string

  @Field({ nullable: true })
  username?: string

  @Field({ nullable: true })
  avatarUrl?: string

  @Field()
  plan: string
}

@ObjectType()
export class TeamMemberType {
  @Field(() => ID)
  id: string

  @Field()
  teamId: string

  @Field()
  userId: string

  @Field(() => TeamRoleEnum)
  role: TeamRoleEnum

  @Field()
  joinedAt: Date

  @Field(() => TeamMemberUserType, { nullable: true })
  user?: TeamMemberUserType
}

@ObjectType()
export class TeamInviteType {
  @Field(() => ID)
  id: string

  @Field()
  teamId: string

  @Field()
  email: string

  @Field(() => TeamRoleEnum)
  role: TeamRoleEnum

  @Field()
  token: string

  @Field()
  expiresAt: Date

  @Field({ nullable: true })
  usedAt?: Date

  @Field()
  createdAt: Date
}

@ObjectType()
export class TeamType {
  @Field(() => ID)
  id: string

  @Field()
  name: string

  @Field()
  slug: string

  @Field()
  ownerId: string

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date

  @Field(() => [TeamMemberType], { nullable: true })
  members?: TeamMemberType[]
}

@InputType()
export class CreateTeamInput {
  @Field()
  name: string
}

@InputType()
export class InviteMemberInput {
  @Field()
  teamId: string

  @Field()
  email: string

  @Field(() => TeamRoleEnum)
  role: TeamRoleEnum
}

@InputType()
export class UpdateMemberRoleInput {
  @Field()
  teamId: string

  @Field()
  userId: string

  @Field(() => TeamRoleEnum)
  role: TeamRoleEnum
}

@ObjectType()
export class WaitlistEntryType {
  @Field(() => ID)
  id: string

  @Field()
  email: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  company?: string

  @Field({ nullable: true })
  teamSize?: string

  @Field()
  createdAt: Date
}

@InputType()
export class JoinWaitlistInput {
  @Field()
  email: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  company?: string

  @Field({ nullable: true })
  teamSize?: string

  @Field({ nullable: true })
  source?: string
}
