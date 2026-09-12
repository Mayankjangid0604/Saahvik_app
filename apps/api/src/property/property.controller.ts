import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { PropertyService } from './property.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';
import {
  UpdatePropertyDto,
  CreateWingDto,
  CreateRoomsDto,
  CreateBedsDto,
  RoomFiltersDto,
} from './dto';

@Controller('properties/me')
@UseGuards(JwtAuthGuard)
export class PropertyController {
  constructor(
    @Inject(PropertyService) private readonly propertyService: PropertyService,
  ) {}

  @Get()
  async getMyProperty(@CurrentUser() user: RequestUser) {
    const property = await this.propertyService.getMyProperty(user.organizationId);
    return wrapSuccess(property, 'v1');
  }

  @Patch()
  async updateProperty(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePropertyDto,
  ) {
    const property = await this.propertyService.updateProperty(user.organizationId, dto);
    return wrapSuccess(property, 'v1');
  }

  @Post('wings')
  async createWing(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWingDto,
  ) {
    const wing = await this.propertyService.createWing(user.organizationId, dto.name);
    return wrapSuccess(wing, 'v1');
  }

  @Get('wings')
  async getWings(@CurrentUser() user: RequestUser) {
    const wings = await this.propertyService.getWings(user.organizationId);
    return wrapSuccess(wings, 'v1');
  }

  @Post('rooms')
  async createRooms(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateRoomsDto,
  ) {
    const result = await this.propertyService.createRooms(user.organizationId, dto.rooms);
    return wrapSuccess(result, 'v1');
  }

  @Get('rooms')
  async getRooms(
    @CurrentUser() user: RequestUser,
    @Query() filters: RoomFiltersDto,
  ) {
    const result = await this.propertyService.getRooms(user.organizationId, filters);
    return wrapSuccess(result, 'v1');
  }

  @Post('rooms/:roomId/beds')
  async createBeds(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateBedsDto,
  ) {
    const result = await this.propertyService.createBeds(user.organizationId, roomId, dto.beds);
    return wrapSuccess(result, 'v1');
  }

  @Get('rooms/:roomId/beds')
  async getBeds(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    const beds = await this.propertyService.getBeds(user.organizationId, roomId);
    return wrapSuccess(beds, 'v1');
  }

  @Get('occupancy')
  async getOccupancy(@CurrentUser() user: RequestUser) {
    const data = await this.propertyService.getOccupancy(user.organizationId);
    return wrapSuccess(data, 'v1');
  }
}
