import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { ProductModule } from '../product/product.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { Review, ReviewSchema } from './schemas/review.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    ProductModule,
    OrderModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
