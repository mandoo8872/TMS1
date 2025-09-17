import { IsString, IsEnum, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSettlementLinkDto {
  @ApiProperty()
  @IsString()
  fromPartyId: string;

  @ApiProperty()
  @IsString()
  toPartyId: string;

  @ApiProperty({ enum: ['PASS_THROUGH', 'SHARE', 'DIRECT'] })
  @IsEnum(['PASS_THROUGH', 'SHARE', 'DIRECT'])
  linkType: 'PASS_THROUGH' | 'SHARE' | 'DIRECT';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ default: 'USD' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sharePercentage?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
