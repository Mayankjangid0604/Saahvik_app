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
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
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
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ResidentQueryDto,
  ) {
    const result = await this.residentService.getResidents(user.orgId, query);
    return wrapSuccess(result, 'v1');
  }

  @Get('search')
  async searchResidents(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SearchResidentsDto,
  ) {
    const result = await this.residentService.searchResidents(user.orgId, query);
    return wrapSuccess(result, 'v1');
  }

  @Post()
  async createResident(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateResidentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.createResident(
      user.orgId,
      user.userId,
      dto,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get(':id')
  async getResident(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.residentService.getResident(user.orgId, id);
    return wrapSuccess(result, 'v1');
  }

  @Patch(':id')
  async updateResident(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ) {
    const result = await this.residentService.updateResident(
      user.orgId,
      id,
      user.userId,
      dto,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post(':id/assign-bed')
  async assignBed(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBedDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.assignBed(
      user.orgId,
      id,
      dto.bedId,
      user.userId,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post(':id/vacate')
  async vacateResident(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VacateResidentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.vacateResident(
      user.orgId,
      id,
      user.userId,
      dto.vacateDate,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post(':id/transfer')
  async transferResident(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferResidentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.residentService.transferResident(
      user.orgId,
      id,
      dto.newBedId,
      user.userId,
      idempotencyKey,
    );
    return wrapSuccess(result, 'v1');
  }
}
