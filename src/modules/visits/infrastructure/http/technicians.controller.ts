import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RegisterTechnicianUseCase } from '../../application/use-cases/register-technician.use-case';
import { GetTechnicianUseCase } from '../../application/use-cases/get-technician.use-case';
import type { TechnicianView } from '../../application/use-cases/get-technician.use-case';
import { DeactivateTechnicianUseCase } from '../../application/use-cases/deactivate-technician.use-case';
import { RegisterTechnicianDto } from './dto/register-technician.dto';

@ApiTags('technicians')
@Controller('technicians')
export class TechniciansController {
  constructor(
    private readonly registerTechnician: RegisterTechnicianUseCase,
    private readonly getTechnician: GetTechnicianUseCase,
    private readonly deactivateTechnician: DeactivateTechnicianUseCase,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Technician registered' })
  async register(@Body() dto: RegisterTechnicianDto): Promise<{ id: string }> {
    const id = await this.registerTechnician.execute({ name: dto.name });
    return { id };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Technician view' })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<TechnicianView> {
    return this.getTechnician.execute(id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Technician deactivated' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deactivateTechnician.execute(id, new Date());
  }
}
