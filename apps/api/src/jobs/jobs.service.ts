import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

export const GST_AUTOMATION_QUEUE = 'gst-automation';

export interface GstJobData {
  applicationId: string;
  step: string;
  headless?: boolean;
}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queue: Queue;
  private readonly inputWaiters = new Map<
    string,
    { resolve: (input: Record<string, string>) => void; reject: (err: Error) => void }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(GST_AUTOMATION_QUEUE, {
      connection: this.connection as never,
    });
  }

  async enqueueApplication(applicationId: string, step: string, headless?: boolean) {
    const jobRecord = await this.prisma.automationJob.create({
      data: { applicationId, step, status: 'queued' },
    });

    const priority =
      step.includes('resume') || step === 'submit' ? 1 : step === 'part_b' ? 5 : 10;

    const bullJob = await this.queue.add(
      'run-step',
      { applicationId, step, headless },
      {
        jobId: jobRecord.id,
        priority,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    await this.prisma.automationJob.update({
      where: { id: jobRecord.id },
      data: { bullJobId: bullJob.id },
    });

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { automationJobId: jobRecord.id },
    });

    return jobRecord;
  }

  getQueue(): Queue {
    return this.queue;
  }

  getConnection(): IORedis {
    return this.connection;
  }

  async waitForUserInput(
    applicationId: string,
    jobId: string,
    timeoutMs = 180000,
  ): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const key = `${applicationId}:${jobId}`;
      const timer = setTimeout(() => {
        this.inputWaiters.delete(key);
        reject(new Error('User input timeout'));
      }, timeoutMs);

      this.inputWaiters.set(key, {
        resolve: (input) => {
          clearTimeout(timer);
          this.inputWaiters.delete(key);
          resolve(input);
        },
        reject: (err) => {
          clearTimeout(timer);
          this.inputWaiters.delete(key);
          reject(err);
        },
      });
    });
  }

  async submitUserInput(
    applicationId: string,
    input: Record<string, string | undefined>,
  ) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!app?.automationJobId) {
      throw new Error('No active job for application');
    }

    const key = `${applicationId}:${app.automationJobId}`;
    const waiter = this.inputWaiters.get(key);
    if (!waiter) {
      await this.connection.publish(
        `user-input:${applicationId}`,
        JSON.stringify(input),
      );
      return;
    }

    const filtered = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;
    waiter.resolve(filtered);
  }

  async publishWorkerUpdate(applicationId: string, payload: unknown) {
    this.events.emitJobEvent(applicationId, payload);
  }

  async cancelAutomation(applicationId: string): Promise<void> {
    await this.connection.set(`cancel:${applicationId}`, '1', 'EX', 3600);
    await this.connection.publish(`cancel:${applicationId}`, 'cancel');

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (app?.automationJobId) {
      const job = await this.queue.getJob(app.automationJobId);
      if (job) {
        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
          await job.remove();
        }
      }

      await this.prisma.automationJob.update({
        where: { id: app.automationJobId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          error: 'Cancelled by operator',
        },
      });
    }

    const key = `${applicationId}:${app?.automationJobId ?? ''}`;
    const waiter = this.inputWaiters.get(key);
    if (waiter) {
      waiter.reject(new Error('Automation cancelled'));
      this.inputWaiters.delete(key);
    }
  }

  onModuleDestroy() {
    this.connection.disconnect();
  }
}

export function createInputSubscriber(
  connection: IORedis,
  applicationId: string,
  onInput: (input: Record<string, string>) => void,
): () => void {
  const subscriber = connection.duplicate();
  const channel = `user-input:${applicationId}`;

  subscriber.subscribe(channel);
  subscriber.on('message', (_ch, message) => {
    try {
      onInput(JSON.parse(message));
    } catch {
      /* ignore */
    }
  });

  return () => {
    subscriber.unsubscribe(channel);
    subscriber.disconnect();
  };
}
