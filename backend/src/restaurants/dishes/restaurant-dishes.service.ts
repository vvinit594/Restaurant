import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantContextService } from '../restaurant-context.service';
import {
  CreateDishDto,
  UpdateDishDto,
  BulkDishesDto,
  BulkDishItemDto,
  BULK_DISH_BATCH_MAX,
} from './dto/dish.dto';

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

function toOptionalInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function toOptionalFloat(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

@Injectable()
export class RestaurantDishesService {
  private readonly logger = new Logger(RestaurantDishesService.name);

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
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        imageUrl: true,
        calories: true,
        protein: true,
        carbohydrates: true,
        fat: true,
        ingredients: true,
        allergens: true,
        isVeg: true,
        isVegan: true,
        isJain: true,
        isAvailable: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
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

  /**
   * Authoritative bulk validation (no writes).
   * Categories must already exist for this restaurant — no silent create.
   */
  async validateBulkDishes(
    user: { id: string; role: any; restaurantId?: string },
    dto: BulkDishesDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
      MembershipRole.RESTAURANT_STAFF,
    ]);

    const prepared = await this.prepareBulkRows(ctx.restaurantId, dto.dishes);
    return {
      total: prepared.rows.length,
      valid: prepared.validCount,
      invalid: prepared.invalidCount,
      rows: prepared.rows,
    };
  }

  /**
   * Create dishes for authenticated restaurant only.
   *
   * IMPORTANT: Do NOT use Prisma interactive `$transaction(async tx => …)` against
   * Supabase pooler — multi-round-trip bulk creates get
   * "Transaction API error: Transaction not found" → HTTP 500.
   * Create sequentially with the same path as single Add Dish.
   */
  async bulkCreateDishes(
    user: { id: string; role: any; restaurantId?: string },
    dto: BulkDishesDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
      MembershipRole.RESTAURANT_STAFF,
    ]);

    if (!dto.dishes?.length) {
      throw new BadRequestException('At least one dish is required.');
    }
    if (dto.dishes.length > BULK_DISH_BATCH_MAX) {
      throw new BadRequestException(
        `At most ${BULK_DISH_BATCH_MAX} dishes per request. Send batches.`,
      );
    }

    this.logger.log(
      `bulk import start restaurant=${ctx.restaurantId} rows=${dto.dishes.length}`,
    );

    const prepared = await this.prepareBulkRows(ctx.restaurantId, dto.dishes, {
      requireImageUrl: false,
    });

    if (prepared.invalidCount > 0) {
      this.logger.warn(
        `bulk import rejected restaurant=${ctx.restaurantId} invalid=${prepared.invalidCount}`,
      );
      throw new BadRequestException({
        message: `${prepared.invalidCount} row(s) failed validation. No dishes were created.`,
        total: prepared.rows.length,
        valid: prepared.validCount,
        invalid: prepared.invalidCount,
        rows: prepared.rows,
      });
    }

    const created: any[] = [];
    const failedRows: Array<{
      row: number;
      name: string;
      category: string;
      price: number | null;
      imageUrl: string;
      status: 'invalid';
      errors: Array<{ field: string; message: string }>;
    }> = [];
    const usedSlugs = new Set<string>();

    for (const row of prepared.rows) {
      const item = row.payload!;
      const category = prepared.categoryByName.get(
        item.category.trim().toLowerCase(),
      );
      if (!category) {
        failedRows.push({
          row: row.row,
          name: row.name,
          category: row.category,
          price: row.price,
          imageUrl: row.imageUrl,
          status: 'invalid',
          errors: [
            {
              field: 'category',
              message: `Category "${item.category}" does not exist for this restaurant.`,
            },
          ],
        });
        continue;
      }

      try {
        const base = slugify(item.name.trim());
        if (!base) {
          failedRows.push({
            row: row.row,
            name: row.name,
            category: row.category,
            price: row.price,
            imageUrl: row.imageUrl,
            status: 'invalid',
            errors: [{ field: 'name', message: 'Dish name is invalid.' }],
          });
          continue;
        }

        let slug = base;
        let n = 2;
        for (;;) {
          if (!usedSlugs.has(slug)) {
            const clash = await this.prisma.dish.findFirst({
              where: {
                restaurantId: ctx.restaurantId,
                slug,
                deletedAt: null,
              },
              select: { id: true },
            });
            if (!clash) break;
          }
          slug = `${base}-${n}`;
          n += 1;
        }
        usedSlugs.add(slug);

        const dish = await this.prisma.dish.create({
          data: {
            restaurantId: ctx.restaurantId,
            categoryId: category.id,
            name: item.name.trim(),
            slug,
            description: item.description?.trim() || null,
            price: item.price,
            imageUrl: item.imageUrl?.trim() || null,
            calories: toOptionalInt(item.calories),
            protein: toOptionalFloat(item.protein),
            carbohydrates: toOptionalFloat(item.carbohydrates),
            fat: toOptionalFloat(item.fat),
            ingredients: toStringList(item.ingredients),
            allergens: toStringList(item.allergens),
            isVeg: item.isVeg ?? true,
            isVegan: item.isVegan ?? false,
            isJain: item.isJain ?? false,
            isAvailable: item.isAvailable ?? item.available ?? true,
            isPublished: item.isPublished ?? item.published ?? true,
          },
          include: { category: true },
        });
        created.push(this.toClientDish(dish));
      } catch (err: any) {
        const prismaCode = err?.code as string | undefined;
        let message = 'Could not create dish.';
        let field = 'import';
        if (prismaCode === 'P2002') {
          message = 'A dish with this name or slug already exists.';
          field = 'name';
        } else if (err?.message) {
          // Keep message short / safe for clients
          message = String(err.message).split('\n')[0].slice(0, 180);
        }
        this.logger.error(
          `bulk import row=${row.row} restaurant=${ctx.restaurantId} failed: ${message}`,
        );
        failedRows.push({
          row: row.row,
          name: row.name,
          category: row.category,
          price: row.price,
          imageUrl: row.imageUrl,
          status: 'invalid',
          errors: [{ field, message }],
        });
      }
    }

    this.logger.log(
      `bulk import done restaurant=${ctx.restaurantId} imported=${created.length} failed=${failedRows.length}`,
    );

    // If nothing was created, surface as 400 with row details (not opaque 500).
    if (created.length === 0 && failedRows.length > 0) {
      throw new BadRequestException({
        message: `Bulk import failed. ${failedRows.length} row(s) could not be created.`,
        total: prepared.rows.length,
        valid: 0,
        invalid: failedRows.length,
        imported: 0,
        failed: failedRows.length,
        rows: failedRows,
      });
    }

    return {
      imported: created.length,
      failed: failedRows.length,
      dishes: created,
      rows: failedRows,
      restaurantId: ctx.restaurantId,
    };
  }

  private async prepareBulkRows(
    restaurantId: string,
    dishes: BulkDishItemDto[],
    opts: { requireImageUrl?: boolean } = {},
  ) {
    const categories = await this.prisma.category.findMany({
      where: { restaurantId, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    const categoryByName = new Map(
      categories.map((c) => [c.name.trim().toLowerCase(), c]),
    );

    const existing = await this.prisma.dish.findMany({
      where: { restaurantId, deletedAt: null },
      select: { name: true },
      take: 5000,
    });
    const existingNames = new Set(
      existing.map((d) => d.name.trim().toLowerCase()),
    );

    const seenInBatch = new Map<string, number>();
    const rows: Array<{
      row: number;
      name: string;
      category: string;
      price: number | null;
      imageUrl: string;
      status: 'valid' | 'invalid';
      errors: Array<{ field: string; message: string }>;
      payload?: BulkDishItemDto;
    }> = [];

    let validCount = 0;
    let invalidCount = 0;

    dishes.forEach((raw, index) => {
      const rowNum = Number.isFinite(Number(raw.row))
        ? Number(raw.row)
        : index + 2;
      const errors: Array<{ field: string; message: string }> = [];
      const name = String(raw.name || '').trim();
      const categoryName = String(raw.category || '').trim();
      const price = Number(raw.price);
      const imageUrl = String(raw.imageUrl || '').trim();

      if (!name) {
        errors.push({ field: 'name', message: 'Dish name is required.' });
      } else if (name.length > 200) {
        errors.push({
          field: 'name',
          message: 'Dish name must be at most 200 characters.',
        });
      }

      if (!Number.isFinite(price) || price < 0.01) {
        errors.push({
          field: 'price',
          message: 'Price must be greater than 0.',
        });
      }

      if (!categoryName) {
        errors.push({ field: 'category', message: 'Category is required.' });
      } else if (!categoryByName.has(categoryName.toLowerCase())) {
        errors.push({
          field: 'category',
          message: `Category "${categoryName}" does not exist for this restaurant.`,
        });
      }

      if (imageUrl) {
        if (/^data:/i.test(imageUrl)) {
          errors.push({
            field: 'imageUrl',
            message: 'Base64 images are not allowed. Upload to storage first.',
          });
        } else if (!/^https?:\/\//i.test(imageUrl)) {
          errors.push({
            field: 'imageUrl',
            message: 'Image URL must be an http(s) URL.',
          });
        }
      } else if (opts.requireImageUrl) {
        errors.push({ field: 'imageUrl', message: 'Image URL is required.' });
      }

      for (const key of [
        'calories',
        'protein',
        'carbohydrates',
        'fat',
      ] as const) {
        const v = raw[key];
        if (v == null || v === ('' as any)) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          errors.push({
            field: key,
            message: `${key} must be a number ≥ 0.`,
          });
        }
      }

      if (name) {
        const key = name.toLowerCase();
        if (existingNames.has(key)) {
          errors.push({
            field: 'name',
            message: 'A dish with this name already exists.',
          });
        }
        const firstRow = seenInBatch.get(key);
        if (firstRow != null) {
          errors.push({
            field: 'name',
            message: `Duplicate dish name in this import (also row ${firstRow}).`,
          });
        } else {
          seenInBatch.set(key, rowNum);
        }
      }

      const status = errors.length ? 'invalid' : 'valid';
      if (status === 'valid') validCount += 1;
      else invalidCount += 1;

      rows.push({
        row: rowNum,
        name,
        category: categoryName,
        price: Number.isFinite(price) ? price : null,
        imageUrl,
        status,
        errors,
        payload: status === 'valid' ? raw : undefined,
      });
    });

    return { rows, validCount, invalidCount, categoryByName };
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
        ...(dto.price !== undefined &&
        dto.price !== null &&
        Number.isFinite(Number(dto.price))
          ? { price: Number(dto.price) }
          : {}),
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
