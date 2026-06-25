import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantCategory } from '../entities/restaurant-category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(RestaurantCategory)
    private readonly repo: Repository<RestaurantCategory>,
  ) {}

  list() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async getOne(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('التصنيف غير موجود.');
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const existing = await this.repo.findOne({ where: { name } });
    if (existing) throw new ConflictException('يوجد تصنيف بنفس الاسم.');

    return this.repo.save(
      this.repo.create({ name, iconUrl: dto.iconUrl ?? null }),
    );
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const cat = await this.getOne(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== cat.name) {
        const conflict = await this.repo.findOne({ where: { name } });
        if (conflict) throw new ConflictException('يوجد تصنيف بنفس الاسم.');
        cat.name = name;
      }
    }
    if (dto.iconUrl !== undefined) {
      cat.iconUrl = dto.iconUrl ?? null;
    }

    return this.repo.save(cat);
  }

  async delete(id: string) {
    const cat = await this.getOne(id);
    await this.repo.delete(cat.id);
    return { id: cat.id };
  }
}
