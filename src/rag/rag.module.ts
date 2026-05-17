import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { Order, OrderSchema } from '../order/schemas/order.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { Review, ReviewSchema } from '../review/schemas/review.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
