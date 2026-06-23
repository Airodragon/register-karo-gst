import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, ApplicationStatus, ApplicationStep, UserRole } from '@prisma/client';
import { createApplicationSchema, validateRequiredDocuments, applicationFormSchema } from '@registerkaro/gst-form-schema';
import {
  canCancelAutomation,
  restoreStatusAfterCancel,
} from '@registerkaro/shared-types';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { EventsGateway } from '../events/events.gateway';
import { StorageService } from '../storage/storage.service';
import { encryptJson, decryptJson } from '../common/encryption';

const INPUT_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.AWAITING_CAPTCHA,
  ApplicationStatus.AWAITING_OTP,
  ApplicationStatus.AWAITING_EVC_OTP,
];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly events: EventsGateway,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async create(data: unknown, operatorId: string) {
    const parsed = createApplicationSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join('; '),
      );
    }
    const app = await this.prisma.application.create({
      data: {
        clientRef: parsed.data.clientRef,
        constitution: parsed.data.constitution,
        formData: (parsed.data.formData ?? {}) as Prisma.InputJsonValue,
        operatorId,
      },
    });
    await this.addAudit(app.id, operatorId, 'CREATED', 'Application created');
    return this.findOne(app.id, operatorId);
  }

  async findAll(query: {
    status?: ApplicationStatus;
    search?: string;
    sort?: 'updatedAt' | 'createdAt' | 'trnExpiresAt';
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    attention?: string;
    userId?: string;
    userRole?: UserRole;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sort = query.sort ?? 'updatedAt';
    const order = query.order ?? 'desc';
    const attention = query.attention === 'true';

    const where: Prisma.ApplicationWhereInput = {};
    const andClauses: Prisma.ApplicationWhereInput[] = [];

    if (query.status) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      andClauses.push({
        OR: [
          { clientRef: { contains: q, mode: 'insensitive' } },
          { trn: { contains: q, mode: 'insensitive' } },
          { arn: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (attention) {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      andClauses.push({
        OR: [
          { status: { in: INPUT_STATUSES } },
          { status: ApplicationStatus.AWAITING_AADHAAR },
          { status: ApplicationStatus.FAILED },
          {
            status: ApplicationStatus.TRN_RECEIVED,
            trnExpiresAt: { lte: threeDaysFromNow },
          },
          { status: ApplicationStatus.EXPIRED },
        ],
      });
    }

    if (query.userRole === UserRole.operator && query.userId) {
      andClauses.push({
        OR: [{ operatorId: query.userId }, { operatorId: null }],
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const orderBy: Prisma.ApplicationOrderByWithRelationInput =
      sort === 'trnExpiresAt'
        ? { trnExpiresAt: order }
        : { [sort]: order };

    const [apps, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items: apps.map((a) => this.toSummary(a)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, userId?: string, userRole?: UserRole) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        documents: true,
        auditEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
        jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    this.assertCanAccess(app, userId, userRole);
    const portalSession = this.resolvePortalSession(app.portalSession);
    return {
      ...this.toSummary(app),
      formData: app.formData,
      documents: app.documents,
      auditEvents: app.auditEvents,
      jobs: app.jobs,
      portalSession,
      errorLog: app.errorLog,
      failureScreenshotKey: app.failureScreenshotKey ?? undefined,
      pendingInputData: app.pendingInputData ?? undefined,
    };
  }

  async updateFormData(
    id: string,
    formData: Record<string, unknown>,
    operatorId: string,
    userRole?: UserRole,
  ) {
    const existing = await this.prisma.application.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Application not found');
    this.assertCanAccess(existing, operatorId, userRole);

    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
      throw new BadRequestException('formData must be a JSON object');
    }

    const app = await this.prisma.application.update({
      where: { id },
      data: {
        formData: formData as Prisma.InputJsonValue,
      },
    });
    await this.addAudit(id, operatorId, 'FORM_UPDATED', 'Form data updated');
    this.events.emitApplicationUpdate(id, this.toSummary(app));
    return this.findOne(app.id, operatorId, userRole);
  }

  async updateStep(id: string, step: ApplicationStep, operatorId: string) {
    const app = await this.prisma.application.update({
      where: { id },
      data: { currentStep: step },
    });
    await this.addAudit(id, operatorId, 'STEP_CHANGED', `Step changed to ${step}`);
    this.events.emitApplicationUpdate(id, this.toSummary(app));
    return this.findOne(id);
  }

  async startAutomation(
    id: string,
    operatorId: string,
    fromStep?: string,
    headless?: boolean,
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    if (!fromStep || fromStep === 'part_a') {
      const formData = (app.formData as Record<string, unknown>) ?? {};
      const formCheck = applicationFormSchema.safeParse(formData);
      if (!formCheck.success) {
        throw new BadRequestException(
          `Complete all wizard steps before starting automation: ${formCheck.error.errors.map((e) => e.message).join('; ')}`,
        );
      }
      const documents = formData.documents as Record<string, string> | undefined;
      const docCheck = validateRequiredDocuments(
        documents,
        app.constitution as 'proprietorship' | 'partnership' | 'huf',
      );
      if (!docCheck.valid) {
        throw new BadRequestException(
          `Missing required documents: ${docCheck.missing.join(', ')}`,
        );
      }
    }

    const progress = {
      percent: 5,
      phase: 'queued',
      label: 'Job queued',
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.application.update({
      where: { id },
      data: {
        status: ApplicationStatus.QUEUED,
        automationProgress: progress as Prisma.InputJsonValue,
      },
    });

    this.events.emitJobEvent(id, {
      type: 'STATUS_CHANGED',
      applicationId: id,
      payload: progress,
      timestamp: progress.updatedAt,
    });

    const job = await this.jobsService.enqueueApplication(
      id,
      fromStep ?? 'part_a',
      headless,
    );
    await this.addAudit(id, operatorId, 'AUTOMATION_STARTED', `Job ${job.id} queued`);

    return { applicationId: id, jobId: job.id };
  }

  async resumeAutomation(id: string, operatorId: string, headless?: boolean) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (!app.trn && app.status === ApplicationStatus.DRAFT) {
      throw new BadRequestException('No TRN to resume from. Start Part A first.');
    }

    const step = app.trn ? 'part_b_resume' : 'part_a';
    return this.startAutomation(id, operatorId, step, headless);
  }

  async submitUserInput(
    id: string,
    input: {
      captcha?: string;
      mobileOtp?: string;
      emailOtp?: string;
      otp?: string;
      aadhaarOtp?: string;
    },
    operatorId: string,
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (!INPUT_STATUSES.includes(app.status) && app.status !== ApplicationStatus.AWAITING_AADHAAR) {
      throw new BadRequestException('Application is not awaiting user input');
    }

    await this.jobsService.submitUserInput(id, input);
    await this.addAudit(id, operatorId, 'USER_INPUT', 'Operator submitted portal input');

    return { success: true };
  }

  async cancelAutomation(id: string, operatorId: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    if (!canCancelAutomation(app.status)) {
      throw new BadRequestException('No active automation to cancel');
    }

    await this.jobsService.cancelAutomation(id);

    const restoreStatus = restoreStatusAfterCancel(!!app.arn, !!app.trn) as ApplicationStatus;

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: restoreStatus,
        pendingInput: null,
        pendingInputData: Prisma.JsonNull,
        automationJobId: null,
        automationProgress: Prisma.JsonNull,
        errorLog: null,
      },
    });

    await this.addAudit(id, operatorId, 'AUTOMATION_CANCELLED', 'Automation cancelled by operator');
    this.events.emitApplicationUpdate(id, this.toSummary(updated));

    return this.findOne(id);
  }

  async remove(id: string, operatorId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    if (canCancelAutomation(app.status)) {
      await this.jobsService.cancelAutomation(id);
    }

    for (const doc of app.documents) {
      await this.storage.delete(doc.storageKey).catch(() => undefined);
    }

    await this.prisma.application.delete({ where: { id } });

    return { success: true, id };
  }

  async updateFromWorker(
    id: string,
    update: {
      status?: ApplicationStatus;
      currentStep?: ApplicationStep;
      trn?: string;
      trnExpiresAt?: Date;
      arn?: string;
      pendingInput?: string | null;
      pendingInputData?: Record<string, unknown> | null;
      portalSession?: Record<string, unknown>;
      errorLog?: string;
      failureScreenshotKey?: string;
      automationProgress?: {
        percent: number;
        phase: string;
        label: string;
        updatedAt: string;
      };
    },
  ) {
    const data: Prisma.ApplicationUpdateInput = {};
    if (update.status) data.status = update.status;
    if (update.currentStep) data.currentStep = update.currentStep;
    if (update.trn) data.trn = update.trn;
    if (update.trnExpiresAt) data.trnExpiresAt = update.trnExpiresAt;
    if (update.arn) data.arn = update.arn;
    if (update.pendingInput !== undefined) {
      data.pendingInput = update.pendingInput as never;
    }
    if (update.pendingInputData !== undefined) {
      data.pendingInputData = update.pendingInputData as Prisma.InputJsonValue;
    }
    if (update.portalSession) {
      const secret = this.config.get<string>('ENCRYPTION_KEY');
      data.portalSession = secret
        ? ({ encrypted: encryptJson(update.portalSession, secret) } as Prisma.InputJsonValue)
        : (update.portalSession as Prisma.InputJsonValue);
    }
    if (update.errorLog) data.errorLog = update.errorLog;
    if (update.failureScreenshotKey) data.failureScreenshotKey = update.failureScreenshotKey;
    if (update.automationProgress) {
      data.automationProgress = update.automationProgress as Prisma.InputJsonValue;
    }

    const app = await this.prisma.application.update({ where: { id }, data });

    this.events.emitApplicationUpdate(id, this.toSummary(app));

    if (update.automationProgress) {
      this.events.emitJobEvent(id, {
        type: 'STEP_COMPLETED',
        applicationId: id,
        payload: update.automationProgress,
        timestamp: update.automationProgress.updatedAt,
      });
    }

    if (update.pendingInputData) {
      this.events.emitInputRequired(id, update.pendingInputData);
    }

    return app;
  }

  async assignOperator(id: string, operatorId: string | null, userId: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    const updated = await this.prisma.application.update({
      where: { id },
      data: { operatorId },
    });
    await this.addAudit(
      id,
      userId,
      'OPERATOR_ASSIGNED',
      operatorId ? `Assigned to operator ${operatorId}` : 'Unassigned',
    );
    return this.findOne(updated.id, userId);
  }

  async getFailureScreenshotUrl(storageKey: string) {
    const url = await this.storage.getSignedDownloadUrl(storageKey);
    return { url };
  }

  private resolvePortalSession(portalSession: Prisma.JsonValue | null) {
    if (!portalSession || typeof portalSession !== 'object') return portalSession;
    const record = portalSession as Record<string, unknown>;
    if (typeof record.encrypted === 'string') {
      const secret = this.config.get<string>('ENCRYPTION_KEY');
      if (secret) {
        try {
          return decryptJson(record.encrypted, secret);
        } catch {
          return null;
        }
      }
    }
    return portalSession;
  }

  private assertCanAccess(
    app: { operatorId: string | null },
    userId?: string,
    userRole?: UserRole,
  ) {
    if (userRole === UserRole.admin || !userId || userRole !== UserRole.operator) return;
    if (app.operatorId && app.operatorId !== userId) {
      throw new ForbiddenException('You do not have access to this filing');
    }
  }

  private async addAudit(
    applicationId: string,
    operatorId: string,
    eventType: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        applicationId,
        operatorId,
        eventType,
        message,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private toSummary(app: {
    id: string;
    clientRef: string;
    status: ApplicationStatus;
    currentStep: ApplicationStep;
    constitution: string;
    trn: string | null;
    trnExpiresAt: Date | null;
    arn: string | null;
    pendingInput: string | null;
    automationProgress?: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const actionRequired = INPUT_STATUSES.includes(app.status) ||
      app.status === ApplicationStatus.AWAITING_AADHAAR;

    let daysUntilTrnExpiry: number | undefined;
    let trnExpiringSoon = false;
    if (app.trnExpiresAt) {
      const ms = app.trnExpiresAt.getTime() - Date.now();
      daysUntilTrnExpiry = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      trnExpiringSoon =
        app.status === ApplicationStatus.TRN_RECEIVED && daysUntilTrnExpiry <= 3;
    }

    const needsAttention =
      actionRequired ||
      trnExpiringSoon ||
      app.status === ApplicationStatus.FAILED ||
      app.status === ApplicationStatus.EXPIRED;

    return {
      id: app.id,
      clientRef: app.clientRef,
      status: app.status,
      currentStep: app.currentStep,
      constitution: app.constitution,
      trn: app.trn ?? undefined,
      trnExpiresAt: app.trnExpiresAt?.toISOString(),
      arn: app.arn ?? undefined,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      actionRequired,
      pendingInput: app.pendingInput ?? undefined,
      daysUntilTrnExpiry,
      trnExpiringSoon,
      needsAttention,
      automationProgress: app.automationProgress
        ? (app.automationProgress as {
            percent: number;
            phase: string;
            label: string;
            updatedAt: string;
          })
        : undefined,
    };
  }
}
