import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@UseGuards(AuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req: AuthenticatedRequest) {
    return await this.cartService.getCart(req.user.sub);
  }

  @Get('summary')
  async getCartSummary(@Req() req: AuthenticatedRequest) {
    return await this.cartService.getCartSummary(req.user.sub);
  }

  @Post('items')
  async addItem(
    @Req() req: AuthenticatedRequest,
    @Body() addCartItemDto: AddCartItemDto,
  ) {
    return await this.cartService.addItem(req.user.sub, addCartItemDto);
  }

  @Patch('items/:productId')
  async updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return await this.cartService.updateItem(
      req.user.sub,
      productId,
      updateCartItemDto,
    );
  }

  @Delete('items/:productId')
  async removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    return await this.cartService.removeItem(req.user.sub, productId);
  }

  @Delete()
  async clearCart(@Req() req: AuthenticatedRequest) {
    return await this.cartService.clearCart(req.user.sub);
  }
}
