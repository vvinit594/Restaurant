import { Injectable, NotFoundException } from '@nestjs/common';
import { RestaurantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PublicRestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search = '') {
    const q = String(search || '').trim();
    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        status: RestaurantStatus.ACTIVE,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { city: { contains: q, mode: 'insensitive' as const } },
                { slug: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        city: true,
        state: true,
        address: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
      take: 100,
    });

    return restaurants.map((r) => this.toPublic(r));
  }

  async getBySlug(slug: string) {
    const normalized = String(slug || '').trim().toLowerCase();
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        slug: normalized,
        status: RestaurantStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        city: true,
        state: true,
        address: true,
        phone: true,
      },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    const dishes = await this.prisma.dish.findMany({
      where: {
        restaurantId: restaurant.id,
        deletedAt: null,
        isPublished: true,
        isAvailable: true,
      },
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
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });

    const categories = [
      ...new Set(dishes.map((d) => d.category.name).filter(Boolean)),
    ];

    return {
      restaurant: this.toPublic(restaurant),
      categories,
      dishes: dishes.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        description: d.description || '',
        price: Number(d.price),
        category: d.category.name,
        imageUrl: d.imageUrl || '',
        image: d.imageUrl || '',
        calories: d.calories,
        protein: d.protein,
        carbohydrates: d.carbohydrates,
        fat: d.fat,
        ingredients: d.ingredients || [],
        allergens: d.allergens || [],
        isVeg: d.isVeg,
        isVegan: d.isVegan,
        isJain: d.isJain,
      })),
    };
  }

  private toPublic(r: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    city: string;
    state: string | null;
    address: string;
    phone: string;
  }) {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || '',
      logoUrl: r.logoUrl || '',
      coverUrl: r.coverImageUrl || '',
      city: r.city,
      state: r.state || '',
      address: r.address,
      phone: r.phone,
    };
  }
}
