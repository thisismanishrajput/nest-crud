import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order.service';

@UseGuards(AuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return await this.orderService.createFromCart(req.user.sub, createOrderDto);
  }

  @Get()
  async findMyOrders(@Req() req: AuthenticatedRequest) {
    return await this.orderService.findUserOrders(req.user.sub);
  }

  @Get('last-purchase')
  async findLastPurchase(@Req() req: AuthenticatedRequest) {
    return await this.orderService.findLastPurchase(req.user.sub);
  }

  @Get('spend')
  async getMonthlySpend(
    @Req() req: AuthenticatedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return await this.orderService.getMonthlySpend(
      req.user.sub,
      Number(year),
      Number(month),
    );
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.orderService.findUserOrder(req.user.sub, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return await this.orderService.updateStatus(id, updateOrderStatusDto);
  }
}
