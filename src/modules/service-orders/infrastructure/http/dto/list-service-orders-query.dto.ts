import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { ServiceOrderStatus } from '../../../domain/model/service-order-status';

export class ListServiceOrdersQueryDto {
  @ApiPropertyOptional({ enum: ServiceOrderStatus })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Use together with afterCreatedAt from nextCursor',
  })
  @ValidateIf(
    (dto: ListServiceOrdersQueryDto) =>
      dto.afterId !== undefined || dto.afterCreatedAt !== undefined,
  )
  @IsUUID()
  afterId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Use together with afterId from nextCursor',
  })
  @ValidateIf(
    (dto: ListServiceOrdersQueryDto) =>
      dto.afterId !== undefined || dto.afterCreatedAt !== undefined,
  )
  @Type(() => Date)
  @IsDate()
  afterCreatedAt?: Date;
}
