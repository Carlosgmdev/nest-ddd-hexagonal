import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { CancelVisitUseCase } from '../../application/use-cases/cancel-visit.use-case';
import { ScheduleVisitUseCase } from '../../application/use-cases/schedule-visit.use-case';
import { ScheduleVisitDto } from './dto/schedule-visit.dto';

@ApiTags('visits')
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly scheduleVisit: ScheduleVisitUseCase,
    private readonly cancelVisit: CancelVisitUseCase,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Visit scheduled' })
  async schedule(@Body() dto: ScheduleVisitDto): Promise<{ id: string }> {
    const id = await this.scheduleVisit.execute({
      serviceOrderId: dto.serviceOrderId,
      technicianId: dto.technicianId,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      now: new Date(),
    });
    return { id };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Visit cancelled' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cancelVisit.execute(id, new Date());
  }
}
