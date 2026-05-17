import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';
import { User } from '../../user/schemas/user.schema';
import { OrderStatus, PaymentStatus } from '../order.types';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
export class OrderAddress {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ required: true, trim: true })
  line1!: string;

  @Prop({ trim: true })
  line2?: string;

  @Prop({ required: true, trim: true })
  city!: string;

  @Prop({ required: true, trim: true })
  state!: string;

  @Prop({ required: true, trim: true })
  pincode!: string;

  @Prop({ required: true, trim: true })
  country!: string;
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  product!: Types.ObjectId;

  @Prop({ required: true })
  productId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  price!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ type: [String], default: [] })
  images!: string[];
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  orderId!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;

  @Prop({ type: [OrderItem], required: true })
  items!: OrderItem[];

  @Prop({ type: OrderAddress, required: true })
  shippingAddress!: OrderAddress;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ default: 0, min: 0 })
  shippingFee!: number;

  @Prop({ default: 0, min: 0 })
  tax!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ enum: OrderStatus, default: OrderStatus.PLACED })
  status!: OrderStatus;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
