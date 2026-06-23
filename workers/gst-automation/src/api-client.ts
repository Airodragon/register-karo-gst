import type { ApplicationFormData } from '@registerkaro/shared-types';
import { AUTOMATION_PHASES } from '@registerkaro/shared-types';

export interface ApplicationRecord {
  id: string;
  clientRef: string;
  status: string;
  currentStep: string;
  constitution: string;
  trn?: string;
  trnExpiresAt?: string;
  arn?: string;
  formData: ApplicationFormData;
  portalSession?: Record<string, unknown>;
  documents?: Array<{ id: string; type: string; fileName: string; mimeType: string }>;
}

export class ApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly workerToken: string,
  ) {}

  async getApplication(id: string): Promise<ApplicationRecord> {
    const res = await fetch(`${this.apiUrl}/api/internal/worker/applications/${id}`, {
      headers: { 'x-worker-token': this.workerToken },
    });
    if (!res.ok) throw new Error(`Failed to fetch application: ${res.statusText}`);
    return res.json();
  }

  async updateApplication(id: string, data: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.apiUrl}/api/internal/worker/applications/${id}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-token': this.workerToken,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update application: ${res.statusText}`);
  }

  async reportProgress(
    id: string,
    phase: keyof typeof AUTOMATION_PHASES,
    label?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const info = AUTOMATION_PHASES[phase];
    if (!info) return;
    const progress = {
      percent: info.percent,
      phase,
      label: label ?? info.label,
      updatedAt: new Date().toISOString(),
      ...(details ? { details } : {}),
    };
    await this.updateApplication(id, { automationProgress: progress });
  }

  async downloadDocument(
    applicationId: string,
    type: string,
  ): Promise<{ fileName: string; base64: string } | null> {
    const res = await fetch(
      `${this.apiUrl}/api/internal/worker/applications/${applicationId}/documents/${type}`,
      { headers: { 'x-worker-token': this.workerToken } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      found: boolean;
      fileName?: string;
      base64?: string;
    };
    if (!data.found || !data.base64 || !data.fileName) return null;
    return { fileName: data.fileName, base64: data.base64 };
  }

  async completeJob(id: string, success: boolean, error?: string): Promise<void> {
    await fetch(`${this.apiUrl}/api/internal/worker/applications/${id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-token': this.workerToken,
      },
      body: JSON.stringify({ success, error }),
    });
  }

  async uploadFailureScreenshot(id: string, buffer: Buffer): Promise<void> {
    const res = await fetch(
      `${this.apiUrl}/api/internal/worker/applications/${id}/screenshot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-token': this.workerToken,
        },
        body: JSON.stringify({ imageBase64: buffer.toString('base64') }),
      },
    );
    if (!res.ok) {
      console.error('Failed to upload failure screenshot');
    }
  }
}
