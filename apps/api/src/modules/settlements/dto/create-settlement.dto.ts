import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSettlementDto {
  @ApiProperty()
  @IsString()
  chainId: string;

  @ApiProperty()
  @IsString()
  shipmentId: string;

  @ApiProperty({ enum: ['PENDING'], default: 'PENDING' })
  @IsEnum(['PENDING'])
  @IsOptional()
  status?: 'PENDING' = 'PENDING';

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
