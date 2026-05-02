import { Field, Int, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class PublicLanguageType {
  @Field() name: string
  @Field(() => Int) bytes: number
  // Percentage of the user's total tracked source bytes (0-100, two decimals upstream)
  @Field() percent: number
}

@ObjectType()
export class PublicHeatmapDayType {
  @Field() date: Date
  @Field(() => Int) count: number
  @Field(() => Int) level: number
}

@ObjectType()
export class PublicRepoType {
  @Field() fullName: string
  @Field({ nullable: true }) language?: string
}

// Curated, NEVER-leaks-private-data view of a user. Resolver explicitly chooses
// every field from the underlying User row — email, githubId, githubToken, plan
// must never be added here.
@ObjectType()
export class PublicProfileType {
  @Field() username: string
  @Field({ description: 'Falls back to username when name is not set' })
  displayName: string
  @Field({ nullable: true }) avatarUrl?: string
  @Field() joinedAt: Date

  @Field(() => Int, { description: 'Active days in the last 365 days' })
  activeDays: number

  @Field(() => Int, { description: 'Sum of commits across the user lifetime on tracked repos' })
  totalCommits: number

  @Field(() => Int, { nullable: true, description: 'Hidden when the user disables streak sharing' })
  currentStreak?: number

  @Field(() => Int, { nullable: true })
  longestStreak?: number

  @Field(() => [PublicLanguageType], { description: 'Top 5 languages by byte count' })
  topLanguages: PublicLanguageType[]

  @Field(() => [PublicHeatmapDayType], { description: 'Last 365 days of contribution activity' })
  recentActivity: PublicHeatmapDayType[]

  @Field(() => [PublicRepoType], { nullable: true, description: 'Tracked repos — null when the user disables repo sharing' })
  trackedRepos?: PublicRepoType[]
}
