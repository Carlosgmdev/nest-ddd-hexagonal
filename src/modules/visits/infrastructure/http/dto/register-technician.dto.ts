import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RegisterTechnicianDto {
  @ApiProperty({
    example: 'Ana García',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;
}
