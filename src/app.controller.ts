import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller()
export class AppController {
  @Get('health')
  @ApiOkResponse()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
