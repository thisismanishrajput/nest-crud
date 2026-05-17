import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './schemas/product.schema';
import { ProductSort, ProductStatus } from './product.types';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly ragService: RagService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const product = await this.productModel.create({
        ...createProductDto,
        productId:
          createProductDto.productId?.trim().toUpperCase() ??
          this.generateProductId(),
      });
      const populatedProduct = await this.findById(product._id.toString());
      void this.ragService.indexProduct(populatedProduct);
      return populatedProduct;
    } catch (err: unknown) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        throw new ConflictException('Product ID already exists');
      }
      throw err;
    }
  }

  async findAll(query: QueryProductDto) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(query);
    const sort = this.buildSort(query.sort);

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('category')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const product = await this.productModel
      .findById(id)
      .populate('category')
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findByProductId(productId: string) {
    const product = await this.productModel
      .findOne({ productId: productId.trim().toUpperCase() })
      .populate('category')
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const payload = {
      ...updateProductDto,
      ...(updateProductDto.productId
        ? { productId: updateProductDto.productId.trim().toUpperCase() }
        : {}),
    };
    const product = await this.productModel
      .findByIdAndUpdate(id, payload, { returnDocument: 'after' })
      .populate('category')
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    void this.ragService.indexProduct(product);
    return product;
  }

  async remove(id: string) {
    const product = await this.productModel.findByIdAndDelete(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    void this.ragService.deleteProduct(product._id.toString());
    return { message: 'Product deleted successfully' };
  }

  async assertProductsAvailable(
    items: { product: string; quantity: number }[],
  ) {
    const productIds = items.map((item) => item.product);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .exec();
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product]),
    );

    for (const item of items) {
      const product = productMap.get(item.product);
      if (!product) {
        throw new NotFoundException(`Product ${item.product} not found`);
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(`${product.title} is not available`);
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `${product.title} has only ${product.stock} items in stock`,
        );
      }
    }

    return products;
  }

  async reduceStock(items: { product: string; quantity: number }[]) {
    await this.assertProductsAvailable(items);
    await Promise.all(
      items.map((item) =>
        this.productModel
          .updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } })
          .exec(),
      ),
    );
  }

  async updateRating(productId: string, average: number, count: number) {
    return await this.productModel
      .findByIdAndUpdate(
        productId,
        { rating: { average: Number(average.toFixed(2)), count } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  private buildFilter(query: QueryProductDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      status: query.status ?? ProductStatus.ACTIVE,
    };

    if (query.search) {
      filter.$text = { $search: query.search };
    }
    if (query.category) {
      filter.category = new Types.ObjectId(query.category);
    }
    if (query.brand) {
      filter.brand = new RegExp(`^${this.escapeRegex(query.brand)}$`, 'i');
    }
    if (query.minPrice || query.maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (query.minPrice) {
        priceFilter.$gte = Number(query.minPrice);
      }
      if (query.maxPrice) {
        priceFilter.$lte = Number(query.maxPrice);
      }
      filter.price = priceFilter;
    }
    if (query.minRating) {
      filter['rating.average'] = { $gte: Number(query.minRating) };
    }

    return filter;
  }

  private buildSort(sort?: ProductSort): Record<string, SortOrder> {
    switch (sort) {
      case ProductSort.PRICE_LOW_TO_HIGH:
        return { price: 1 };
      case ProductSort.PRICE_HIGH_TO_LOW:
        return { price: -1 };
      case ProductSort.RATING:
        return { 'rating.average': -1, 'rating.count': -1 };
      case ProductSort.POPULARITY:
        return { 'rating.count': -1, 'rating.average': -1 };
      case ProductSort.NEWEST:
      default:
        return { createdAt: -1 };
    }
  }

  private generateProductId() {
    return `P${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
