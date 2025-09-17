import { IsNumber, IsString, IsOptional, IsArray, IsObject, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitOfferDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceAmount: number;

  @ApiProperty({ default: 'USD' })
  @IsString()
  priceCurrency: string;

  @ApiProperty()
  @IsDateString()
  validUntil: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditions?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
