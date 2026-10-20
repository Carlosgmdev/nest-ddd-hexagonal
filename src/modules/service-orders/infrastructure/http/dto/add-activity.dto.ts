import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class AddActivityDto {
  @ApiProperty({ example: 'Replaced damaged pressure sensor' })
  @IsString()
  @Length(3, 1000)
  description!: string;

  @ApiProperty({ example: 45, minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  workedMinutes!: number;
}
