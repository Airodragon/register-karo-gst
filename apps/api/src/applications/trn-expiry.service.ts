import { Injectable, OnModuleInit } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class TrnExpiryService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  onModuleInit() {
    void this.expireStaleTrns();
    setInterval(() => void this.expireStaleTrns(), 60 * 60 * 1000);
  }

  async expireStaleTrns() {
    const now = new Date();
    const stale = await this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.TRN_RECEIVED,
        trnExpiresAt: { lte: now },
      },
    });

    for (const app of stale) {
      const updated = await this.prisma.application.update({
        where: { id: app.id },
        data: { status: ApplicationStatus.EXPIRED },
      });
      await this.prisma.auditEvent.create({
        data: {
          applicationId: app.id,
          eventType: 'TRN_EXPIRED',
          message: 'TRN validity expired — restart Part A to obtain a new TRN',
        },
      });
      this.events.emitApplicationUpdate(app.id, {
        id: updated.id,
        clientRef: updated.clientRef,
        status: updated.status,
      });
    }
  }
}
