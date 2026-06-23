import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_TYPES = [
  'promoterPhoto',
  'addressProof',
  'signatoryAppointmentProof',
  'panCard',
];

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    applicationId: string,
    type: string,
    file: Express.Multer.File,
    operatorId: string,
  ) {
    if (!ALLOWED_TYPES.includes(type)) {
      throw new NotFoundException(`Unknown document type: ${type}`);
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, PDF`,
      );
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Application not found');

    const storageKey = await this.storage.upload(
      applicationId,
      type,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    const doc = await this.prisma.document.create({
      data: {
        applicationId,
        type,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      },
    });

    const formData = (app.formData as Record<string, unknown>) ?? {};
    const documents = (formData.documents as Record<string, string>) ?? {};
    documents[type] = storageKey;
    formData.documents = documents;

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { formData: formData as Prisma.InputJsonValue },
    });

    await this.prisma.auditEvent.create({
      data: {
        applicationId,
        operatorId,
        eventType: 'DOCUMENT_UPLOADED',
        message: `Uploaded ${type}`,
        metadata: { documentId: doc.id, fileName: file.originalname },
      },
    });

    return doc;
  }

  async getDownloadUrl(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const url = await this.storage.getSignedDownloadUrl(doc.storageKey);
    return { url, fileName: doc.fileName };
  }
}
