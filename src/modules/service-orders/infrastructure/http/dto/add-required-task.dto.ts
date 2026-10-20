import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class AddRequiredTaskDto {
  @ApiProperty({
    example: 'Verify the device is working',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  @Transform(({ value }: { value: unknown }) => {
    return typeof value === 'string' ? value.trim() : value;
  })
  name!: string;
}
