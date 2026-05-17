import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RagQueryDto {
  @IsString()
  query!: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_price?: number;

  @IsBoolean()
  @IsOptional()
  in_stock_only?: boolean;
}
