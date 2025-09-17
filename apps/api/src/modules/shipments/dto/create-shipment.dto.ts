import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShipmentDto {
  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiProperty({ enum: ['PLANNED'], default: 'PLANNED' })
  @IsEnum(['PLANNED'])
  @IsOptional()
  status?: 'PLANNED' = 'PLANNED';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedCarrierId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedDriverId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}