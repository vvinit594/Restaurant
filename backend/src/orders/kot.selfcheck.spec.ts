/**
 * KOT accept / download self-check (mocked Prisma).
 * Run: npx jest src/orders/kot.selfcheck.spec.ts
 */
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

function makeOrder(overrides: Partial<any> = {}) {
  return {
    id: 'ord_1',
    orderNumber: 'DY99662610',
    kotNumber: null,
    restaurantId: 'rest_a',
    tableId: 't10',
    tableLabel: '10',
    status: OrderStatus.NEW,
    subtotal: 200,
    taxAmount: 0,
    discountAmount: 0,
    serviceCharge: 0,
    total: 200,
    notes: null,
    placedAt: new Date('2026-09-06T14:38:00Z'),
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-09-06T14:38:00Z'),
    updatedAt: new Date('2026-09-06T14:38:00Z'),
    items: [
      {
        id: 'oi_1',
        dishId: 'd1',
        dishNameSnapshot: 'Fried Rice',
        unitPriceSnapshot: 200,
        quantity: 1,
        itemTotal: 200,
      },
    ],
    ...overrides,
  };
}

describe('KOT generation on accept', () => {
  it('assigns persistent kotNumber exactly once on accept', async () => {
    const order = makeOrder();
    let stored = { ...order };
    const prisma: any = {
      order: {
        findFirst: jest.fn(async () => ({ ...stored, items: stored.items })),
        findUnique: jest.fn(async () => null),
        updateMany: jest.fn(async ({ data }) => {
          if (stored.status !== OrderStatus.NEW) return { count: 0 };
          stored = { ...stored, ...data };
          return { count: 1 };
        }),
        update: jest.fn(),
      },
      restaurant: {
        findUnique: jest.fn(async () => ({ name: 'Gateway Restaurant' })),
      },
    };
    const svc = new OrdersService(prisma);
    const first = await svc.updateStatus('rest_a', 'ord_1', 'ACCEPTED');
    expect(first.status).toBe('ACCEPTED');
    expect(first.kotNumber).toMatch(/^DY/);
    const kot = first.kotNumber;

    stored.status = OrderStatus.ACCEPTED;
    stored.kotNumber = kot;
    await expect(svc.updateStatus('rest_a', 'ord_1', 'ACCEPTED')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const kotDto = await svc.getKot('rest_a', 'ord_1');
    expect(kotDto.kotNumber).toBe(kot);
    expect(kotDto.totalQty).toBe(1);
    expect(kotDto.items[0].name).toBe('Fried Rice');
    expect(kotDto.tableNumber).toBe('10');
  });

  it('rejects KOT download for NEW orders', async () => {
    const prisma: any = {
      order: {
        findFirst: jest.fn(async () => makeOrder()),
      },
    };
    const svc = new OrdersService(prisma);
    await expect(svc.getKot('rest_a', 'ord_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sums multi-item quantities for KOT', async () => {
    const order = makeOrder({
      status: OrderStatus.ACCEPTED,
      kotNumber: 'DY33197593',
      acceptedAt: new Date(),
      items: [
        {
          id: '1',
          dishId: null,
          dishNameSnapshot: 'Fried Rice',
          unitPriceSnapshot: 200,
          quantity: 2,
          itemTotal: 400,
        },
        {
          id: '2',
          dishId: null,
          dishNameSnapshot: 'Pizza',
          unitPriceSnapshot: 300,
          quantity: 1,
          itemTotal: 300,
        },
        {
          id: '3',
          dishId: null,
          dishNameSnapshot: 'Gulab Jamun',
          unitPriceSnapshot: 100,
          quantity: 3,
          itemTotal: 300,
        },
      ],
    });
    const prisma: any = {
      order: { findFirst: jest.fn(async () => order) },
      restaurant: {
        findUnique: jest.fn(async () => ({ name: 'Gateway Restaurant' })),
      },
    };
    const svc = new OrdersService(prisma);
    const kot = await svc.getKot('rest_a', 'ord_1');
    expect(kot.totalQty).toBe(6);
    expect(kot.kotNumber).toBe('DY33197593');
    expect(kot.status).toBe('ACCEPTED');
  });

  it('concurrent accept returns existing KOT without Conflict when already accepted', async () => {
    const accepted = makeOrder({
      status: OrderStatus.ACCEPTED,
      kotNumber: 'DY11112222',
      acceptedAt: new Date(),
    });
    const prisma: any = {
      order: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(makeOrder()) // initial read still NEW in race window
          .mockResolvedValue(accepted),
        findUnique: jest.fn(async () => null),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      restaurant: {
        findUnique: jest.fn(async () => ({ name: 'Gateway Restaurant' })),
      },
    };
    const svc = new OrdersService(prisma);
    // Flow: STATUS_FLOW check on first find (NEW) allows ACCEPTED, then updateMany 0, then fetch accepted
    const out = await svc.updateStatus('rest_a', 'ord_1', 'ACCEPTED');
    expect(out.kotNumber).toBe('DY11112222');
    expect(out.status).toBe('ACCEPTED');
  });
});
