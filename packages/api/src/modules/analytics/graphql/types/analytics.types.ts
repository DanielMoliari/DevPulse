import { Field, Float, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql'
import { SyncState } from '@prisma/client'

registerEnumType(SyncState, { name: 'SyncState' })

export enum HeatmapMetric {
  COMMITS = 'COMMITS',
  LINES = 'LINES',
  CHURN = 'CHURN',
  PRS = 'PRS',
}

registerEnumType(HeatmapMetric, { name: 'HeatmapMetric' })

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

  @Field(() => Int, { nullable: true })
  commitCount?: number

  @Field(() => Int, { nullable: true })
  linesAdded?: number

  @Field({ nullable: true })
  pushedAt?: Date
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

  @Field(() => Int)
  freezesUsed: number
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

@ObjectType()
export class ImportResultType {
  @Field(() => Int)
  imported: number

  @Field(() => Int)
  tracked: number
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
export class HourlyActivityType {
  @Field(() => [Int]) hours: number[]      // 24-element array, commits per UTC hour summed across all-time
  @Field(() => Int) peakHour: number        // 0-23
  @Field(() => Float) peakRatio: number     // peak / mean
}

@ObjectType()
export class BurnoutSignalType {
  @Field() atRisk: boolean
  @Field(() => Int) consecutiveDays: number
  @Field(() => Float) netLinesTrend: number // % change last 7d vs prior 7d (negative = declining)
  @Field() message: string
}

@ObjectType()
export class TechGraduationType {
  @Field() from: string                     // "JavaScript"
  @Field() to: string                       // "TypeScript"
  @Field(() => Int) year: number            // 2024
  @Field(() => Float) confidence: number    // 0..1 — how clean the transition was
  @Field() message: string
}

@ObjectType()
export class InsightsType {
  @Field(() => HourlyActivityType, { nullable: true }) hourlyActivity?: HourlyActivityType
  @Field(() => BurnoutSignalType, { nullable: true }) burnout?: BurnoutSignalType
  @Field(() => [TechGraduationType]) techGraduations: TechGraduationType[]
}

@ObjectType()
export class HealthBreakdownType {
  @Field(() => Float) churn: number
  @Field(() => Float) consistency: number
  @Field(() => Float) mergeRate: number
  @Field(() => Float) cadence: number
}

@ObjectType()
export class CodeHealthType {
  @Field(() => Float) score: number
  @Field() grade: string
  @Field(() => HealthBreakdownType) breakdown: HealthBreakdownType
}

@ObjectType()
export class PrImpactType {
  @Field(() => Int) number: number
  @Field() title: string
  @Field() state: string
  @Field() category: string
  @Field() createdAt: Date
  @Field({ nullable: true }) mergedAt?: Date
  @Field(() => Int) filesChanged: number
  @Field(() => Int) additions: number
  @Field(() => Int) deletions: number
}


@ObjectType()
export class FileHotspotType {
  @Field() path: string
  @Field(() => Int) commits: number
  @Field(() => Int) additions: number
  @Field(() => Int) deletions: number
  @Field(() => Float, { nullable: true }) churnRatio?: number | null
}

@ObjectType()
export class FileOwnershipType {
  @Field(() => Int) ownedFiles: number
  @Field(() => Int) totalFiles: number
  @Field(() => Float) ownershipPercent: number
}

@ObjectType()
export class EcosystemConnectionType {
  @Field() repoFullName: string
  @Field() ecosystem: string
  @Field(() => [String]) sharedDeps: string[]
  @Field(() => Int) sharedCount: number
  @Field(() => Float) overlapScore: number
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

  @Field(() => CodeHealthType, { nullable: true }) health?: CodeHealthType
  @Field(() => [PrImpactType], { nullable: true }) prsDetail?: PrImpactType[]
  @Field(() => [EcosystemConnectionType], { nullable: true }) ecosystemConnections?: EcosystemConnectionType[]
  @Field(() => FileOwnershipType, { nullable: true }) fileOwnership?: FileOwnershipType
  @Field(() => [FileHotspotType], { nullable: true }) fileHotspots?: FileHotspotType[]
}

@ObjectType()
export class PersonalRecordItemType {
  @Field(() => Int) today: number
  @Field(() => Int) allTimeBest: number
  @Field() isRecord: boolean
}

@ObjectType()
export class PersonalRecordsType {
  @Field(() => PersonalRecordItemType) commits: PersonalRecordItemType
  @Field(() => PersonalRecordItemType) additions: PersonalRecordItemType
  @Field(() => PersonalRecordItemType) netLines: PersonalRecordItemType
  @Field() hasNewRecord: boolean
}
