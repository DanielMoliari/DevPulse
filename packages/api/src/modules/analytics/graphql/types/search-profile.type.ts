import { Field, Float, Int, ObjectType } from '@nestjs/graphql'

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
