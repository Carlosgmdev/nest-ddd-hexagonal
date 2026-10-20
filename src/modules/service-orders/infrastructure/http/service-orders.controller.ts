import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateServiceOrderUseCase } from '../../application/use-cases/create-service-order.use-case';
import { AssignTechnicianUseCase } from '../../application/use-cases/assign-technician.use-case';
import { AddActivityUseCase } from '../../application/use-cases/add-activity.use-case';
import { RegisterMaterialUseCase } from '../../application/use-cases/register-material.use-case';
import { CompleteRequiredTaskUseCase } from '../../application/use-cases/complete-required-task.use-case';
import { FinalizeServiceOrderUseCase } from '../../application/use-cases/finalize-service-order.use-case';
import { CloseServiceOrderUseCase } from '../../application/use-cases/close-service-order.use-case';
import { GetServiceOrderUseCase } from '../../application/use-cases/get-service-order.use-case';
import { ListServiceOrdersUseCase } from '../../application/use-cases/list-service-orders.use-case';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { RegisterMaterialDto } from './dto/register-material.dto';
import { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import { AddRequiredTaskUseCase } from '../../application/use-cases/add-required-task.use-case';
import { AddRequiredTaskDto } from './dto/add-required-task.dto';

@ApiTags('service-orders')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly createServiceOrder: CreateServiceOrderUseCase,
    private readonly assignTechnician: AssignTechnicianUseCase,
    private readonly addActivity: AddActivityUseCase,
    private readonly registerMaterial: RegisterMaterialUseCase,
    private readonly addRequiredTask: AddRequiredTaskUseCase,
    private readonly completeRequiredTask: CompleteRequiredTaskUseCase,
    private readonly finalizeServiceOrder: FinalizeServiceOrderUseCase,
    private readonly closeServiceOrder: CloseServiceOrderUseCase,
    private readonly getServiceOrder: GetServiceOrderUseCase,
    private readonly listServiceOrders: ListServiceOrdersUseCase,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Service order created' })
  async create(@Body() dto: CreateServiceOrderDto): Promise<{ id: string }> {
    const id = await this.createServiceOrder.execute({
      ...dto,
      requiredTasks: dto.requiredTasks.map(({ name }) => name),
    });

    return { id };
  }

  @Get()
  @ApiOkResponse({
    description: 'Service orders ordered by creation time; follow nextCursor for the next page',
  })
  list(@Query() query: ListServiceOrdersQueryDto) {
    return this.listServiceOrders.execute({
      status: query.status,
      limit: query.limit,
      after:
        query.afterId && query.afterCreatedAt
          ? { afterId: query.afterId, afterCreatedAt: query.afterCreatedAt }
          : undefined,
    });
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Full service order view' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getServiceOrder.execute(id);
  }

  @Post(':id/technician-assignment')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
  ): Promise<void> {
    await this.assignTechnician.execute(id, dto.technicianId);
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async activity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddActivityDto,
  ): Promise<void> {
    await this.addActivity.execute(id, dto.description, dto.workedMinutes);
  }

  @Post(':id/material-usages')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async material(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterMaterialDto,
  ): Promise<void> {
    await this.registerMaterial.execute(id, dto.materialId, dto.quantity);
  }

  @Post(':id/required-tasks')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async addTask(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: AddRequiredTaskDto,
  ): Promise<void> {
    await this.addRequiredTask.execute(orderId, dto.name);
  }

  @Post(':id/required-tasks/:taskId/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async completeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    await this.completeRequiredTask.execute(id, taskId);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async finalize(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.finalizeServiceOrder.execute(id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Persists a ServiceOrderClosed outbox event atomically' })
  async close(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.closeServiceOrder.execute(id);
  }
}
