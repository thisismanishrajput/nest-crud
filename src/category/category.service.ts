import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    try {
      return await this.categoryModel.create({
        ...createCategoryDto,
        slug: this.normalizeSlug(createCategoryDto.slug),
      });
    } catch (err: unknown) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        throw new ConflictException('Category slug already exists');
      }
      throw err;
    }
  }

  async findAll() {
    return await this.categoryModel.find().sort({ name: 1 }).exec();
  }

  async findActive() {
    return await this.categoryModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  async findById(id: string) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const payload = {
      ...updateCategoryDto,
      ...(updateCategoryDto.slug
        ? { slug: this.normalizeSlug(updateCategoryDto.slug) }
        : {}),
    };
    const category = await this.categoryModel
      .findByIdAndUpdate(id, payload, { returnDocument: 'after' })
      .exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async remove(id: string) {
    const category = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return { message: 'Category deleted successfully' };
  }

  private normalizeSlug(slug: string) {
    return slug.trim().toLowerCase();
  }
}
