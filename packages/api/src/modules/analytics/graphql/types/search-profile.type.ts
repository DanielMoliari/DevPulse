import { Field, Float, Int, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class RepoContributorType {
  @Field()
  login!: string

  @Field({ nullable: true })
  avatarUrl?: string

  @Field(() => Int)
  contributions!: number
}

@ObjectType()
export class RepoLanguageType {
  @Field()
  name!: string

  @Field(() => Int)
  bytes!: number

  @Field(() => Float)
  percent!: number
}

@ObjectType()
export class RepoCommitWeekType {
  @Field(() => Int)
  week!: number

  @Field(() => Int)
  total!: number
}

@ObjectType()
export class SearchRepoResultType {
  @Field()
  fullName!: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  primaryLanguage?: string

  @Field(() => Int)
  stars!: number

  @Field(() => Int)
  forks!: number

  @Field(() => Int)
  openIssues!: number

  @Field(() => Int)
  sizeKb!: number

  @Field()
  createdAt!: string

  @Field()
  pushedAt!: string

  @Field({ nullable: true })
  homepage?: string

  @Field(() => [String])
  topics!: string[]

  @Field(() => [RepoLanguageType])
  languages!: RepoLanguageType[]

  @Field(() => [RepoContributorType])
  contributors!: RepoContributorType[]

  @Field(() => [RepoCommitWeekType])
  weeklyCommits!: RepoCommitWeekType[]
}

@ObjectType()
export class SearchProfileLanguageType {
  @Field()
  name!: string

  @Field(() => Float)
  percent!: number
}

@ObjectType()
export class SearchProfileRepoType {
  @Field()
  fullName!: string

  @Field({ nullable: true })
  language?: string

  @Field(() => Int)
  stargazersCount!: number
}

@ObjectType()
export class SearchProfileResultType {
  @Field()
  source!: string

  @Field()
  username!: string

  @Field()
  displayName!: string

  @Field({ nullable: true })
  avatarUrl?: string

  @Field({ nullable: true })
  bio?: string

  @Field({ nullable: true })
  location?: string

  @Field(() => Int, { nullable: true })
  followers?: number

  @Field(() => Int, { nullable: true })
  publicRepos?: number

  @Field(() => Int, { nullable: true })
  totalCommits?: number

  @Field(() => Int, { nullable: true })
  currentStreak?: number

  @Field(() => [SearchProfileLanguageType], { nullable: true })
  topLanguages?: SearchProfileLanguageType[]

  @Field(() => [SearchProfileRepoType], { nullable: true })
  topRepos?: SearchProfileRepoType[]
}
