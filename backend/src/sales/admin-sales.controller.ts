import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AppRole } from '../common/constants';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SalesService } from './sales.service';

@Controller('admin/sales-persons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.SUPER_ADMIN)
export class AdminSalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  list() {
    return this.salesService.adminListSalesPersons();
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    },
  ) {
    return this.salesService.adminCreateSalesPerson(body);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.salesService.adminGetSalesPerson(id);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.salesService.adminSetSalesPersonStatus(id, body?.status);
  }
}
