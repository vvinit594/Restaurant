import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantContextService } from '../restaurant-context.service';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto';

const DEFAULT_CATEGORIES = [
  'South Indian',
  'Starters',
  'Main Course',
  'Rice',
  'Beverages',
  'Desserts',
];

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

@Injectable()
export class RestaurantDishesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantContext: RestaurantContextService,
  ) {}

  async listCategories(user: { id: string; role: any; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    await this.ensureDefaultCategories(ctx.restaurantId);

    const categories = await this.prisma.category.findMany({
      where: { restaurantId: ctx.restaurantId, deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    }));
  }

  async listDishes(
    user: { id: string; role: any; restaurantId?: string },
    query: { search?: string; category?: string } = {},
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const search = String(query.search || '').trim();
    const categoryFilter = String(query.category || 'all').trim();

    const where: Prisma.DishWhereInput = {
      restaurantId: ctx.restaurantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryFilter && categoryFilter !== 'all') {
      where.category = {
        OR: [
          { id: categoryFilter },
          { name: { equals: categoryFilter, mode: 'insensitive' } },
          { slug: slugify(categoryFilter) },
        ],
        restaurantId: ctx.restaurantId,
        deletedAt: null,
      };
    }

    const dishes = await this.prisma.dish.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    return dishes.map((d) => this.toClientDish(d));
  }

  async getDish(user: { id: string; role: any; restaurantId?: string }, dishId: string) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const dish = await this.prisma.dish.findFirst({
      where: { id: dishId, restaurantId: ctx.restaurantId, deletedAt: null },
      include: { category: true },
    });
    if (!dish) throw new NotFoundException('Dish not found.');
    return this.toClientDish(dish);
  }

  async createDish(
    user: { id: string; role: any; restaurantId?: string },
    dto: CreateDishDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
      MembershipRole.RESTAURANT_STAFF,
    ]);

    const category = await this.resolveCategory(ctx.restaurantId, dto);
    const name = dto.name.trim();
    let slug = slugify(name);
    if (!slug) throw new BadRequestException('Dish name is invalid.');

    slug = await this.uniqueDishSlug(ctx.restaurantId, slug);

    const dish = await this.prisma.dish.create({
      data: {
        restaurantId: ctx.restaurantId,
        categoryId: category.id,
        name,
        slug,
        description: dto.description?.trim() || null,
        price: dto.price,
        imageUrl: dto.imageUrl?.trim() || null,
        calories: dto.calories ?? null,
        protein: dto.protein ?? null,
        carbohydrates: dto.carbohydrates ?? null,
        fat: dto.fat ?? null,
        ingredients: toStringList(dto.ingredients),
        allergens: toStringList(dto.allergens),
        isVeg: dto.isVeg ?? true,
        isVegan: dto.isVegan ?? false,
        isJain: dto.isJain ?? false,
        isAvailable: dto.isAvailable ?? dto.available ?? true,
        isPublished: dto.isPublished ?? dto.published ?? true,
      },
      include: { category: true },
    });

    return this.toClientDish(dish);
  }

  async updateDish(
    user: { id: string; role: any; restaurantId?: string },
    dishId: string,
    dto: UpdateDishDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
      MembershipRole.RESTAURANT_STAFF,
    ]);

    const existing = await this.prisma.dish.findFirst({
      where: { id: dishId, restaurantId: ctx.restaurantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Dish not found.');

    let categoryId = existing.categoryId;
    if (dto.categoryId || dto.category) {
      const category = await this.resolveCategory(ctx.restaurantId, dto);
      categoryId = category.id;
    }

    let slug = existing.slug;
    let name = existing.name;
    if (dto.name != null) {
      name = dto.name.trim();
      slug = await this.uniqueDishSlug(ctx.restaurantId, slugify(name), dishId);
    }

    const dish = await this.prisma.dish.update({
      where: { id: dishId },
      data: {
        name,
        slug,
        categoryId,
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl?.trim() || null }
          : {}),
        ...(dto.calories !== undefined ? { calories: dto.calories } : {}),
        ...(dto.protein !== undefined ? { protein: dto.protein } : {}),
        ...(dto.carbohydrates !== undefined
          ? { carbohydrates: dto.carbohydrates }
          : {}),
        ...(dto.fat !== undefined ? { fat: dto.fat } : {}),
        ...(dto.ingredients !== undefined
          ? { ingredients: toStringList(dto.ingredients) }
          : {}),
        ...(dto.allergens !== undefined
          ? { allergens: toStringList(dto.allergens) }
          : {}),
        ...(dto.isVeg !== undefined ? { isVeg: dto.isVeg } : {}),
        ...(dto.isVegan !== undefined ? { isVegan: dto.isVegan } : {}),
        ...(dto.isJain !== undefined ? { isJain: dto.isJain } : {}),
        ...((dto.isAvailable !== undefined || dto.available !== undefined) && {
          isAvailable: dto.isAvailable ?? dto.available,
        }),
        ...((dto.isPublished !== undefined || dto.published !== undefined) && {
          isPublished: dto.isPublished ?? dto.published,
        }),
      },
      include: { category: true },
    });

    return this.toClientDish(dish);
  }

  async deleteDish(
    user: { id: string; role: any; restaurantId?: string },
    dishId: string,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
    ]);

    const existing = await this.prisma.dish.findFirst({
      where: { id: dishId, restaurantId: ctx.restaurantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Dish not found.');

    await this.prisma.dish.update({
      where: { id: dishId },
      data: { deletedAt: new Date(), isPublished: false, isAvailable: false },
    });

    return { success: true };
  }

  private async resolveCategory(
    restaurantId: string,
    dto: { categoryId?: string; category?: string },
  ) {
    if (dto.categoryId) {
      const byId = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          restaurantId,
          deletedAt: null,
        },
      });
      if (!byId) {
        throw new BadRequestException(
          'Category not found for this restaurant.',
        );
      }
      return byId;
    }

    const name = String(dto.category || '').trim();
    if (!name) {
      throw new BadRequestException('Category is required.');
    }

    const slug = slugify(name);
    const existing = await this.prisma.category.findFirst({
      where: { restaurantId, slug, deletedAt: null },
    });
    if (existing) return existing;

    return this.prisma.category.create({
      data: {
        restaurantId,
        name,
        slug,
        sortOrder: 100,
      },
    });
  }

  private async ensureDefaultCategories(restaurantId: string) {
    const count = await this.prisma.category.count({
      where: { restaurantId, deletedAt: null },
    });
    if (count > 0) return;

    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((name, index) => ({
        restaurantId,
        name,
        slug: slugify(name),
        sortOrder: index + 1,
      })),
      skipDuplicates: true,
    });
  }

  private async uniqueDishSlug(
    restaurantId: string,
    base: string,
    excludeId?: string,
  ) {
    let slug = base;
    let i = 2;
    for (;;) {
      const clash = await this.prisma.dish.findFirst({
        where: {
          restaurantId,
          slug,
          deletedAt: null,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (!clash) return slug;
      slug = `${base}-${i}`;
      i += 1;
    }
  }

  private toClientDish(d: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: Prisma.Decimal | number;
    imageUrl: string | null;
    calories: number | null;
    protein: number | null;
    carbohydrates: number | null;
    fat: number | null;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isJain: boolean;
    isAvailable: boolean;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string };
  }) {
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      description: d.description || '',
      price: Number(d.price),
      category: d.category.name,
      categoryId: d.category.id,
      imageUrl: d.imageUrl || '',
      calories: d.calories,
      protein: d.protein,
      carbohydrates: d.carbohydrates,
      fat: d.fat,
      ingredients: d.ingredients || [],
      allergens: d.allergens || [],
      isVeg: d.isVeg,
      isVegan: d.isVegan,
      isJain: d.isJain,
      available: d.isAvailable,
      published: d.isPublished,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
