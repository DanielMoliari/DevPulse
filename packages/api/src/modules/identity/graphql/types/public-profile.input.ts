import { Field, InputType } from '@nestjs/graphql'
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator'

@InputType()
export class EnablePublicProfileInput {
  @Field({ description: 'Lowercase, alphanumeric + dash, 3-30 chars' })
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/i, {
    message: 'Username must be alphanumeric or dash with no leading/trailing dash.',
  })
  username: string
}

@InputType()
export class UpdatePublicProfilePrefsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  showRepos?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  showStreak?: boolean
}
