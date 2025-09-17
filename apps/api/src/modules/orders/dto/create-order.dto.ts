import { Type } from 'class-transformer';
import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsObject, 
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty()
  @IsString()
  postalCode: string;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsPositive()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsPositive()
  @IsOptional()
  volume?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  shipperId: string;

  @ApiProperty()
  @IsString()
  consigneeId: string;

  @ApiProperty({ enum: ['DRAFT', 'CONFIRMED'], default: 'DRAFT' })
  @IsEnum(['DRAFT', 'CONFIRMED'])
  @IsOptional()
  status?: 'DRAFT' | 'CONFIRMED' = 'DRAFT';

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  pickupLocation: LocationDto;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  deliveryLocation: LocationDto;

  @ApiProperty()
  @IsDateString()
  requestedPickupDate: string;

  @ApiProperty()
  @IsDateString()
  requestedDeliveryDate: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}