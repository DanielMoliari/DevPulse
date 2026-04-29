import { Field, Float, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql'
import { SyncState } from '@prisma/client'

registerEnumType(SyncState, { name: 'SyncState' })

@ObjectType()
export class RepositoryType {
  @Field(() => ID)
  id: string

  @Field()
  fullName: string

  @Field({ nullable: true })
  language?: string

  @Field()
  isTracked: boolean

  @Field(() => SyncState)
  syncState: SyncState

  @Field({ nullable: true })
  lastSyncedAt?: Date
}

@ObjectType()
export class DailyMetricsType {
  @Field(() => ID)
  id: string

  @Field()
  date: Date

  @Field(() => Int)
  commits: number

  @Field(() => Int)
  additions: number

  @Field(() => Int)
  deletions: number

  @Field(() => Int)
  prsOpened: number

  @Field(() => Int)
  prsMerged: number

  @Field(() => Int)
  reviewsDone: number

  @Field(() => Int)
  netLines: number

  @Field(() => Float, { nullable: true })
  churnRatio?: number
}

@ObjectType()
export class StreakType {
  @Field(() => Int)
  currentStreak: number

  @Field(() => Int)
  longestStreak: number

  @Field({ nullable: true })
  lastActiveDate?: Date
}

@ObjectType()
export class HeatmapDayType {
  @Field()
  date: Date

  @Field(() => Int)
  count: number

  @Field(() => Int)
  level: number
}

@ObjectType()
export class SyncResultType {
  @Field(() => ID)
  repositoryId: string

  @Field()
  queued: boolean
}

@InputType()
export class MetricsRangeInput {
  @Field()
  from: Date

  @Field()
  to: Date

  @Field({ nullable: true })
  repositoryId?: string
}
