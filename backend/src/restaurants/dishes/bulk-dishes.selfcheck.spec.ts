/**
 * Bulk dish import validation self-check (no DB).
 * Run: npx jest src/restaurants/dishes/bulk-dishes.selfcheck.spec.ts
 */
import { BadRequestException } from '@nestjs/common';
import { BULK_DISH_BATCH_MAX } from './dto/dish.dto';
import { RestaurantDishesService } from './restaurant-dishes.service';

function mockPrisma(opts: {
  categories?: Array<{ id: string; name: string; slug: string }>;
  dishes?: Array<{ name: string }>;
  createImpl?: (args: any) => any;
}) {
  const categories = opts.categories || [
    { id: 'c1', name: 'Main Course', slug: 'main-course' },
    { id: 'c2', name: 'South Indian', slug: 'south-indian' },
  ];
  const existing = opts.dishes || [];
  const created: any[] = [];

  return {
    created,
    prisma: {
      category: {
        findMany: jest.fn(async () => categories),
      },
      dish: {
        findMany: jest.fn(async () => existing),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async (args) => {
          const dish = opts.createImpl
            ? opts.createImpl(args)
            : {
                id: `d${created.length + 1}`,
                ...args.data,
                price: args.data.price,
                description: args.data.description,
                imageUrl: args.data.imageUrl,
                calories: args.data.calories,
                protein: args.data.protein,
                carbohydrates: args.data.carbohydrates,
                fat: args.data.fat,
                ingredients: args.data.ingredients || [],
                allergens: args.data.allergens || [],
                isVeg: args.data.isVeg,
                isVegan: args.data.isVegan,
                isJain: args.data.isJain,
                isAvailable: args.data.isAvailable,
                isPublished: args.data.isPublished,
                createdAt: new Date(),
                updatedAt: new Date(),
                category: categories.find((c) => c.id === args.data.categoryId),
              };
          created.push(dish);
          return dish;
        }),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        dish: {
          findFirst: jest.fn(async () => null),
          create: jest.fn(async (args: any) => {
            const dish = {
              id: `d${created.length + 1}`,
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date(),
              category: categories.find((c) => c.id === args.data.categoryId),
            };
            created.push(dish);
            return dish;
          }),
        },
      })),
    },
  };
}

function makeService(prisma: any) {
  const restaurantContext = {
    requireActiveMembership: jest.fn(async () => ({
      restaurantId: 'rest_a',
      membership: { role: 'RESTAURANT_OWNER' },
    })),
  };
  return new RestaurantDishesService(prisma as any, restaurantContext as any);
}

describe('Bulk dishes import', () => {
  it('exports batch max suited for serverless body limits', () => {
    expect(BULK_DISH_BATCH_MAX).toBe(50);
  });

  it('validates a small valid batch', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    const res = await svc.validateBulkDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: Array.from({ length: 10 }, (_, i) => ({
        row: i + 2,
        name: `Dish ${i + 1}`,
        price: 100 + i,
        category: 'Main Course',
        imageUrl: `https://example.supabase.co/storage/v1/object/public/media/dishes/rest_a/pending/${i}.jpg`,
      })),
    });
    expect(res.valid).toBe(10);
    expect(res.invalid).toBe(0);
  });

  it('validates a 50-dish batch (API max)', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    const res = await svc.validateBulkDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: Array.from({ length: 50 }, (_, i) => ({
        row: i + 2,
        name: `Bulk Dish ${i + 1}`,
        price: 50,
        category: 'South Indian',
      })),
    });
    expect(res.total).toBe(50);
    expect(res.valid).toBe(50);
  });

  it('rejects invalid price', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    const res = await svc.validateBulkDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: [{ row: 2, name: 'X', price: 0, category: 'Main Course' }],
    });
    expect(res.invalid).toBe(1);
    expect(res.rows[0].errors[0].field).toBe('price');
  });

  it('rejects missing category for this restaurant (no silent create)', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    const res = await svc.validateBulkDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: [{ row: 5, name: 'Noodles', price: 120, category: 'Chinese' }],
    });
    expect(res.invalid).toBe(1);
    expect(res.rows[0].errors[0].message).toMatch(/does not exist/);
  });

  it('rejects Base64 imageUrl', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    const res = await svc.validateBulkDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: [{
        row: 3,
        name: 'Bad',
        price: 10,
        category: 'Main Course',
        imageUrl: 'data:image/jpeg;base64,aaaa',
      }],
    });
    expect(res.invalid).toBe(1);
    expect(res.rows[0].errors.some((e) => /Base64/i.test(e.message))).toBe(true);
  });

  it('rejects duplicate names in file and against DB', async () => {
    const { prisma } = mockPrisma({ dishes: [{ name: 'Pav Bhaji' }] });
    const svc = makeService(prisma);
    const res = await svc.validateBulkDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: [
        { row: 2, name: 'Pav Bhaji', price: 100, category: 'Main Course' },
        { row: 3, name: 'Pizza', price: 200, category: 'Main Course' },
        { row: 4, name: 'Pizza', price: 220, category: 'Main Course' },
      ],
    });
    expect(res.invalid).toBe(2);
  });

  it('creates dishes only for authenticated restaurantId', async () => {
    const { prisma, created } = mockPrisma({});
    const svc = makeService(prisma);
    const out = await svc.bulkCreateDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: [
        {
          row: 2,
          name: 'Idli',
          price: 40,
          category: 'South Indian',
          imageUrl: 'https://cdn.example.com/media/dishes/rest_a/pending/a.jpg',
        },
      ],
    });
    expect(out.imported).toBe(1);
    expect(out.restaurantId).toBe('rest_a');
    expect(created[0].restaurantId).toBe('rest_a');
    expect(created[0].imageUrl).toMatch(/^https:\/\//);
    expect(String(created[0].imageUrl)).not.toMatch(/^data:/);
  });

  it('does not create when validation fails (category missing)', async () => {
    const { prisma, created } = mockPrisma({});
    const svc = makeService(prisma);
    await expect(
      svc.bulkCreateDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
        dishes: [
          { row: 2, name: 'Ok', price: 10, category: 'Main Course' },
          { row: 3, name: 'Bad', price: 10, category: 'Chinese' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(created.length).toBe(0);
  });

  it('rejects oversized batch', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    const dishes = Array.from({ length: BULK_DISH_BATCH_MAX + 1 }, (_, i) => ({
      row: i + 2,
      name: `D${i}`,
      price: 10,
      category: 'Main Course',
    }));
    await expect(
      svc.bulkCreateDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, { dishes }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not use interactive $transaction for bulk create', async () => {
    const { prisma } = mockPrisma({});
    const svc = makeService(prisma);
    await svc.bulkCreateDishes({ id: 'u1', role: 'RESTAURANT_OWNER' }, {
      dishes: [
        { row: 2, name: 'A', price: 10, category: 'Main Course' },
        { row: 3, name: 'B', price: 12, category: 'Main Course' },
      ],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dish.create).toHaveBeenCalledTimes(2);
  });
});
