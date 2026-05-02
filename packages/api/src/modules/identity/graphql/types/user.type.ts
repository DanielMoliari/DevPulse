import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql'
import { Plan } from '@prisma/client'

registerEnumType(Plan, { name: 'Plan', description: 'User subscription plan' })

@ObjectType()
export class UserType {
  @Field(() => ID)
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true, description: 'GitHub-style display handle — falls back to name or githubId' })
  username?: string

  @Field({ nullable: true })
  email?: string

  @Field({ nullable: true })
  avatarUrl?: string

  @Field(() => Plan)
  plan: Plan

  @Field()
  githubId: string

  @Field()
  createdAt: Date
}
