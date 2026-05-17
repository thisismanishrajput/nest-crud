import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from '../cart/schemas/cart.schema';
import { Order } from '../order/schemas/order.schema';
import { Product } from '../product/schemas/product.schema';
import { Review } from '../review/schemas/review.schema';
import { User } from '../user/schemas/user.schema';
import { RagQueryDto } from './dto/rag-query.dto';

type PopulatedCategory = {
  name?: string;
};

type ProductForAi = Product & {
  _id: unknown;
  category?: unknown;
};

type CartProductForAi = {
  _id: unknown;
  productId?: string;
  title?: string;
  price?: number;
  discountPrice?: number;
  images?: string[];
};

type ReviewProductForAi = {
  _id: unknown;
  productId?: string;
  title?: string;
  images?: string[];
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ??
      'http://127.0.0.1:8000';
  }

  async query(userId: string, payload: RagQueryDto) {
    if (this.isProfileQuestion(payload.query)) {
      return await this.answerProfileQuestion(userId, payload.query);
    }

    if (this.isCartQuestion(payload.query)) {
      return await this.answerCartQuestion(userId, payload.query);
    }

    if (this.isOrderQuestion(payload.query)) {
      return await this.answerOrderQuestion(userId, payload.query);
    }

    if (this.isMyReviewQuestion(payload.query)) {
      return await this.answerMyReviewQuestion(userId, payload.query);
    }

    const reviewProductCode = this.extractReviewProductCode(payload.query);
    if (reviewProductCode) {
      return await this.answerProductReviewQuestion(
        payload.query,
        reviewProductCode,
      );
    }

    const productCode = this.extractProductCode(payload.query);
    if (productCode) {
      return await this.answerProductQuestion(payload.query, productCode);
    }

    return await this.postToAi('/rag/query', payload);
  }

  async searchProducts(payload: unknown) {
    return await this.postToAi('/rag/search-products', payload);
  }

  private async answerProfileQuestion(userId: string, query: string) {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      return {
        query,
        answer: 'I could not find your profile details.',
        product_ids: [],
        results: [],
        source: 'profile',
      };
    }

    return {
      query,
      answer: `Your profile name is ${user.fName} ${user.lName}. Your email is ${user.email}. Your role is ${user.role}. Your account is ${
        user.isVerified ? 'verified' : 'not verified'
      }.`,
      product_ids: [],
      results: [
        {
          name: `${user.fName} ${user.lName}`,
          email: user.email,
          role: user.role,
          is_verified: user.isVerified,
        },
      ],
      source: 'profile',
    };
  }

  private async answerCartQuestion(userId: string, query: string) {
    const cart = await this.cartModel
      .findOne({ user: new Types.ObjectId(userId) })
      .populate('items.product')
      .exec();
    const items = (cart?.items ?? []) as unknown as {
      product: CartProductForAi;
      quantity: number;
    }[];
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => {
      const price = item.product.discountPrice ?? item.product.price;
      return sum + (price ?? 0) * item.quantity;
    }, 0);
    const cartItems = items.map((item) => {
      const price = item.product.discountPrice ?? item.product.price ?? 0;
      return {
        mongo_id: String(item.product._id),
        product_id: item.product.productId ?? '',
        title: item.product.title ?? '',
        price: item.product.price ?? 0,
        discount_price: item.product.discountPrice ?? item.product.price ?? 0,
        quantity: item.quantity,
        line_total: price * item.quantity,
        images: item.product.images ?? [],
      };
    });

    return {
      query,
      answer: `You have ${totalItems} item(s) in your cart. Your cart total is ${totalAmount}.`,
      product_ids: cartItems.map((item) => item.mongo_id),
      results: cartItems,
      source: 'cart',
    };
  }

  private isCartQuestion(query: string) {
    const normalized = query.toLowerCase();
    return (
      normalized.includes('cart') ||
      normalized.includes('basket') ||
      normalized.includes('bag')
    );
  }

  private isProfileQuestion(query: string) {
    const normalized = query.toLowerCase();
    const asksProfile =
      normalized.includes('profile') ||
      normalized.includes('account') ||
      normalized.includes('email') ||
      normalized.includes('name') ||
      normalized.includes('who am i');

    return this.hasPersonalContext(normalized) && asksProfile;
  }

  private isOrderQuestion(query: string) {
    const normalized = query.toLowerCase();
    return (
      normalized.includes('order') ||
      normalized.includes('orders') ||
      normalized.includes('purchase') ||
      normalized.includes('purchases') ||
      normalized.includes('bought')
    );
  }

  private async answerOrderQuestion(userId: string, query: string) {
    const orders = await this.orderModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
    const totalItems = orders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const orderResults = orders.map((order) => ({
      mongo_id: String(order._id),
      order_id: order.orderId,
      status: order.status,
      payment_status: order.paymentStatus,
      total: order.total,
      item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => ({
        product_id: item.productId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        images: item.images,
      })),
    }));

    return {
      query,
      answer: `You have made ${orders.length} order(s) so far. Total items purchased: ${totalItems}. Total amount spent: ${totalSpent}.`,
      product_ids: orders.flatMap((order) =>
        order.items.map((item) => item.product.toString()),
      ),
      results: orderResults,
      source: 'orders',
    };
  }

  private isMyReviewQuestion(query: string) {
    const normalized = query.toLowerCase();
    const asksReview =
      normalized.includes('review') ||
      normalized.includes('reviews') ||
      normalized.includes('rating') ||
      normalized.includes('ratings') ||
      normalized.includes('feedback');

    return this.hasPersonalContext(normalized) && asksReview;
  }

  private async answerMyReviewQuestion(userId: string, query: string) {
    const reviews = await this.reviewModel
      .find({ user: new Types.ObjectId(userId) })
      .populate('product')
      .sort({ createdAt: -1 })
      .exec();
    const averageRating =
      reviews.length === 0
        ? 0
        : reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length;
    const reviewResults = reviews.map((review) => {
      const product = review.product as unknown as ReviewProductForAi;
      return {
        mongo_id: String(review._id),
        product_mongo_id: String(product._id),
        product_id: product.productId ?? '',
        product_title: product.title ?? '',
        rating: review.rating,
        comment: review.comment,
        is_verified_purchase: review.isVerifiedPurchase,
        images: product.images ?? [],
      };
    });

    return {
      query,
      answer: `You have written ${reviews.length} review(s). Your average rating across reviewed products is ${Number(
        averageRating.toFixed(2),
      )}/5.`,
      product_ids: reviewResults.map((review) => review.product_mongo_id),
      results: reviewResults,
      source: 'my_reviews',
    };
  }

  private hasPersonalContext(normalizedQuery: string) {
    return /\b(my|me|i|mine|myself)\b/.test(normalizedQuery);
  }

  private extractReviewProductCode(query: string) {
    const normalized = query.toLowerCase();
    const asksForReview =
      normalized.includes('review') ||
      normalized.includes('rating') ||
      normalized.includes('feedback');

    if (!asksForReview) {
      return null;
    }

    return this.extractProductCode(query);
  }

  private extractProductCode(query: string) {
    const match = query.match(/\bP\d{3,}\b/i);
    return match?.[0].toUpperCase() ?? null;
  }

  private async answerProductQuestion(query: string, productCode: string) {
    const product = await this.productModel
      .findOne({ productId: productCode })
      .populate('category')
      .exec();

    if (!product) {
      return {
        query,
        answer: `I could not find any product with product id ${productCode}.`,
        product_ids: [],
        results: [],
        source: 'product',
      };
    }

    const category = product.category as PopulatedCategory | undefined;
    const discountPrice = product.discountPrice ?? product.price;
    const stockText =
      product.stock > 0 ? `${product.stock} item(s) in stock` : 'out of stock';

    return {
      query,
      answer: `${product.title} is a ${product.brand} product in ${
        category?.name ?? 'its category'
      }. ${product.description} Price is ${product.price}, current selling price is ${discountPrice}, and it has ${stockText}. Average rating is ${
        product.rating?.average ?? 0
      }/5 from ${product.rating?.count ?? 0} review(s).`,
      product_ids: [String(product._id)],
      results: [this.toProductResult(product)],
      source: 'product',
    };
  }

  private async answerProductReviewQuestion(query: string, productCode: string) {
    const product = await this.productModel
      .findOne({ productId: productCode })
      .populate('category')
      .exec();

    if (!product) {
      return {
        query,
        answer: `I could not find any product with product id ${productCode}.`,
        product_ids: [],
        results: [],
        source: 'reviews',
      };
    }

    const reviews = await this.reviewModel
      .find({ product: product._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    const productId = String(product._id);
    const averageRating = product.rating?.average ?? 0;
    const reviewCount = product.rating?.count ?? reviews.length;

    if (!reviews.length) {
      return {
        query,
        answer: `${product.title} has no customer reviews yet. Current rating is ${averageRating} based on ${reviewCount} review(s).`,
        product_ids: [productId],
        results: [this.toProductResult(product)],
        reviews: [],
        source: 'reviews',
      };
    }

    const verifiedCount = reviews.filter(
      (review) => review.isVerifiedPurchase,
    ).length;
    const reviewLines = reviews.map(
      (review, index) =>
        `${index + 1}. ${review.rating}/5 - ${review.comment}${
          review.isVerifiedPurchase ? ' (verified purchase)' : ''
        }`,
    );

    return {
      query,
      answer: [
        `${product.title} has an average rating of ${averageRating}/5 from ${reviewCount} review(s).`,
        `${verifiedCount} of the latest ${reviews.length} review(s) are verified purchases.`,
        'Latest review highlights:',
        ...reviewLines,
      ].join('\n'),
      product_ids: [productId],
      results: [this.toProductResult(product)],
      reviews: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        is_verified_purchase: review.isVerifiedPurchase,
      })),
      source: 'reviews',
    };
  }

  private toProductResult(product: ProductForAi) {
    const category = product.category as PopulatedCategory | undefined;

    return {
      mongo_id: String(product._id),
      product_id: product.productId,
      title: product.title,
      brand: product.brand,
      category: category?.name ?? product.category?.toString(),
      price: product.price,
      discount_price: product.discountPrice ?? product.price,
      stock: product.stock,
      rating: product.rating?.average ?? 0,
      review_count: product.rating?.count ?? 0,
      images: product.images ?? [],
    };
  }

  async reindexProducts() {
    const products = await this.productModel.find().populate('category').exec();
    let indexed = 0;
    let failed = 0;

    for (const product of products) {
      const result = await this.indexProduct(product);
      if (result) {
        indexed += 1;
      } else {
        failed += 1;
      }
    }

    return {
      message: 'Product reindex completed',
      total: products.length,
      indexed,
      failed,
    };
  }

  async indexProduct(product: ProductForAi) {
    try {
      return await this.postToAi('/index/product', this.toAiProduct(product));
    } catch (error) {
      this.logger.warn(
        `Product AI indexing skipped: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return null;
    }
  }

  async deleteProduct(productId: string) {
    try {
      return await this.deleteFromAi(`/index/product/${productId}`);
    } catch (error) {
      this.logger.warn(
        `Product AI index delete skipped: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return null;
    }
  }

  private toAiProduct(product: ProductForAi) {
    const category = product.category as PopulatedCategory | undefined;

    return {
      id: String(product._id),
      product_id: product.productId,
      title: product.title,
      description: product.description,
      brand: product.brand,
      category: category?.name ?? product.category?.toString(),
      sub_category: product.subCategory,
      price: product.price,
      discount_price: product.discountPrice,
      stock: product.stock,
      rating: product.rating?.average ?? 0,
      tags: product.tags ?? [],
      status: product.status,
    };
  }

  private async postToAi(path: string, payload: unknown) {
    const response = await fetch(`${this.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return await this.parseAiResponse(response);
  }

  private async deleteFromAi(path: string) {
    const response = await fetch(`${this.aiServiceUrl}${path}`, {
      method: 'DELETE',
    });

    return await this.parseAiResponse(response);
  }

  private async parseAiResponse(response: Response) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        `AI service returned ${response.status}: ${JSON.stringify(data)}`,
      );
    }

    return data;
  }
}
