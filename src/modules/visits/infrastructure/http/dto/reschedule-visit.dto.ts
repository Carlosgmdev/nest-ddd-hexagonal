import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';

export class RescheduleVisitDto {
  @ApiProperty({ format: 'date-time', example: '2030-01-01T10:00:00-06:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, { message: 'startsAt must include a timezone' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', example: '2030-01-01T11:00:00-06:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, { message: 'endsAt must include a timezone' })
  endsAt!: string;
}
