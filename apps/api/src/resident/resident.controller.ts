import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  Inject,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators';
import { ResidentService } from './resident.service';
import {
  CreateResidentDto,
  UpdateResidentDto,
  AssignBedDto,
  VacateResidentDto,
  TransferResidentDto,
  ResidentQueryDto,
  SearchResidentsDto,
} from './dto';
import { wrapSuccess } from '../common/response';

@Controller('residents')
@UseGuards(JwtAuthGuard)
export class ResidentController {
  constructor(
    @Inject(ResidentService) private readonly residentService: ResidentService,
  ) {}

  @Get()
  async getResidents(
    @CurrentUser() user: RequestUser,
    @Query() query: ResidentQueryDto,
  ) {
    const result = await this.residentService.getResidents(user.organizationId, query);
    return wrapSuccess(result, 'v1');
  }

  @Get('search')
  async searchResidents(
    @CurrentUser() user: RequestUser,
    @Query() query: SearchResidentsDto,
  ) {
    const result = await this.residentService.searchResidents(user.organizationId, query);
    return wrapSuccess(result, 'v1');
  }

  @Post()
  async createResident(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateResidentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.createResident(
      user.organizationId,
      user.id,
      dto,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get(':id')
  async getResident(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.residentService.getResident(user.organizationId, id);
    return wrapSuccess(result, 'v1');
  }

  @Patch(':id')
  async updateResident(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ) {
    const result = await this.residentService.updateResident(
      user.organizationId,
      id,
      user.id,
      dto,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post(':id/assign-bed')
  async assignBed(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBedDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.assignBed(
      user.organizationId,
      id,
      dto.bedId,
      user.id,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post(':id/vacate')
  async vacateResident(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VacateResidentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.vacateResident(
      user.organizationId,
      id,
      user.id,
      dto.vacateDate,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post(':id/transfer')
  async transferResident(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferResidentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.transferResident(
      user.organizationId,
      id,
      dto.newBedId,
      user.id,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }
}
