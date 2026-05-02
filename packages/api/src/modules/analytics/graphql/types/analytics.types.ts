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

@ObjectType()
export class LanguageBreakdownType {
  @Field() name: string
  @Field(() => Int) bytes: number
  @Field(() => Float) percent: number
}

@ObjectType()
export class RepoCuriosityType {
  @Field() label: string
  @Field() value: string
}

@ObjectType()
export class TechGraphNodeType {
  @Field() id: string
  @Field() type: string  // 'repo' | 'language'
  @Field() name: string
  @Field(() => Float) value: number
}

@ObjectType()
export class TechGraphLinkType {
  @Field() source: string
  @Field() target: string
  @Field(() => Float) value: number
}

@ObjectType()
export class TechGraphType {
  @Field(() => [TechGraphNodeType]) nodes: TechGraphNodeType[]
  @Field(() => [TechGraphLinkType]) links: TechGraphLinkType[]
}

@ObjectType()
export class LanguageSeriesType {
  @Field() language: string
  @Field(() => [Float]) values: number[]
}

@ObjectType()
export class LanguageHistoryType {
  @Field(() => [Int]) years: number[]
  @Field(() => [LanguageSeriesType]) series: LanguageSeriesType[]
}

@ObjectType()
export class RepoDetailType {
  @Field(() => RepositoryType) repository: RepositoryType

  @Field({ nullable: true }) description?: string
  @Field({ nullable: true }) homepage?: string
  @Field() defaultBranch: string

  @Field(() => Int) stars: number
  @Field(() => Int) forks: number
  @Field(() => Int) watchers: number
  @Field(() => Int) openIssues: number
  @Field(() => Int) sizeKb: number

  @Field() createdAt: Date
  @Field({ nullable: true }) pushedAt?: Date

  @Field(() => [String]) topics: string[]
  @Field({ nullable: true }) license?: string

  @Field(() => Int) totalBytes: number
  @Field(() => [LanguageBreakdownType]) languages: LanguageBreakdownType[]

  @Field(() => [DailyMetricsType]) recentMetrics: DailyMetricsType[]
  @Field(() => [RepoCuriosityType]) curiosities: RepoCuriosityType[]
}
