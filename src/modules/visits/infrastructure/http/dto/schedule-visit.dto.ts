import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID, Matches } from 'class-validator';

export class ScheduleVisitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceOrderId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  technicianId!: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-01T09:00:00-06:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, { message: 'startsAt must include a timezone' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-01T10:00:00-06:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, { message: 'endsAt must include a timezone' })
  endsAt!: string;
}
