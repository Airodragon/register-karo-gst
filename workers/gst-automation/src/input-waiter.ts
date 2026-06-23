import IORedis from 'ioredis';
import { JobCancelledError } from './cancel-monitor';
import { captureCaptchaImage } from './captcha';

const INPUT_CHANNEL_PREFIX = 'user-input:';

export class InputWaiter {
  constructor(
    private readonly redis: IORedis,
    private readonly apiUrl: string,
    private readonly workerToken: string,
  ) {}

  async requestInput(
    applicationId: string,
    jobId: string,
    type: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    if (await this.isCancelled(applicationId)) {
      throw new JobCancelledError();
    }

    const status = type.includes('CAPTCHA') ? 'AWAITING_CAPTCHA' : 'AWAITING_OTP';
    await this.patchApplication(applicationId, {
      pendingInput: type,
      pendingInputData: { ...data, type, jobId, applicationId },
      status,
    });
    return this.waitForRedisInput(applicationId, 180000);
  }

  async captureCaptcha(page: import('playwright').Page): Promise<string> {
    return captureCaptchaImage(page);
  }

  async clearPendingInput(applicationId: string): Promise<void> {
    await this.patchApplication(applicationId, {
      pendingInput: null,
      pendingInputData: null,
    });
  }

  /** Clear human-input UI as soon as the worker has the value (portal may already have moved on). */
  async acknowledgeInputReceived(applicationId: string): Promise<void> {
    await this.patchApplication(applicationId, {
      pendingInput: null,
      pendingInputData: null,
      status: 'RUNNING',
    });
  }

  private async isCancelled(applicationId: string): Promise<boolean> {
    return (await this.redis.get(`cancel:${applicationId}`)) === '1';
  }

  private waitForRedisInput(
    applicationId: string,
    timeoutMs: number,
  ): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const subscriber = this.redis.duplicate();
      const inputChannel = `${INPUT_CHANNEL_PREFIX}${applicationId}`;
      const cancelChannel = `cancel:${applicationId}`;

      const cleanup = () => {
        clearTimeout(timer);
        subscriber.unsubscribe(inputChannel);
        subscriber.unsubscribe(cancelChannel);
        subscriber.disconnect();
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('User input timeout'));
      }, timeoutMs);

      subscriber.subscribe(inputChannel, cancelChannel);
      subscriber.on('message', (channel, message) => {
        if (channel === cancelChannel) {
          cleanup();
          reject(new JobCancelledError());
          return;
        }
        cleanup();
        try {
          resolve(JSON.parse(message));
        } catch {
          reject(new Error('Invalid input payload'));
        }
      });
    });
  }

  private async patchApplication(
    applicationId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(
      `${this.apiUrl}/api/internal/worker/applications/${applicationId}/update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-token': this.workerToken,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to update application: ${res.statusText}`);
    }
  }
}
