import { IsString, IsEnum, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShipmentDto {
  @ApiPropertyOptional({ enum: ['PLANNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] })
  @IsEnum(['PLANNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedCarrierId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedDriverId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  actualPickupDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  actualDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
