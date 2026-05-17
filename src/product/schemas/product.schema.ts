import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Category } from '../../category/schemas/category.schema';
import { ProductStatus } from '../product.types';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ _id: false })
export class ProductRatingSummary {
  @Prop({ default: 0 })
  average!: number;

  @Prop({ default: 0 })
  count!: number;
}

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  productId!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, trim: true })
  brand!: string;

  @Prop({ type: Types.ObjectId, ref: Category.name, required: true })
  category!: Types.ObjectId;

  @Prop({ trim: true })
  subCategory?: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ min: 0 })
  discountPrice?: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock!: number;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Object, default: {} })
  attributes!: Record<string, unknown>;

  @Prop({
    type: ProductRatingSummary,
    default: () => ({ average: 0, count: 0 }),
  })
  rating!: ProductRatingSummary;

  @Prop({ enum: ProductStatus, default: ProductStatus.ACTIVE })
  status!: ProductStatus;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({
  title: 'text',
  description: 'text',
  brand: 'text',
  tags: 'text',
});
