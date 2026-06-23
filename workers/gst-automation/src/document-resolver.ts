import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ApiClient } from './api-client';

const DOC_TYPES = ['promoterPhoto', 'addressProof', 'panCard', 'signatoryAppointmentProof'] as const;

export type ResolvedDocuments = Partial<Record<(typeof DOC_TYPES)[number], string>>;

export async function resolveDocuments(
  api: ApiClient,
  applicationId: string,
  constitution?: string,
): Promise<ResolvedDocuments> {
  const dir = join(tmpdir(), 'registerkaro-docs', applicationId);
  await mkdir(dir, { recursive: true });

  const resolved: ResolvedDocuments = {};
  const required = ['promoterPhoto', 'addressProof', 'panCard'] as const;
  const optional =
    constitution === 'partnership' || constitution === 'huf'
      ? ([...required, 'signatoryAppointmentProof'] as const)
      : required;

  for (const type of DOC_TYPES) {
    const doc = await api.downloadDocument(applicationId, type);
    if (!doc) continue;
    const ext = doc.fileName.includes('.') ? doc.fileName.split('.').pop() : 'bin';
    const path = join(dir, `${type}.${ext}`);
    await writeFile(path, Buffer.from(doc.base64, 'base64'));
    resolved[type] = path;
  }

  const missing = optional.filter((t) => !resolved[t]);
  if (missing.length) {
    throw new Error(
      `Missing required documents in RegisterKaro: ${missing.join(', ')}. Upload them before starting automation.`,
    );
  }

  return resolved;
}
