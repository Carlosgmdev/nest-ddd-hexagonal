import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '@shared/domain/domain-error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.resolveStatus(exception.code);

    if (status >= 500) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }

  private resolveStatus(code: string): number {
    const statuses: Record<string, HttpStatus> = {
      SERVICE_ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
      REQUIRED_TASK_NOT_FOUND: HttpStatus.NOT_FOUND,
      SERVICE_ORDER_INVALID_STATE: HttpStatus.CONFLICT,
      SERVICE_ORDER_CONCURRENCY_CONFLICT: HttpStatus.CONFLICT,
      CLOSED_SERVICE_ORDER_CANNOT_BE_MODIFIED: HttpStatus.CONFLICT,
      FINALIZED_SERVICE_ORDER_CANNOT_BE_MODIFIED: HttpStatus.CONFLICT,
      INVALID_SERVICE_ORDER_VALUE: HttpStatus.UNPROCESSABLE_ENTITY,
      TECHNICIAN_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
      ACTIVITY_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
      PENDING_REQUIRED_TASKS: HttpStatus.UNPROCESSABLE_ENTITY,
    };
    return statuses[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
