import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { ServiceLevel } from '../../../domain/model/service-level';

export class RequiredTaskInputDto {
  @ApiProperty({ example: 'Validate electrical insulation' })
  @IsString()
  @Length(1, 200)
  name!: string;
}

export class CreateServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contractId!: string;

  @ApiProperty({ example: 'Av. Industria 1200, Planta 2' })
  @IsString()
  @Length(5, 500)
  serviceAddress!: string;

  @ApiProperty({ enum: ServiceLevel })
  @IsEnum(ServiceLevel)
  serviceLevel!: ServiceLevel;

  @ApiProperty({ type: [RequiredTaskInputDto], required: false, maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RequiredTaskInputDto)
  requiredTasks: RequiredTaskInputDto[] = [];
}
