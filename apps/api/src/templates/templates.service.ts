import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, role: string) {
    return this.prisma.filingTemplate.findMany({
      where: role === 'admin' ? undefined : { createdById: userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        constitution: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(
    userId: string,
    data: { name: string; constitution: 'proprietorship' | 'partnership' | 'huf'; formData: Record<string, unknown> },
  ) {
    const sanitized = { ...data.formData };
    delete sanitized.partA;
    if (sanitized.promoter && typeof sanitized.promoter === 'object') {
      const p = sanitized.promoter as Record<string, unknown>;
      delete p.pan;
      delete p.firstName;
      delete p.lastName;
      delete p.mobile;
      delete p.email;
    }
    delete sanitized.documents;

    return this.prisma.filingTemplate.create({
      data: {
        name: data.name,
        constitution: data.constitution,
        formData: sanitized as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
  }

  async get(id: string) {
    const template = await this.prisma.filingTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }
}
