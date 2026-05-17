import {
  IsEnum,
  IsMongoId,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { ProductSort, ProductStatus } from '../product.types';

export class QueryProductDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsMongoId()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsNumberString()
  @IsOptional()
  minPrice?: string;

  @IsNumberString()
  @IsOptional()
  maxPrice?: string;

  @IsNumberString()
  @IsOptional()
  minRating?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsEnum(ProductSort)
  @IsOptional()
  sort?: ProductSort;

  @IsNumberString()
  @IsOptional()
  page?: string;

  @IsNumberString()
  @IsOptional()
  limit?: string;
}
