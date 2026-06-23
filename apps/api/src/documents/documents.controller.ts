import {
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@Controller('applications/:applicationId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post(':type')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(
    @Param('applicationId') applicationId: string,
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { id: string } },
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documentsService.upload(applicationId, type, file, req.user.id);
  }

  @Get(':documentId/download')
  download(@Param('documentId') documentId: string) {
    return this.documentsService.getDownloadUrl(documentId);
  }
}
