import { IsString, IsEnum, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartyDto {
  @ApiProperty({ enum: ['BROKER', 'CARRIER', 'DRIVER', 'SHIPPER', 'CONSIGNEE'] })
  @IsEnum(['BROKER', 'CARRIER', 'DRIVER', 'SHIPPER', 'CONSIGNEE'])
  type: 'BROKER' | 'CARRIER' | 'DRIVER' | 'SHIPPER' | 'CONSIGNEE';

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean = true;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
