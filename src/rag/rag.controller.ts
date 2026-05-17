import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RagQueryDto } from './dto/rag-query.dto';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @UseGuards(AuthGuard)
  @Post('query')
  async query(
    @Req() req: AuthenticatedRequest,
    @Body() queryDto: RagQueryDto,
  ) {
    return await this.ragService.query(req.user.sub, queryDto);
  }

  @UseGuards(AuthGuard)
  @Post('search-products')
  async searchProducts(@Body() queryDto: RagQueryDto) {
    return await this.ragService.searchProducts(queryDto);
  }

  @UseGuards(AuthGuard)
  @Post('reindex-products')
  async reindexProducts() {
    return await this.ragService.reindexProducts();
  }
}
