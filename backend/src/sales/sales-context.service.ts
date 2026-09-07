import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SalesPersonStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalesContextService {
  constructor(private readonly prisma: PrismaService) {}

  async requireSalesPerson(user: { id: string; role: string; isActive?: boolean }) {
    if (!user?.id || user.role !== UserRole.SALES_PERSON || user.isActive === false) {
      throw new ForbiddenException('Sales Person access required.');
    }

    const profile = await this.prisma.salesPerson.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile || profile.status !== SalesPersonStatus.ACTIVE || !profile.user.isActive) {
      throw new UnauthorizedException('Sales Person account is not active.');
    }

    return profile;
  }
}
