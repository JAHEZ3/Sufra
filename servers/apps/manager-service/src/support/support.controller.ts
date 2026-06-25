import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';

@Controller('admin/support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /** POST /api/manager/admin/support/tickets — submit a new ticket.
   *  Open to managers and restaurant owners (overrides the class-level @Roles).
   *  Restaurant owners file tickets from the restaurant dashboard's Support page;
   *  list/getOne/update remain manager-only via the class-level guard. */
  @Roles('manager', 'restaurant_owner')
  @Post()
  create(@Body() dto: CreateSupportTicketDto, @Req() req: any) {
    return this.support.create(dto, req.user);
  }

  /** GET /api/manager/admin/support/tickets?status=&source=&page=&limit= */
  @Get()
  list(
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const validSource =
      source === 'manager' || source === 'contact_form' ? source : undefined;
    return this.support.list({
      status,
      source: validSource,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** GET /api/manager/admin/support/tickets/:id */
  @Get(':id')
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.support.getOne(id);
  }

  /** PATCH /api/manager/admin/support/tickets/:id/status */
  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
  ) {
    return this.support.updateStatus(id, dto);
  }
}
