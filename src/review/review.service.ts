import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './schemas/review.schema';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    private readonly productService: ProductService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    await this.productService.findById(createReviewDto.product);
    const isVerifiedPurchase = await this.hasPurchasedProduct(
      userId,
      createReviewDto.product,
    );

    try {
      const review = await this.reviewModel.create({
        ...createReviewDto,
        product: new Types.ObjectId(createReviewDto.product),
        user: new Types.ObjectId(userId),
        isVerifiedPurchase,
      });
      await this.refreshProductRating(createReviewDto.product);
      return review;
    } catch (err: unknown) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw err;
    }
  }

  async findProductReviews(productId: string) {
    return await this.reviewModel
      .find({ product: new Types.ObjectId(productId) })
      .populate('user', 'fName lName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findProductReviewSummary(productId: string) {
    const reviews = await this.reviewModel
      .find({ product: new Types.ObjectId(productId) })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    const stats = await this.getProductRatingStats(productId);
    return {
      ...stats,
      latestReviews: reviews,
    };
  }

  async update(userId: string, id: string, updateReviewDto: UpdateReviewDto) {
    const review = await this.reviewModel
      .findOneAndUpdate({ _id: id, user: userId }, updateReviewDto, {
        returnDocument: 'after',
      })
      .exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.refreshProductRating(review.product.toString());
    return review;
  }

  async remove(userId: string, id: string) {
    const review = await this.reviewModel
      .findOneAndDelete({ _id: id, user: userId })
      .exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.refreshProductRating(review.product.toString());
    return { message: 'Review deleted successfully' };
  }

  private async hasPurchasedProduct(userId: string, productId: string) {
    const orders = await this.orderService.findUserOrders(userId);
    return orders.some((order) =>
      order.items.some((item) => item.product.toString() === productId),
    );
  }

  private async refreshProductRating(productId: string) {
    const stats = await this.getProductRatingStats(productId);
    await this.productService.updateRating(
      productId,
      stats.average,
      stats.count,
    );
  }

  private async getProductRatingStats(productId: string) {
    const result = await this.reviewModel
      .aggregate<{ average: number; count: number }>([
        { $match: { product: new Types.ObjectId(productId) } },
        {
          $group: {
            _id: '$product',
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    return {
      average: result[0]?.average ?? 0,
      count: result[0]?.count ?? 0,
    };
  }
}
