import IORedis from 'ioredis';

export class JobCancelledError extends Error {
  constructor() {
    super('Automation cancelled by operator');
    this.name = 'JobCancelledError';
  }
}

export class CancelMonitor {
  constructor(private readonly redis: IORedis) {}

  async isCancelled(applicationId: string): Promise<boolean> {
    return (await this.redis.get(`cancel:${applicationId}`)) === '1';
  }

  async assertNotCancelled(applicationId: string): Promise<void> {
    if (await this.isCancelled(applicationId)) {
      throw new JobCancelledError();
    }
  }
}
