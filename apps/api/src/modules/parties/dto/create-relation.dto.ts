import { IsString, IsEnum, IsNumber, IsOptional, IsObject, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRelationDto {
  @ApiProperty()
  @IsString()
  fromPartyId: string;

  @ApiProperty()
  @IsString()
  toPartyId: string;

  @ApiProperty({ enum: ['BROKER_CARRIER', 'CARRIER_DRIVER', 'SHIPPER_BROKER'] })
  @IsEnum(['BROKER_CARRIER', 'CARRIER_DRIVER', 'SHIPPER_BROKER'])
  relationType: 'BROKER_CARRIER' | 'CARRIER_DRIVER' | 'SHIPPER_BROKER';

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE' })
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = 'ACTIVE';

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  tier: number;

  @ApiProperty()
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  validTo?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
