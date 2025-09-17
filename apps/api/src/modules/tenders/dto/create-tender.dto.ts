import { IsString, IsEnum, IsOptional, IsObject, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenderDto {
  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shipmentId?: string;

  @ApiProperty({ enum: ['DRAFT', 'OPEN'], default: 'DRAFT' })
  @IsEnum(['DRAFT', 'OPEN'])
  @IsOptional()
  status?: 'DRAFT' | 'OPEN' = 'DRAFT';

  @ApiProperty({ enum: ['SEQUENTIAL', 'PARALLEL'] })
  @IsEnum(['SEQUENTIAL', 'PARALLEL'])
  mode: 'SEQUENTIAL' | 'PARALLEL';

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  tier: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parentTenderId?: string;

  @ApiProperty()
  @IsDateString()
  offerDeadline: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
