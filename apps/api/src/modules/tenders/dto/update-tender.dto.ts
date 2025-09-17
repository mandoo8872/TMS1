import { IsEnum, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenderDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED'] })
  @IsEnum(['DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  offerDeadline?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
