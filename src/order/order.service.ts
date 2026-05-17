import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CartService } from '../cart/cart.service';
import { ProductService } from '../product/product.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './schemas/order.schema';

type PopulatedCartItem = {
  product: {
    _id: Types.ObjectId;
    productId: string;
    title: string;
    price: number;
    discountPrice?: number;
    images: string[];
  };
  quantity: number;
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly cartService: CartService,
    private readonly productService: ProductService,
  ) {}

  async createFromCart(userId: string, createOrderDto: CreateOrderDto) {
    const cart = await this.cartService.getCart(userId);
    const items = cart.items as unknown as PopulatedCartItem[];

    if (!items.length) {
      throw new BadRequestException('Cart is empty');
    }

    const stockItems = items.map((item) => ({
      product: item.product._id.toString(),
      quantity: item.quantity,
    }));
    await this.productService.assertProductsAvailable(stockItems);

    const orderItems = items.map((item) => {
      const price = item.product.discountPrice ?? item.product.price;
      return {
        product: item.product._id,
        productId: item.product.productId,
        title: item.product.title,
        price,
        quantity: item.quantity,
        images: item.product.images,
      };
    });

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const shippingFee = createOrderDto.shippingFee ?? 0;
    const tax = createOrderDto.tax ?? 0;
    const total = subtotal + shippingFee + tax;

    const order = await this.orderModel.create({
      orderId: this.generateOrderId(),
      user: new Types.ObjectId(userId),
      items: orderItems,
      shippingAddress: createOrderDto.shippingAddress,
      subtotal,
      shippingFee,
      tax,
      total,
    });

    await this.productService.reduceStock(stockItems);
    await this.cartService.clearCart(userId);

    return order;
  }

  async findUserOrders(userId: string) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    this.logger.log(
      `Finding orders for user ${userObjectId.toString()} in ${this.orderModel.db.name}.${this.orderModel.collection.name}`,
    );

    return await this.orderModel
      .find({ user: userObjectId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findUserOrder(userId: string, orderId: string) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const orderObjectId = this.toObjectId(orderId, 'Invalid order id');
    const order = await this.orderModel
      .findOne({ _id: orderObjectId, user: userObjectId })
      .exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findLastPurchase(userId: string) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const order = await this.orderModel
      .findOne({ user: userObjectId })
      .sort({ createdAt: -1 })
      .exec();
    if (!order) {
      throw new NotFoundException('No purchases found');
    }
    return order;
  }

  async getMonthlySpend(userId: string, year: number, month: number) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const result = await this.orderModel
      .aggregate<{ total: number; orderCount: number }>([
        {
          $match: {
            user: userObjectId,
            createdAt: { $gte: from, $lt: to },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            orderCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    return {
      year,
      month,
      total: result[0]?.total ?? 0,
      orderCount: result[0]?.orderCount ?? 0,
    };
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const order = await this.orderModel
      .findByIdAndUpdate(id, updateOrderStatusDto, { returnDocument: 'after' })
      .exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private generateOrderId() {
    return `O${Date.now()}`;
  }

  private toObjectId(id: string, message: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(message);
    }
    return new Types.ObjectId(id);
  }
}
