import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductService } from '../product/product.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Cart } from './schemas/cart.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    private readonly productService: ProductService,
  ) {}

  async getCart(userId: string) {
    const cart = await this.findOrCreateCart(userId);
    return await cart.populate('items.product');
  }

  async addItem(userId: string, addCartItemDto: AddCartItemDto) {
    await this.productService.assertProductsAvailable([
      { product: addCartItemDto.product, quantity: addCartItemDto.quantity },
    ]);

    const cart = await this.findOrCreateCart(userId);
    const existingItem = cart.items.find(
      (item) => item.product.toString() === addCartItemDto.product,
    );

    if (existingItem) {
      existingItem.quantity += addCartItemDto.quantity;
      await this.productService.assertProductsAvailable([
        { product: addCartItemDto.product, quantity: existingItem.quantity },
      ]);
    } else {
      cart.items.push({
        product: new Types.ObjectId(addCartItemDto.product),
        quantity: addCartItemDto.quantity,
      });
    }

    await cart.save();
    return await cart.populate('items.product');
  }

  async updateItem(
    userId: string,
    productId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    await this.productService.assertProductsAvailable([
      { product: productId, quantity: updateCartItemDto.quantity },
    ]);

    const cart = await this.findOrCreateCart(userId);
    const item = cart.items.find(
      (cartItem) => cartItem.product.toString() === productId,
    );
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    item.quantity = updateCartItemDto.quantity;
    await cart.save();
    return await cart.populate('items.product');
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.findOrCreateCart(userId);
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );
    await cart.save();
    return await cart.populate('items.product');
  }

  async clearCart(userId: string) {
    const cart = await this.findOrCreateCart(userId);
    cart.items = [];
    await cart.save();
    return cart;
  }

  async getCartSummary(userId: string) {
    const cart = await this.getCart(userId);
    const items = cart.items as unknown as {
      product: { price: number; discountPrice?: number };
      quantity: number;
    }[];
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => {
      const price = item.product.discountPrice ?? item.product.price;
      return sum + price * item.quantity;
    }, 0);

    return { totalItems, totalAmount };
  }

  private async findOrCreateCart(userId: string) {
    const objectId = new Types.ObjectId(userId);
    return await this.cartModel
      .findOneAndUpdate(
        { user: objectId },
        { $setOnInsert: { items: [] } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
