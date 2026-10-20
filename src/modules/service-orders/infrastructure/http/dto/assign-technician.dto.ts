import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  technicianId!: string;
}
