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
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return await this.reviewService.create(req.user.sub, createReviewDto);
  }

  @Get('product/:productId')
  async findProductReviews(@Param('productId') productId: string) {
    return await this.reviewService.findProductReviews(productId);
  }

  @Get('product/:productId/summary')
  async findProductReviewSummary(@Param('productId') productId: string) {
    return await this.reviewService.findProductReviewSummary(productId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return await this.reviewService.update(req.user.sub, id, updateReviewDto);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.reviewService.remove(req.user.sub, id);
  }
}
